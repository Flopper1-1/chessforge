import {
  AIDifficulty,
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
  isColorInCheck,
  oppositeColor,
  PieceRegistry,
} from './rules';

function flipDir(dir: Direction8, color: Color): Direction8 {
  if (color === 'white') return dir;
  const map: Record<Direction8, Direction8> = {
    N: 'S', NE: 'SE', E: 'E', SE: 'NE', S: 'N', SW: 'NW', W: 'W', NW: 'SW',
  };
  return map[dir];
}

/**
 * Graph-Theory Board & Piece Analyzer
 * Builds a directed movement graph G = (V, E) for each piece type on the arbitrary
 * board topology, computing:
 * 1) Dynamic material values from average out-degree (mobility) + special rule modifiers.
 * 2) Dynamic Piece-Square Tables (PSTs) from local graph centrality, BFS distance to
 *    promotion zones, Sanctuary safety, and Portal connectivity.
 */
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
      if (t.rule !== 'void') activeTileCount++;
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

    const avgMobility =
      activeTileCount > 0
        ? (whiteGraph.totalEdges + blackGraph.totalEdges) / (2 * activeTileCount)
        : 0;

    // Dynamic material valuation (in centipawns, roughly scaled to classic chess: Pawn ~100, Knight ~320, Rook ~500, Queen ~900)
    let value = Math.round(avgMobility * 42);
    if (def.hops.length > 0) value += Math.min(140, def.hops.length * 16); // leaping ignores blockers
    if (def.rules.rangedAttack) value += 210; // capturing without risking piece
    if (def.rules.iron) value += 360; // immune to normal captures
    if (def.rules.blacksmith) value += 130; // counters Iron
    if (def.rules.pawnDoubleStep) value += 35;
    if (def.rules.royal) value = 20000;
    else value = Math.max(85, value);

    metricsByPiece[pid] = {
      pieceId: pid,
      materialValue: value,
      avgMobility: Number(avgMobility.toFixed(2)),
      pstWhite: whiteGraph.pst,
      pstBlack: blackGraph.pst,
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

/**
 * Estimates a piece's standalone value on a standard 8x8 board (used live in Piece Forge).
 */
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
  const dirSign = color === 'white' ? 1 : -1;

  // Reverse adjacency list for BFS from promotion goals
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
      if (t.rule === 'void') continue;
      if (
        !def.rules.royal &&
        t.rule === 'promotion' &&
        (t.promotionFor === 'both' || t.promotionFor === color) &&
        (t.promoteToPieceId || 'queen') !== def.id
      ) {
        promoGoals.push({ r, c });
      }

      const targets = new Set<number>();

      // Hops
      for (const hop of def.hops) {
        const tr = r + hop.dr * dirSign;
        const tc = c + hop.dc;
        if (tr >= 0 && tr < rows && tc >= 0 && tc < cols && tiles[tr][tc].rule !== 'void') {
          targets.add(tr * cols + tc);
        }
      }

      // Slides
      for (const [rawDir, maxDist] of Object.entries(def.slides) as [Direction8, number | undefined][]) {
        if (!maxDist || maxDist <= 0) continue;
        const actual = flipDir(rawDir, color);
        const { dr, dc } = DIRECTIONS_8[actual];
        for (let step = 1; step <= maxDist; step++) {
          const tr = r + dr * step;
          const tc = c + dc * step;
          if (tr < 0 || tr >= rows || tc < 0 || tc >= cols || tiles[tr][tc].rule === 'void') {
            break;
          }
          targets.add(tr * cols + tc);
        }
      }

      // Portal edges: landing on a portal connects to its twin
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

  // BFS shortest distance to promotion goals (if any exist for this piece)
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

  // Combine centrality + promotion proximity + sanctuary/portal bonuses into 0..1 heatmap
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
      if (t.rule === 'void') {
        pst[r][c] = 0;
        continue;
      }

      const centrality = outDegree[r][c] / maxDeg;
      const promoScore =
        promoGoals.length > 0 && distToPromo[r][c] < 99
          ? 1 / (1 + distToPromo[r][c] * 0.45)
          : 0;

      // Slight forward advancement bonus for non-royals, safety/shelter for royals
      const advance = color === 'white' ? (rows - 1 - r) / Math.max(1, rows - 1) : r / Math.max(1, rows - 1);
      const sanctuaryBonus = t.rule === 'sanctuary' ? 0.35 : 0;
      const portalBonus = t.rule === 'portal' ? 0.12 : 0;
      const fallowPenalty = t.rule === 'fallow' ? -0.1 : 0;

      let score: number;
      if (def.rules.royal) {
        // Royals prefer Sanctuaries and moderate shelter over reckless exposure
        score = 0.35 * (1 - advance * 0.5) + 0.35 * centrality + sanctuaryBonus * 1.4 + fallowPenalty;
      } else if (def.rules.pawnDoubleStep || (def.hops.length > 0 && Object.keys(def.slides).length === 0 && promoGoals.length > 0)) {
        // Pawn-like / advancing pieces weight promotion BFS heavily
        score = 0.3 * centrality + 0.5 * promoScore + 0.2 * advance + sanctuaryBonus + portalBonus + fallowPenalty;
      } else {
        score = 0.62 * centrality + 0.18 * promoScore + 0.12 * advance + sanctuaryBonus + portalBonus + fallowPenalty;
      }

      pst[r][c] = Math.max(0.02, Math.min(1, Number(score.toFixed(3))));
    }
  }

  return { totalEdges, pst };
}

/**
 * Evaluates a board position from White's perspective (+ = White winning, - = Black winning).
 */
export function evaluatePosition(
  tiles: TileConfig[][],
  grid: (import('./types').PlacedPiece | null)[][],
  analysis: BoardGraphAnalysis,
  registry: PieceRegistry
): number {
  const rows = tiles.length;
  const cols = tiles[0].length;
  let score = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (!p) continue;
      const m = analysis.metricsByPiece[p.pieceId];
      const mat = m ? m.materialValue : 150;
      const pstVal = m
        ? p.color === 'white'
          ? m.pstWhite[r]?.[c] ?? 0.5
          : m.pstBlack[r]?.[c] ?? 0.5
        : 0.5;
      // Positional bonus scaled up to ~75 centipawns (or 120 on Sanctuary)
      const posBonus = Math.round(pstVal * (registry[p.pieceId]?.rules.royal ? 95 : 75));
      if (p.color === 'white') {
        score += mat + posBonus;
      } else {
        score -= mat + posBonus;
      }
    }
  }
  return score;
}

function scoreMoveForOrdering(move: Move, analysis: BoardGraphAnalysis): number {
  let score = 0;
  if (move.captured) {
    const victimVal = analysis.metricsByPiece[move.captured.pieceId]?.materialValue ?? 200;
    score += 10000 + victimVal * 10;
    if (move.isRangedCapture) score += 400; // free ranged capture!
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
  const pieceIds = collectBoardPieceIds(state.boardDef, state.grid, registry);
  const analysis = cachedAnalysis ?? analyzeBoardGraph(state.tiles, pieceIds, registry);

  const legalMoves = generateLegalMoves(state.tiles, state.grid, state.turn, registry);
  if (legalMoves.length === 0) {
    return { bestMove: null, score: 0, nodesSearched: 0, depthReached: 0, analysis };
  }

  // Novice plays depth 1-2 with slight randomness so beginners can win Adventure Island 1!
  const config =
    difficulty === 'novice'
      ? { maxDepth: 2, timeBudgetMs: 180, noise: 65 }
      : difficulty === 'tactician'
        ? { maxDepth: 3, timeBudgetMs: 420, noise: 12 }
        : { maxDepth: 4, timeBudgetMs: 750, noise: 0 };

  const deadline = performance.now() + config.timeBudgetMs;
  let nodesSearched = 0;
  const maximizing = state.turn === 'white';

  const ordered = [...legalMoves].sort(
    (a, b) => scoreMoveForOrdering(b, analysis) - scoreMoveForOrdering(a, analysis)
  );

  let bestMove = ordered[0];
  let bestScore = maximizing ? -Infinity : Infinity;
  let depthReached = 1;

  function alphabeta(
    tiles: TileConfig[][],
    grid: (import('./types').PlacedPiece | null)[][],
    depth: number,
    alpha: number,
    beta: number,
    turn: Color
  ): number {
    nodesSearched++;
    if (depth === 0 || performance.now() > deadline) {
      return evaluatePosition(tiles, grid, analysis, registry);
    }

    const moves = generateLegalMoves(tiles, grid, turn, registry);
    if (moves.length === 0) {
      const inCheck = isColorInCheck(tiles, grid, turn, registry);
      if (inCheck) {
        return turn === 'white' ? -100000 - depth * 100 : 100000 + depth * 100;
      }
      return 0; // stalemate
    }

    moves.sort((a, b) => scoreMoveForOrdering(b, analysis) - scoreMoveForOrdering(a, analysis));

    if (turn === 'white') {
      let value = -Infinity;
      for (const m of moves) {
        const next = applyMoveToBoard(tiles, grid, m);
        const child = alphabeta(next.tiles, next.grid, depth - 1, alpha, beta, 'black');
        if (child > value) value = child;
        if (value > alpha) alpha = value;
        if (alpha >= beta) break;
      }
      return value;
    } else {
      let value = Infinity;
      for (const m of moves) {
        const next = applyMoveToBoard(tiles, grid, m);
        const child = alphabeta(next.tiles, next.grid, depth - 1, alpha, beta, 'white');
        if (child < value) value = child;
        if (value < beta) beta = value;
        if (alpha >= beta) break;
      }
      return value;
    }
  }

  for (let depth = 1; depth <= config.maxDepth; depth++) {
    if (depth > 1 && performance.now() > deadline) break;
    let iterBestMove = ordered[0];
    let iterBestScore = maximizing ? -Infinity : Infinity;

    for (const m of ordered) {
      if (depth > 1 && performance.now() > deadline) break;
      const next = applyMoveToBoard(state.tiles, state.grid, m);
      let score = alphabeta(
        next.tiles,
        next.grid,
        depth - 1,
        -Infinity,
        Infinity,
        oppositeColor(state.turn)
      );
      if (config.noise > 0) {
        score += (Math.random() - 0.5) * config.noise;
      }
      if (maximizing) {
        if (score > iterBestScore) {
          iterBestScore = score;
          iterBestMove = m;
        }
      } else {
        if (score < iterBestScore) {
          iterBestScore = score;
          iterBestMove = m;
        }
      }
    }

    bestMove = iterBestMove;
    bestScore = iterBestScore;
    depthReached = depth;
  }

  return {
    bestMove,
    score: Math.round(bestScore),
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
