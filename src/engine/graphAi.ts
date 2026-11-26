import {
  AIDifficulty,
  ALL_COLORS,
  BoardDefinition,
  BoardGraphAnalysis,
  Color,
  Direction8,
  DIRECTIONS_8,
  GameState,
  GraphPieceMetrics,
  Move,
  PieceDefinition,
  TileConfig,
} from './types';
import {
  applyMoveToBoard,
  generateLegalMoves,
  getBoardRules,
  isColorInCheck,
  isImpassableTile,
  nextActiveColor,
  PieceRegistry,
  rotateDirectionForColor,
  rotateOffsetForColor,
} from './rules';

export function analyzeBoardGraph(
  tiles: TileConfig[][],
  pieceIds: string[],
  registry: PieceRegistry
): BoardGraphAnalysis {
  const t0 = performance.now();
  const rows = tiles.length;
  const cols = tiles[0].length;

  let activeTileCount = 0;
  let sanctuaryCount = 0;
  const portalMap: Record<string, { r: number; c: number }[]> = {};

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = tiles[r][c];
      if (!isImpassableTile(t)) activeTileCount++;
      if (t.rule === 'sanctuary') sanctuaryCount++;
      if (t.rule === 'portal' && t.portalChannel) {
        if (!portalMap[t.portalChannel]) portalMap[t.portalChannel] = [];
        portalMap[t.portalChannel].push({ r, c });
      }
    }
  }

  const portalPairs = Object.values(portalMap).filter((arr) => arr.length >= 2).length;
  const metricsByPiece: Record<string, GraphPieceMetrics> = {};

  for (const pid of pieceIds) {
    const def = registry[pid];
    if (!def) continue;

    const whiteGraph = buildPieceGraph(tiles, def, 'white', portalMap);
    const blackGraph = buildPieceGraph(tiles, def, 'black', portalMap);
    const redGraph = buildPieceGraph(tiles, def, 'red', portalMap);
    const blueGraph = buildPieceGraph(tiles, def, 'blue', portalMap);

    const avgMobility =
      activeTileCount > 0
        ? (whiteGraph.totalEdges + blackGraph.totalEdges) / (2 * activeTileCount)
        : 0;

    let value = Math.round(avgMobility * 42);
    if (def.hops.length > 0) value += Math.min(140, def.hops.length * 16);
    if (def.rules.rangedAttack) value += 210;
    if (def.rules.iron) value += 360;
    if (def.rules.blacksmith) value += 130;
    if (def.rules.explosive) value += 170;
    if (def.rules.phasing) value += 110;
    if (def.rules.pawnDoubleStep) value += 35;
    if (def.rules.royal) value = 20000;
    else value = Math.max(85, value);

    metricsByPiece[pid] = {
      pieceId: pid,
      materialValue: value,
      avgMobility: Number(avgMobility.toFixed(2)),
      pstByColor: {
        white: whiteGraph.pst,
        black: blackGraph.pst,
        red: redGraph.pst,
        blue: blueGraph.pst,
      },
    };
  }

  return {
    metricsByPiece,
    activeTileCount,
    portalPairs,
    sanctuaryCount,
    computeTimeMs: Number((performance.now() - t0).toFixed(2)),
  };
}

export function estimatePieceValueOnStandardBoard(def: PieceDefinition): {
  points: number;
  avgMobility: number;
} {
  const tiles: TileConfig[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => ({ rule: 'normal' as const }))
  );
  const analysis = analyzeBoardGraph(tiles, [def.id], { [def.id]: def });
  const m = analysis.metricsByPiece[def.id];
  if (!m) return { points: 1, avgMobility: 0 };
  if (def.rules.royal) return { points: 99, avgMobility: m.avgMobility };
  return {
    points: Number((m.materialValue / 100).toFixed(1)),
    avgMobility: m.avgMobility,
  };
}

function buildPieceGraph(
  tiles: TileConfig[][],
  def: PieceDefinition,
  color: Color,
  portalMap: Record<string, { r: number; c: number }[]>
): { totalEdges: number; pst: number[][] } {
  const rows = tiles.length;
  const cols = tiles[0].length;

  const revAdj: number[][][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => [])
  );
  const outDegree: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );
  let totalEdges = 0;

  const promoGoals: { r: number; c: number }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = tiles[r][c];
      if (isImpassableTile(t)) continue;
      if (
        !def.rules.royal &&
        def.rules.canPromote &&
        t.rule === 'promotion' &&
        (t.promotionFor === 'both' || t.promotionFor === 'all' || t.promotionFor === color) &&
        (t.promoteToPieceId || 'queen') !== def.id
      ) {
        promoGoals.push({ r, c });
      }

      const targets = new Set<number>();

      for (const hop of def.hops) {
        const rot = rotateOffsetForColor(hop.dr, hop.dc, color);
        const tr = r + rot.dr;
        const tc = c + rot.dc;
        if (tr >= 0 && tr < rows && tc >= 0 && tc < cols && !isImpassableTile(tiles[tr][tc])) {
          targets.add(tr * cols + tc);
        }
      }

      for (const [rawDir, maxDist] of Object.entries(def.slides) as [Direction8, number | undefined][]) {
        if (!maxDist || maxDist <= 0) continue;
        const actual = rotateDirectionForColor(rawDir, color);
        const { dr, dc } = DIRECTIONS_8[actual];
        for (let step = 1; step <= maxDist; step++) {
          const tr = r + dr * step;
          const tc = c + dc * step;
          if (tr < 0 || tr >= rows || tc < 0 || tc >= cols || isImpassableTile(tiles[tr][tc])) {
            break;
          }
          targets.add(tr * cols + tc);
        }
      }

      const expanded = new Set<number>(targets);
      for (const idx of targets) {
        const tr = Math.floor(idx / cols);
        const tc = idx % cols;
        const tt = tiles[tr][tc];
        if (tt.rule === 'portal' && tt.portalChannel && portalMap[tt.portalChannel]) {
          for (const twin of portalMap[tt.portalChannel]) {
            if (twin.r !== tr || twin.c !== tc) {
              expanded.add(twin.r * cols + twin.c);
            }
          }
        }
      }

      outDegree[r][c] = expanded.size;
      totalEdges += expanded.size;
      const fromIdx = r * cols + c;
      for (const toIdx of expanded) {
        const tr = Math.floor(toIdx / cols);
        const tc = toIdx % cols;
        revAdj[tr][tc].push(fromIdx);
      }
    }
  }

  const distToPromo: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 99)
  );
  if (promoGoals.length > 0 && !def.rules.royal) {
    const queue: { r: number; c: number }[] = [];
    for (const g of promoGoals) {
      distToPromo[g.r][g.c] = 0;
      queue.push(g);
    }
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const nextDist = distToPromo[cur.r][cur.c] + 1;
      for (const prevIdx of revAdj[cur.r][cur.c]) {
        const pr = Math.floor(prevIdx / cols);
        const pc = prevIdx % cols;
        if (nextDist < distToPromo[pr][pc]) {
          distToPromo[pr][pc] = nextDist;
          queue.push({ r: pr, c: pc });
        }
      }
    }
  }

  let maxDeg = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (outDegree[r][c] > maxDeg) maxDeg = outDegree[r][c];
    }
  }

  const pst: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = tiles[r][c];
      if (isImpassableTile(t)) {
        pst[r][c] = 0;
        continue;
      }

      const centrality = outDegree[r][c] / maxDeg;
      const promoScore =
        promoGoals.length > 0 && distToPromo[r][c] < 99
          ? 1 / (1 + distToPromo[r][c] * 0.45)
          : 0;

      const advance =
        color === 'white'
          ? (rows - 1 - r) / Math.max(1, rows - 1)
          : color === 'black'
            ? r / Math.max(1, rows - 1)
            : color === 'red'
              ? c / Math.max(1, cols - 1)
              : (cols - 1 - c) / Math.max(1, cols - 1);

      const sanctuaryBonus = t.rule === 'sanctuary' ? 0.35 : 0;
      const portalBonus = t.rule === 'portal' ? 0.12 : 0;
      const boostBonus = t.rule === 'boost' ? 0.18 : 0;
      const summitBonus = t.rule === 'summit' && def.rules.royal ? 0.6 : 0;
      const hazardPenalty =
        t.rule === 'fallow' ? -0.1 : t.rule === 'trap' && !def.rules.royal && !def.rules.iron ? -0.45 : 0;

      let score: number;
      if (def.rules.royal) {
        score = 0.35 * (1 - advance * 0.5) + 0.35 * centrality + sanctuaryBonus * 1.4 + summitBonus + hazardPenalty;
      } else if (def.rules.pawnDoubleStep || (def.hops.length > 0 && Object.keys(def.slides).length === 0 && promoGoals.length > 0)) {
        score = 0.3 * centrality + 0.5 * promoScore + 0.2 * advance + sanctuaryBonus + portalBonus + boostBonus + hazardPenalty;
      } else {
        score = 0.62 * centrality + 0.18 * promoScore + 0.12 * advance + sanctuaryBonus + portalBonus + boostBonus + hazardPenalty;
      }

      pst[r][c] = Math.max(0.02, Math.min(1, Number(score.toFixed(3))));
    }
  }

  return { totalEdges, pst };
}

/**
 * Evaluates a position from `perspective`'s point of view (+ = perspective winning).
 * In Antichess, the sign is flipped so losing pieces is rewarded!
 */
export function evaluatePosition(
  tiles: TileConfig[][],
  grid: (import('./types').PlacedPiece | null)[][],
  analysis: BoardGraphAnalysis,
  registry: PieceRegistry,
  perspective: Color = 'white',
  isAntichess = false
): number {
  const rows = tiles.length;
  const cols = tiles[0].length;
  const totals: Record<Color, number> = { white: 0, black: 0, red: 0, blue: 0 };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (!p) continue;
      const m = analysis.metricsByPiece[p.pieceId];
      const mat = m ? m.materialValue : 150;
      const pstVal = m?.pstByColor[p.color]?.[r]?.[c] ?? 0.5;
      const posBonus = Math.round(pstVal * (registry[p.pieceId]?.rules.royal ? 95 : 75));
      totals[p.color] += mat + posBonus;
    }
  }

  let bestEnemy = 0;
  for (const col of ALL_COLORS) {
    if (col !== perspective && totals[col] > bestEnemy) {
      bestEnemy = totals[col];
    }
  }

  const diff = totals[perspective] - bestEnemy;
  return isAntichess ? -diff : diff;
}

function scoreMoveForOrdering(move: Move, analysis: BoardGraphAnalysis): number {
  let score = 0;
  if (move.captured) {
    const victimVal = analysis.metricsByPiece[move.captured.pieceId]?.materialValue ?? 200;
    score += 10000 + victimVal * 10;
    if (move.isRangedCapture) score += 400;
  }
  if (move.promotedTo) score += 8000;
  if (move.portalExit) score += 250;
  return score;
}

export interface AISearchResult {
  bestMove: Move | null;
  score: number;
  nodesSearched: number;
  depthReached: number;
  analysis: BoardGraphAnalysis;
}

export function chooseAIMove(
  state: GameState,
  registry: PieceRegistry,
  difficulty: AIDifficulty,
  cachedAnalysis?: BoardGraphAnalysis
): AISearchResult {
  const rules = getBoardRules(state.boardDef);
  const isAntichess = rules.winCondition === 'antichess';
  const pieceIds = collectBoardPieceIds(state.boardDef, state.grid, registry);
  const analysis = cachedAnalysis ?? analyzeBoardGraph(state.tiles, pieceIds, registry);

  const legalMoves = generateLegalMoves(
    state.tiles,
    state.grid,
    state.turn,
    registry,
    rules,
    state.enPassantTarget,
    state.lostByColor
  );
  if (legalMoves.length === 0) {
    return { bestMove: null, score: 0, nodesSearched: 0, depthReached: 0, analysis };
  }

  const aiColor = state.turn;
  const isMulti = state.players.length > 2;
  const config =
    difficulty === 'novice'
      ? { maxDepth: 2, timeBudgetMs: 160, noise: 65 }
      : difficulty === 'tactician'
        ? { maxDepth: isMulti ? 2 : 3, timeBudgetMs: 360, noise: 12 }
        : { maxDepth: isMulti ? 3 : 4, timeBudgetMs: 650, noise: 0 };

  const deadline = performance.now() + config.timeBudgetMs;
  let nodesSearched = 0;

  const ordered = [...legalMoves].sort(
    (a, b) => scoreMoveForOrdering(b, analysis) - scoreMoveForOrdering(a, analysis)
  );

  let bestMove = ordered[0];
  let bestScore = -Infinity;
  let depthReached = 1;

  function paranoidAlphaBeta(
    tiles: TileConfig[][],
    grid: (import('./types').PlacedPiece | null)[][],
    depth: number,
    alpha: number,
    beta: number,
    turn: Color
  ): number {
    nodesSearched++;
    if (depth === 0 || performance.now() > deadline) {
      return evaluatePosition(tiles, grid, analysis, registry, aiColor, isAntichess);
    }

    const moves = generateLegalMoves(tiles, grid, turn, registry, rules);
    if (moves.length === 0) {
      const inCheck = isColorInCheck(tiles, grid, turn, registry, rules);
      if (isAntichess) {
        return turn === aiColor ? 100000 + depth * 100 : -100000 - depth * 100;
      }
      if (inCheck) {
        return turn === aiColor ? -100000 - depth * 100 : 100000 + depth * 100;
      }
      return 0;
    }

    moves.sort((a, b) => scoreMoveForOrdering(b, analysis) - scoreMoveForOrdering(a, analysis));
    const nextTurn = nextActiveColor(turn, state.players, state.eliminatedPlayers);

    if (turn === aiColor) {
      let value = -Infinity;
      for (const m of moves) {
        const next = applyMoveToBoard(tiles, grid, m, registry);
        const child = paranoidAlphaBeta(next.tiles, next.grid, depth - 1, alpha, beta, nextTurn);
        if (child > value) value = child;
        if (value > alpha) alpha = value;
        if (alpha >= beta) break;
      }
      return value;
    } else {
      let value = Infinity;
      for (const m of moves) {
        const next = applyMoveToBoard(tiles, grid, m, registry);
        const child = paranoidAlphaBeta(next.tiles, next.grid, depth - 1, alpha, beta, nextTurn);
        if (child < value) value = child;
        if (value < beta) beta = value;
        if (alpha >= beta) break;
      }
      return value;
    }
  }

  const nextAfterRoot = nextActiveColor(aiColor, state.players, state.eliminatedPlayers);

  for (let depth = 1; depth <= config.maxDepth; depth++) {
    if (depth > 1 && performance.now() > deadline) break;
    let iterBestMove = ordered[0];
    let iterBestScore = -Infinity;

    for (const m of ordered) {
      if (depth > 1 && performance.now() > deadline) break;
      const next = applyMoveToBoard(state.tiles, state.grid, m, registry);
      let score = paranoidAlphaBeta(
        next.tiles,
        next.grid,
        depth - 1,
        -Infinity,
        Infinity,
        nextAfterRoot
      );
      if (config.noise > 0) {
        score += (Math.random() - 0.5) * config.noise;
      }
      if (score > iterBestScore) {
        iterBestScore = score;
        iterBestMove = m;
      }
    }

    bestMove = iterBestMove;
    bestScore = iterBestScore;
    depthReached = depth;
  }

  return {
    bestMove,
    score: Math.round(aiColor === 'white' ? bestScore : -bestScore),
    nodesSearched,
    depthReached,
    analysis,
  };
}

export function collectBoardPieceIds(
  boardDef: BoardDefinition,
  grid: (import('./types').PlacedPiece | null)[][],
  registry: PieceRegistry
): string[] {
  const ids = new Set<string>();
  for (const row of grid) {
    for (const p of row) {
      if (p) ids.add(p.pieceId);
    }
  }
  for (const row of boardDef.tiles) {
    for (const t of row) {
      if (t.promoteToPieceId && registry[t.promoteToPieceId]) {
        ids.add(t.promoteToPieceId);
      }
    }
  }
  if (registry['queen']) ids.add('queen');
  return Array.from(ids);
}
