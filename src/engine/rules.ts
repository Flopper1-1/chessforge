import {
  ALL_COLORS,
  BoardDefinition,
  BoardRuleSettings,
  Color,
  COLOR_LABELS,
  Coord,
  DEFAULT_BOARD_RULES,
  Direction8,
  DIRECTIONS_8,
  GameState,
  Move,
  PieceDefinition,
  PlacedPiece,
  PortalChannel,
  TileConfig,
} from './types';

export type PieceRegistry = Record<string, PieceDefinition>;

export function getBoardPlayers(boardDef: BoardDefinition): Color[] {
  if (boardDef.players && boardDef.players.length >= 2) {
    return boardDef.players;
  }
  const present = new Set<Color>();
  for (const row of boardDef.initialPieces) {
    for (const p of row) {
      if (p) present.add(p.color);
    }
  }
  const ordered = ALL_COLORS.filter((c) => present.has(c));
  return ordered.length >= 2 ? ordered : ['white', 'black'];
}

export function nextActiveColor(
  current: Color,
  players: Color[],
  eliminated: Color[]
): Color {
  const idx = players.indexOf(current);
  for (let i = 1; i <= players.length; i++) {
    const candidate = players[(idx + i) % players.length];
    if (!eliminated.includes(candidate)) return candidate;
  }
  return current;
}

export function getBoardRules(boardDef: BoardDefinition): BoardRuleSettings {
  return {
    ...DEFAULT_BOARD_RULES,
    ...(boardDef.rules ?? {}),
    promotionPool:
      boardDef.rules?.promotionPool && boardDef.rules.promotionPool.length > 0
        ? boardDef.rules.promotionPool
        : DEFAULT_BOARD_RULES.promotionPool,
  };
}

export function coordToAlgebraic(r: number, c: number, rows: number): string {
  const file = String.fromCharCode(97 + c);
  const rank = rows - r;
  return `${file}${rank}`;
}

export function cloneTiles(tiles: TileConfig[][]): TileConfig[][] {
  return tiles.map((row) => row.map((t) => ({ ...t })));
}

export function cloneGrid(grid: (PlacedPiece | null)[][]): (PlacedPiece | null)[][] {
  return grid.map((row) => row.map((p) => (p ? { ...p } : null)));
}

export function emptyColorMap<T>(factory: () => T): Record<Color, T> {
  return {
    white: factory(),
    black: factory(),
    red: factory(),
    blue: factory(),
  };
}

export function computePositionHash(
  grid: (PlacedPiece | null)[][],
  turn: Color,
  enPassantTarget?: GameState['enPassantTarget']
): string {
  const rows = grid.length;
  const cols = grid[0].length;
  const parts: string[] = [turn[0]];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (p) {
        parts.push(`${r},${c}:${p.color[0]}${p.pieceId}${p.hasMoved ? '1' : '0'}`);
      }
    }
  }
  if (enPassantTarget) {
    parts.push(`ep:${enPassantTarget.targetSquare.r},${enPassantTarget.targetSquare.c}`);
  }
  return parts.join('|');
}

/**
 * Rotates a White-relative (dr, dc) offset into the given player's forward orientation:
 * - white: North (-1, 0)
 * - black: South (+1, 0)
 * - red:   East  (0, +1)
 * - blue:  West  (0, -1)
 */
export function rotateOffsetForColor(
  dr: number,
  dc: number,
  color: Color
): { dr: number; dc: number } {
  switch (color) {
    case 'white':
      return { dr, dc };
    case 'black':
      return { dr: -dr, dc: -dc };
    case 'red':
      return { dr: dc, dc: -dr };
    case 'blue':
      return { dr: -dc, dc: dr };
  }
}

export function rotateDirectionForColor(dir: Direction8, color: Color): Direction8 {
  if (color === 'white') return dir;
  const ring: Direction8[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = ring.indexOf(dir);
  const shift = color === 'red' ? 2 : color === 'black' ? 4 : 6;
  return ring[(idx + shift) % 8];
}

export function createInitialGameState(
  boardDef: BoardDefinition,
  registry: PieceRegistry
): GameState {
  const tiles = cloneTiles(boardDef.tiles);
  const grid = cloneGrid(boardDef.initialPieces);
  const players = getBoardPlayers(boardDef);
  const firstTurn = players[0] ?? 'white';
  const hash = computePositionHash(grid, firstTurn, null);
  const base: GameState = {
    boardDef,
    tiles,
    grid,
    players,
    eliminatedPlayers: [],
    turn: firstTurn,
    moveHistory: [],
    capturedByColor: emptyColorMap(() => []),
    lostByColor: emptyColorMap(() => []),
    checksDelivered: emptyColorMap(() => 0),
    status: 'playing',
    halfMoveClock: 0,
    enPassantTarget: null,
    positionCounts: { [hash]: 1 },
  };
  return evaluateGameStatus(base, registry);
}

export function isImpassableTile(tile: TileConfig): boolean {
  return tile.rule === 'void' || tile.rule === 'wall';
}

export function canCaptureTarget(
  attackerDef: PieceDefinition,
  _targetPiece: PlacedPiece,
  targetDef: PieceDefinition,
  targetTile: TileConfig
): boolean {
  if (targetTile.rule === 'sanctuary') return false;
  if (targetDef.rules.iron && !attackerDef.rules.blacksmith) return false;
  return true;
}

export function findPortalExit(
  tiles: TileConfig[][],
  grid: (PlacedPiece | null)[][],
  from: Coord,
  channel: PortalChannel
): Coord | undefined {
  const rows = tiles.length;
  const cols = tiles[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === from.r && c === from.c) continue;
      const t = tiles[r][c];
      if (t.rule === 'portal' && t.portalChannel === channel && !grid[r][c]) {
        return { r, c };
      }
    }
  }
  return undefined;
}

function getPromotionOptions(
  def: PieceDefinition,
  color: Color,
  tile: TileConfig,
  rules: BoardRuleSettings,
  registry: PieceRegistry,
  lostByColor?: Record<Color, PlacedPiece[]>,
  triggeredByCapture = false
): string[] | undefined {
  if (def.rules.royal || def.rules.canPromote === false) return undefined;

  const onPromoTile =
    tile.rule === 'promotion' &&
    (tile.promotionFor === 'both' || tile.promotionFor === 'all' || tile.promotionFor === color);

  const shouldPromote = onPromoTile || (triggeredByCapture && rules.promoteOnCapture);
  if (!shouldPromote) return undefined;

  if (onPromoTile && tile.promoteToPieceId && registry[tile.promoteToPieceId]) {
    return def.id === tile.promoteToPieceId ? undefined : [tile.promoteToPieceId];
  }

  let pool: string[];
  if (rules.promotionMode === 'all_non_royal') {
    pool = Object.values(registry)
      .filter((p) => !p.rules.royal && p.id !== def.id)
      .map((p) => p.id);
  } else if (rules.promotionMode === 'captured_only') {
    const lost = lostByColor?.[color] ?? [];
    const uniqueLost = Array.from(
      new Set(lost.map((p) => p.pieceId).filter((pid) => registry[pid] && !registry[pid].rules.royal && pid !== def.id))
    );
    pool = uniqueLost;
  } else if (rules.promotionMode === 'random_pool') {
    const valid = rules.promotionPool.filter(
      (pid) => registry[pid] && !registry[pid].rules.royal && pid !== def.id
    );
    if (valid.length === 0) return undefined;
    // Deterministic pick per position/tile or random pick at execution time:
    const pick = valid[Math.floor(Math.random() * valid.length)];
    return [pick];
  } else {
    pool = rules.promotionPool.filter(
      (pid) => registry[pid] && !registry[pid].rules.royal && pid !== def.id
    );
  }

  return pool.length > 0 ? pool : undefined;
}

function formatNotation(
  def: PieceDefinition,
  from: Coord,
  to: Coord,
  rows: number,
  isCapture: boolean,
  isRanged: boolean,
  portalExit?: Coord,
  promotedTo?: string,
  castlingSide?: 'kingside' | 'queenside',
  isEnPassant?: boolean
): string {
  if (castlingSide) {
    return castlingSide === 'kingside' ? 'O-O' : 'O-O-O';
  }
  const fromStr = coordToAlgebraic(from.r, from.c, rows);
  const toStr = coordToAlgebraic(to.r, to.c, rows);
  const sep = isRanged ? '->x' : isCapture ? 'x' : '-';
  let out = `${def.shortCode}${fromStr}${sep}${toStr}`;
  if (isEnPassant) out += ' e.p.';
  if (portalExit) {
    out += `>${coordToAlgebraic(portalExit.r, portalExit.c, rows)}`;
  }
  if (promotedTo) {
    out += `=${promotedTo[0].toUpperCase()}`;
  }
  return out;
}

function isAttackingSquare(
  def: PieceDefinition,
  color: Color,
  from: Coord,
  to: Coord
): boolean {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  for (const h of def.hops) {
    const rot = rotateOffsetForColor(h.dr, h.dc, color);
    if (rot.dr === dr && rot.dc === dc) {
      return h.mode === 'both' || h.mode === 'capture' || h.mode === 'ranged';
    }
  }
  return true;
}

/**
 * Checks whether a target square is attacked by any opponent of `defenderColor`.
 */
export function isSquareAttackedByEnemies(
  tiles: TileConfig[][],
  grid: (PlacedPiece | null)[][],
  target: Coord,
  defenderColor: Color,
  registry: PieceRegistry,
  rules: BoardRuleSettings
): boolean {
  const rows = tiles.length;
  const cols = tiles[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (!p || p.color === defenderColor) continue;
      const moves = generatePseudoMovesForSquare(tiles, grid, r, c, registry, rules, null, true);
      for (const m of moves) {
        if (m.to.r === target.r && m.to.c === target.c && !m.castling && !m.isSwap) {
          const def = registry[p.pieceId];
          if (!def) continue;
          if (m.captured || isAttackingSquare(def, p.color, { r, c }, target)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

export function generatePseudoMovesForSquare(
  tiles: TileConfig[][],
  grid: (PlacedPiece | null)[][],
  r: number,
  c: number,
  registry: PieceRegistry,
  rules: BoardRuleSettings,
  enPassantTarget?: GameState['enPassantTarget'],
  skipCastling = false,
  lostByColor?: Record<Color, PlacedPiece[]>
): Move[] {
  const piece = grid[r]?.[c];
  if (!piece) return [];
  const def = registry[piece.pieceId];
  if (!def) return [];

  const rows = tiles.length;
  const cols = tiles[0].length;
  const moves: Move[] = [];

  const pushMoveWithPromotions = (
    base: Omit<Move, 'promotedTo' | 'notation'>,
    isCapture: boolean,
    isRanged: boolean
  ) => {
    const finalCoord = isRanged ? base.from : (base.portalExit ?? base.to);
    const finalTile = tiles[finalCoord.r][finalCoord.c];
    const promoOpts = isRanged
      ? undefined
      : getPromotionOptions(def, piece.color, finalTile, rules, registry, lostByColor, isCapture);

    if (promoOpts && promoOpts.length > 0) {
      for (const pid of promoOpts) {
        moves.push({
          ...base,
          promotedTo: pid,
          promotionOptions: promoOpts.length > 1 ? promoOpts : undefined,
          notation: formatNotation(
            def,
            base.from,
            base.to,
            rows,
            isCapture,
            isRanged,
            base.portalExit,
            pid,
            base.castling?.side,
            Boolean(base.enPassantCaptureCoord)
          ),
        });
      }
    } else {
      moves.push({
        ...base,
        notation: formatNotation(
          def,
          base.from,
          base.to,
          rows,
          isCapture,
          isRanged,
          base.portalExit,
          undefined,
          base.castling?.side,
          Boolean(base.enPassantCaptureCoord)
        ),
      });
    }
  };

  const tryAddMove = (
    tr: number,
    tc: number,
    allowMove: boolean,
    allowCapture: boolean,
    isDoubleStep = false,
    forceRanged = false
  ) => {
    if (tr < 0 || tr >= rows || tc < 0 || tc >= cols) return 'oob';
    const targetTile = tiles[tr][tc];
    if (isImpassableTile(targetTile)) return 'void';

    const computePostLanding = (landR: number, landC: number): { exit?: Coord; isIce?: boolean } => {
      const lt = tiles[landR][landC];
      if (lt.rule === 'portal' && lt.portalChannel) {
        const exit = findPortalExit(tiles, grid, { r: landR, c: landC }, lt.portalChannel);
        return { exit };
      }
      if (lt.rule === 'ice') {
        const sr = Math.sign(landR - r);
        const sc = Math.sign(landC - c);
        const nr = landR + sr;
        const nc = landC + sc;
        if (
          (sr !== 0 || sc !== 0) &&
          nr >= 0 &&
          nr < rows &&
          nc >= 0 &&
          nc < cols &&
          !isImpassableTile(tiles[nr][nc]) &&
          !grid[nr][nc]
        ) {
          return { exit: { r: nr, c: nc }, isIce: true };
        }
      }
      return {};
    };

    const occupant = grid[tr][tc];
    if (!occupant) {
      if (allowMove) {
        const post = computePostLanding(tr, tc);
        pushMoveWithPromotions(
          {
            from: { r, c },
            to: { r: tr, c: tc },
            portalExit: post.exit,
            isIceSlide: post.isIce,
            isDoubleStep,
          },
          false,
          false
        );
      }
      return 'empty';
    }

    const isFriendly = occupant.color === piece.color;
    const targetDef = registry[occupant.pieceId];
    if (isFriendly) {
      // Optional Friendly Fire rule (cannot capture own Royal)
      if (rules.friendlyFire && allowCapture && targetDef && !targetDef.rules.royal && canCaptureTarget(def, occupant, targetDef, targetTile)) {
        const isRanged = forceRanged || Boolean(def.rules.rangedAttack);
        const post = isRanged ? {} : computePostLanding(tr, tc);
        pushMoveWithPromotions(
          {
            from: { r, c },
            to: { r: tr, c: tc },
            portalExit: post.exit,
            isIceSlide: post.isIce,
            isRangedCapture: isRanged,
            captured: occupant,
          },
          true,
          isRanged
        );
      }
      return 'friendly';
    }

    // Enemy piece
    if (allowCapture && targetDef && canCaptureTarget(def, occupant, targetDef, targetTile)) {
      const isRanged = forceRanged || Boolean(def.rules.rangedAttack);
      const post = isRanged ? {} : computePostLanding(tr, tc);
      pushMoveWithPromotions(
        {
          from: { r, c },
          to: { r: tr, c: tc },
          portalExit: post.exit,
          isIceSlide: post.isIce,
          isRangedCapture: isRanged,
          captured: occupant,
        },
        true,
        isRanged
      );
    }
    return 'enemy';
  };

  // 1. Hops (7x7 relative offsets, rotated per player color)
  for (const hop of def.hops) {
    const rot = rotateOffsetForColor(hop.dr, hop.dc, piece.color);
    const tr = r + rot.dr;
    const tc = c + rot.dc;
    if (hop.mode === 'first_move') {
      if (!piece.hasMoved) {
        tryAddMove(tr, tc, true, false, Math.abs(hop.dr) >= 2 || Math.abs(hop.dc) >= 2);
      }
    } else if (hop.mode === 'en_passant') {
      if (
        rules.enPassantEnabled &&
        enPassantTarget &&
        enPassantTarget.pawnColor !== piece.color &&
        enPassantTarget.targetSquare.r === tr &&
        enPassantTarget.targetSquare.c === tc &&
        tr >= 0 &&
        tr < rows &&
        tc >= 0 &&
        tc < cols &&
        !isImpassableTile(tiles[tr][tc]) &&
        !grid[tr][tc]
      ) {
        const epPawn = grid[enPassantTarget.pawnSquare.r]?.[enPassantTarget.pawnSquare.c];
        const epTile = tiles[enPassantTarget.pawnSquare.r]?.[enPassantTarget.pawnSquare.c];
        const targetDef = epPawn ? registry[epPawn.pieceId] : undefined;
        if (epPawn && epTile && targetDef && canCaptureTarget(def, epPawn, targetDef, epTile)) {
          pushMoveWithPromotions(
            {
              from: { r, c },
              to: { r: tr, c: tc },
              enPassantCaptureCoord: enPassantTarget.pawnSquare,
              captured: epPawn,
            },
            true,
            false
          );
        }
      }
    } else if (hop.mode === 'ranged') {
      tryAddMove(tr, tc, false, true, false, true);
    } else if (hop.mode === 'swap') {
      if (tr >= 0 && tr < rows && tc >= 0 && tc < cols && !isImpassableTile(tiles[tr][tc])) {
        const ally = grid[tr][tc];
        if (ally && ally.color === piece.color && !registry[ally.pieceId]?.rules.royal) {
          moves.push({
            from: { r, c },
            to: { r: tr, c: tc },
            isSwap: true,
            notation: `${def.shortCode}${coordToAlgebraic(r, c, rows)}<->${coordToAlgebraic(tr, tc, rows)}`,
          });
        }
      }
    } else {
      tryAddMove(
        tr,
        tc,
        hop.mode === 'both' || hop.mode === 'move',
        hop.mode === 'both' || hop.mode === 'capture'
      );
    }
  }

  // 1b. Boost tile bonus (+1 orthogonal step)
  if (tiles[r][c].rule === 'boost') {
    for (const [bdr, bdc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const tr = r + bdr;
      const tc = c + bdc;
      if (!moves.some((m) => m.to.r === tr && m.to.c === tc)) {
        tryAddMove(tr, tc, true, true);
      }
    }
  }

  // 2. Pawn-like first double step (rotated for all 4 player orientations)
  if (def.rules.pawnDoubleStep && !piece.hasMoved) {
    const fwd = rotateOffsetForColor(-1, 0, piece.color);
    const s1r = r + fwd.dr;
    const s1c = c + fwd.dc;
    const s2r = r + fwd.dr * 2;
    const s2c = c + fwd.dc * 2;
    if (
      s1r >= 0 && s1r < rows && s1c >= 0 && s1c < cols &&
      s2r >= 0 && s2r < rows && s2c >= 0 && s2c < cols &&
      !isImpassableTile(tiles[s1r][s1c]) &&
      !grid[s1r][s1c] &&
      !isImpassableTile(tiles[s2r][s2c]) &&
      !grid[s2r][s2c]
    ) {
      tryAddMove(s2r, s2c, true, false, true);
    }
  }

  // 3. Standard En Passant capture (works for all 4 player orientations)
  if (
    rules.enPassantEnabled &&
    (def.rules.enPassant || def.rules.pawnDoubleStep) &&
    enPassantTarget &&
    enPassantTarget.pawnColor !== piece.color
  ) {
    const ep = enPassantTarget.targetSquare;
    const diagLeft = rotateOffsetForColor(-1, -1, piece.color);
    const diagRight = rotateOffsetForColor(-1, 1, piece.color);
    const matchesDiag =
      (r + diagLeft.dr === ep.r && c + diagLeft.dc === ep.c) ||
      (r + diagRight.dr === ep.r && c + diagRight.dc === ep.c);

    if (matchesDiag && !isImpassableTile(tiles[ep.r][ep.c]) && !grid[ep.r][ep.c]) {
      const epPawn = grid[enPassantTarget.pawnSquare.r]?.[enPassantTarget.pawnSquare.c];
      const epTile = tiles[enPassantTarget.pawnSquare.r]?.[enPassantTarget.pawnSquare.c];
      const targetDef = epPawn ? registry[epPawn.pieceId] : undefined;
      if (epPawn && epTile && targetDef && canCaptureTarget(def, epPawn, targetDef, epTile)) {
        pushMoveWithPromotions(
          {
            from: { r, c },
            to: { r: ep.r, c: ep.c },
            enPassantCaptureCoord: enPassantTarget.pawnSquare,
            captured: epPawn,
          },
          true,
          false
        );
      }
    }
  }

  // 4. Sliding rays (8 directions rotated per player color)
  const slideEntries = Object.entries(def.slides) as [Direction8, number | undefined][];
  for (const [rawDir, maxDist] of slideEntries) {
    if (!maxDist || maxDist <= 0) continue;
    const actualDir = rotateDirectionForColor(rawDir, piece.color);
    const { dr, dc } = DIRECTIONS_8[actualDir];
    for (let step = 1; step <= maxDist; step++) {
      const tr = r + dr * step;
      const tc = c + dc * step;
      const res = tryAddMove(tr, tc, true, true);
      if (res === 'friendly' && def.rules.phasing) {
        continue;
      }
      if (res !== 'empty') break;
    }
  }

  // 5. Castling (horizontal for White/Black, vertical for Red/Blue!)
  if (
    !skipCastling &&
    rules.castlingEnabled &&
    (def.rules.castleKing || def.rules.royal) &&
    !piece.hasMoved &&
    !isSquareAttackedByEnemies(tiles, grid, { r, c }, piece.color, registry, rules)
  ) {
    const isVerticalAxis = piece.color === 'red' || piece.color === 'blue';
    for (const side of ['kingside', 'queenside'] as const) {
      const stepSign = side === 'kingside' ? 1 : -1;
      const drStep = isVerticalAxis ? stepSign : 0;
      const dcStep = isVerticalAxis ? 0 : stepSign;

      let rookCoord: Coord | null = null;
      let sr = r + drStep;
      let sc = c + dcStep;
      while (sr >= 0 && sr < rows && sc >= 0 && sc < cols) {
        if (isImpassableTile(tiles[sr][sc])) break;
        const occ = grid[sr][sc];
        if (occ) {
          const occDef = registry[occ.pieceId];
          if (
            occ.color === piece.color &&
            !occ.hasMoved &&
            occDef &&
            (occDef.rules.castleRook || occ.pieceId === 'rook')
          ) {
            rookCoord = { r: sr, c: sc };
          }
          break;
        }
        sr += drStep;
        sc += dcStep;
      }

      if (rookCoord) {
        const dist = Math.abs(rookCoord.r - r) + Math.abs(rookCoord.c - c);
        if (dist >= 2) {
          const kTarget = { r: r + drStep * 2, c: c + dcStep * 2 };
          const rTarget = { r: r + drStep, c: c + dcStep };
          if (
            kTarget.r >= 0 && kTarget.r < rows && kTarget.c >= 0 && kTarget.c < cols &&
            !isImpassableTile(tiles[kTarget.r][kTarget.c]) &&
            !isImpassableTile(tiles[rTarget.r][rTarget.c])
          ) {
            const passSafe = !isSquareAttackedByEnemies(tiles, grid, rTarget, piece.color, registry, rules);
            const landSafe = !isSquareAttackedByEnemies(tiles, grid, kTarget, piece.color, registry, rules);
            if (passSafe && landSafe) {
              moves.push({
                from: { r, c },
                to: kTarget,
                castling: {
                  rookFrom: rookCoord,
                  rookTo: rTarget,
                  side,
                },
                notation: side === 'kingside' ? 'O-O' : 'O-O-O',
              });
            }
          }
        }
      }
    }
  }

  return moves;
}

export function applyMoveToBoard(
  tiles: TileConfig[][],
  grid: (PlacedPiece | null)[][],
  move: Move,
  registry?: PieceRegistry
): { tiles: TileConfig[][]; grid: (PlacedPiece | null)[][]; blastCaptures: PlacedPiece[] } {
  const nextTiles = cloneTiles(tiles);
  const nextGrid = cloneGrid(grid);
  const blastCaptures: PlacedPiece[] = [];
  const moving = nextGrid[move.from.r][move.from.c];
  if (!moving) return { tiles: nextTiles, grid: nextGrid, blastCaptures };

  if (move.castling) {
    const rook = nextGrid[move.castling.rookFrom.r][move.castling.rookFrom.c];
    nextGrid[move.from.r][move.from.c] = null;
    nextGrid[move.castling.rookFrom.r][move.castling.rookFrom.c] = null;
    nextGrid[move.to.r][move.to.c] = { ...moving, hasMoved: true };
    if (rook) {
      nextGrid[move.castling.rookTo.r][move.castling.rookTo.c] = { ...rook, hasMoved: true };
    }
    return { tiles: nextTiles, grid: nextGrid, blastCaptures };
  }

  if (move.isSwap) {
    const ally = nextGrid[move.to.r][move.to.c];
    nextGrid[move.to.r][move.to.c] = { ...moving, hasMoved: true };
    nextGrid[move.from.r][move.from.c] = ally ? { ...ally, hasMoved: true } : null;
    return { tiles: nextTiles, grid: nextGrid, blastCaptures };
  }

  if (move.isRangedCapture) {
    nextGrid[move.to.r][move.to.c] = null;
    moving.hasMoved = true;
  } else {
    nextGrid[move.from.r][move.from.c] = null;
    if (move.enPassantCaptureCoord) {
      nextGrid[move.enPassantCaptureCoord.r][move.enPassantCaptureCoord.c] = null;
    }
    const finalCoord = move.portalExit ?? move.to;
    const updatedPiece: PlacedPiece = {
      ...moving,
      hasMoved: true,
      pieceId: move.promotedTo ?? moving.pieceId,
    };
    const finalTile = nextTiles[finalCoord.r][finalCoord.c];
    const movingDef = registry?.[updatedPiece.pieceId];

    if (finalTile.rule === 'trap') {
      nextTiles[finalCoord.r][finalCoord.c] = { rule: 'normal' };
      if (!movingDef?.rules.royal && !movingDef?.rules.iron) {
        blastCaptures.push(updatedPiece);
        nextGrid[finalCoord.r][finalCoord.c] = null;
      } else {
        nextGrid[finalCoord.r][finalCoord.c] = updatedPiece;
      }
    } else {
      nextGrid[finalCoord.r][finalCoord.c] = updatedPiece;
    }

    const attackerDef = registry?.[moving.pieceId];
    if (move.captured && attackerDef?.rules.explosive && registry) {
      const rows = nextTiles.length;
      const cols = nextTiles[0].length;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const br = finalCoord.r + dr;
          const bc = finalCoord.c + dc;
          if (br < 0 || br >= rows || bc < 0 || bc >= cols) continue;
          const adj = nextGrid[br][bc];
          if (!adj) continue;
          const adjDef = registry[adj.pieceId];
          if (adjDef?.rules.royal || adjDef?.rules.iron || nextTiles[br][bc].rule === 'sanctuary') {
            continue;
          }
          blastCaptures.push(adj);
          nextGrid[br][bc] = null;
        }
      }
    }

    const landedTile = nextTiles[move.to.r][move.to.c];
    if (landedTile.rule === 'fallow') {
      landedTile.fallowUses = Math.max(0, (landedTile.fallowUses ?? 1) - 1);
    }
    const departedTile = nextTiles[move.from.r][move.from.c];
    if (departedTile.rule === 'fallow' && (departedTile.fallowUses ?? 1) <= 0) {
      nextTiles[move.from.r][move.from.c] = { rule: 'void' };
    }
  }

  return { tiles: nextTiles, grid: nextGrid, blastCaptures };
}

export function isColorInCheck(
  tiles: TileConfig[][],
  grid: (PlacedPiece | null)[][],
  color: Color,
  registry: PieceRegistry,
  rules: BoardRuleSettings = DEFAULT_BOARD_RULES
): boolean {
  if (rules.winCondition === 'capture_the_king' || rules.winCondition === 'antichess') {
    return false;
  }
  const rows = tiles.length;
  const cols = tiles[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (p && p.color === color && registry[p.pieceId]?.rules.royal) {
        if (isSquareAttackedByEnemies(tiles, grid, { r, c }, color, registry, rules)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function generateLegalMoves(
  tiles: TileConfig[][],
  grid: (PlacedPiece | null)[][],
  color: Color,
  registry: PieceRegistry,
  rules: BoardRuleSettings = DEFAULT_BOARD_RULES,
  enPassantTarget?: GameState['enPassantTarget'],
  lostByColor?: Record<Color, PlacedPiece[]>
): Move[] {
  const rows = tiles.length;
  const cols = tiles[0].length;
  const legal: Move[] = [];
  const enforceCheckSafety =
    rules.winCondition !== 'capture_the_king' && rules.winCondition !== 'antichess';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (!p || p.color !== color) continue;
      const pseudo = generatePseudoMovesForSquare(
        tiles,
        grid,
        r,
        c,
        registry,
        rules,
        enPassantTarget,
        false,
        lostByColor
      );
      for (const m of pseudo) {
        if (!enforceCheckSafety) {
          legal.push(m);
        } else {
          const next = applyMoveToBoard(tiles, grid, m, registry);
          if (!isColorInCheck(next.tiles, next.grid, color, registry, rules)) {
            legal.push(m);
          }
        }
      }
    }
  }

  // Mandatory Capture rule (also automatically enforced in Antichess / Losing Chess)
  if (rules.mandatoryCapture || rules.winCondition === 'antichess') {
    const captures = legal.filter((m) => Boolean(m.captured));
    if (captures.length > 0) return captures;
  }

  return legal;
}

function clearPlayerPieces(grid: (PlacedPiece | null)[][], color: Color): (PlacedPiece | null)[][] {
  return grid.map((row) => row.map((p) => (p && p.color === color ? null : p)));
}

function isInsufficientMaterial(
  grid: (PlacedPiece | null)[][],
  registry: PieceRegistry
): boolean {
  const nonRoyals: PieceDefinition[] = [];
  for (const row of grid) {
    for (const p of row) {
      if (!p) continue;
      const def = registry[p.pieceId];
      if (!def) continue;
      if (!def.rules.royal) nonRoyals.push(def);
    }
  }
  if (nonRoyals.length === 0) return true;
  if (nonRoyals.length === 1 && (nonRoyals[0].id === 'bishop' || nonRoyals[0].id === 'knight')) {
    return true;
  }
  return false;
}

export function evaluateGameStatus(state: GameState, registry: PieceRegistry): GameState {
  let { tiles, grid, turn, boardDef, players, eliminatedPlayers } = state;
  const rules = getBoardRules(boardDef);
  const rows = tiles.length;
  const cols = tiles[0].length;
  const lastMove = state.moveHistory[state.moveHistory.length - 1];

  // Count pieces & royals per player, and check Summit / King of the Hill
  const pieceCounts = emptyColorMap(() => 0);
  const royalCounts = emptyColorMap(() => 0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (!p) continue;
      pieceCounts[p.color]++;
      const isRoyal = Boolean(registry[p.pieceId]?.rules.royal);
      if (isRoyal) {
        royalCounts[p.color]++;
        if (tiles[r][c].rule === 'summit') {
          return {
            ...state,
            status: 'victory',
            winner: p.color,
            statusReason: `Summit Claimed! ${COLOR_LABELS[p.color]}'s Royal reached the Crown Summit.`,
          };
        }
        if (rules.winCondition === 'king_of_the_hill') {
          const isCenter =
            Math.abs(r - (rows - 1) / 2) <= 0.6 && Math.abs(c - (cols - 1) / 2) <= 0.6;
          if (tiles[r][c].rule === 'sanctuary' || isCenter) {
            return {
              ...state,
              status: 'victory',
              winner: p.color,
              statusReason: `King of the Hill! ${COLOR_LABELS[p.color]}'s Royal claimed the center.`,
            };
          }
        }
      }
    }
  }

  // Race to Promote win condition
  if (rules.winCondition === 'race_to_promote' && lastMove?.promotedTo) {
    // The player who just moved is the previous active color
    const prevIdx = (players.indexOf(turn) - 1 + players.length) % players.length;
    const mover = players[prevIdx];
    return {
      ...state,
      status: 'victory',
      winner: mover,
      statusReason: `Promotion Race! ${COLOR_LABELS[mover]} promoted first and wins.`,
    };
  }

  // Three-Check win condition
  if (rules.winCondition === 'three_check') {
    for (const col of players) {
      if (state.checksDelivered[col] >= 3) {
        return {
          ...state,
          status: 'victory',
          winner: col,
          statusReason: `Three-Check Victory! ${COLOR_LABELS[col]} delivered 3 checks.`,
        };
      }
    }
  }

  // Antichess / Losing Chess: first active player with 0 pieces wins!
  if (rules.winCondition === 'antichess') {
    for (const col of players) {
      if (!eliminatedPlayers.includes(col) && pieceCounts[col] === 0) {
        return {
          ...state,
          status: 'victory',
          winner: col,
          statusReason: `Antichess Victory! ${COLOR_LABELS[col]} lost all pieces first.`,
        };
      }
    }
  }

  // Check for eliminated players (0 pieces, or 0 royals in capture_the_king)
  const nextEliminated = [...eliminatedPlayers];
  for (const col of players) {
    if (nextEliminated.includes(col)) continue;
    const lostAll = pieceCounts[col] === 0;
    const lostKing = rules.winCondition === 'capture_the_king' && royalCounts[col] === 0;
    if (lostAll || lostKing) {
      nextEliminated.push(col);
      if (lostKing) {
        grid = clearPlayerPieces(grid, col);
      }
    }
  }

  const remaining = players.filter((c) => !nextEliminated.includes(c));
  if (remaining.length === 1) {
    return {
      ...state,
      grid,
      eliminatedPlayers: nextEliminated,
      status: 'victory',
      winner: remaining[0],
      statusReason: `${COLOR_LABELS[remaining[0]]} is the last player standing!`,
    };
  }

  if (nextEliminated.includes(turn)) {
    turn = nextActiveColor(turn, players, nextEliminated);
  }

  // Draw rules (in 2-player games or when remaining === 2)
  if (rules.drawByFiftyMove && state.halfMoveClock >= 100) {
    return {
      ...state,
      grid,
      turn,
      eliminatedPlayers: nextEliminated,
      status: 'draw',
      winner: undefined,
      statusReason: 'Draw by 50-move rule.',
    };
  }

  if (rules.drawByRepetition) {
    const hash = computePositionHash(grid, turn, state.enPassantTarget);
    if ((state.positionCounts[hash] ?? 0) >= 3) {
      return {
        ...state,
        grid,
        turn,
        eliminatedPlayers: nextEliminated,
        status: 'draw',
        winner: undefined,
        statusReason: 'Draw by threefold repetition.',
      };
    }
  }

  if (
    remaining.length === 2 &&
    rules.drawByInsufficientMaterial &&
    rules.winCondition === 'checkmate' &&
    isInsufficientMaterial(grid, registry)
  ) {
    return {
      ...state,
      grid,
      turn,
      eliminatedPlayers: nextEliminated,
      status: 'draw',
      winner: undefined,
      statusReason: 'Draw by insufficient checkmating material.',
    };
  }

  const legalMoves = generateLegalMoves(
    tiles,
    grid,
    turn,
    registry,
    rules,
    state.enPassantTarget,
    state.lostByColor
  );
  const inCheck = isColorInCheck(tiles, grid, turn, registry, rules);

  if (legalMoves.length === 0) {
    if (rules.winCondition === 'antichess') {
      return {
        ...state,
        grid,
        turn,
        eliminatedPlayers: nextEliminated,
        status: 'victory',
        winner: turn,
        statusReason: `Antichess Victory! ${COLOR_LABELS[turn]} has no legal moves left.`,
      };
    }

    if (remaining.length > 2) {
      // In 3P/4P games, a player with no legal moves is eliminated and play continues!
      const updatedElim = [...nextEliminated, turn];
      const clearedGrid = clearPlayerPieces(grid, turn);
      const stillAlive = players.filter((c) => !updatedElim.includes(c));
      if (stillAlive.length === 1) {
        return {
          ...state,
          grid: clearedGrid,
          eliminatedPlayers: updatedElim,
          status: 'victory',
          winner: stillAlive[0],
          statusReason: `${COLOR_LABELS[stillAlive[0]]} wins — all rivals eliminated!`,
        };
      }
      return evaluateGameStatus(
        {
          ...state,
          grid: clearedGrid,
          eliminatedPlayers: updatedElim,
          turn: nextActiveColor(turn, players, updatedElim),
        },
        registry
      );
    }

    // 2 remaining players
    const opponent = remaining.find((c) => c !== turn)!;
    if (inCheck) {
      return {
        ...state,
        grid,
        turn,
        eliminatedPlayers: nextEliminated,
        status: 'checkmate',
        winner: opponent,
        statusReason: `Checkmate! ${COLOR_LABELS[opponent]} wins.`,
      };
    }
    if (royalCounts[turn] === 0 || rules.winCondition === 'annihilation') {
      return {
        ...state,
        grid,
        turn,
        eliminatedPlayers: nextEliminated,
        status: 'victory',
        winner: opponent,
        statusReason: `${COLOR_LABELS[turn]} has no legal moves. ${COLOR_LABELS[opponent]} wins.`,
      };
    }
    return {
      ...state,
      grid,
      turn,
      eliminatedPlayers: nextEliminated,
      status: 'stalemate',
      winner: undefined,
      statusReason: `Stalemate — ${COLOR_LABELS[turn]} has no legal moves and is not in check.`,
    };
  }

  return {
    ...state,
    grid,
    turn,
    eliminatedPlayers: nextEliminated,
    status: inCheck ? 'check' : 'playing',
    winner: undefined,
    statusReason: inCheck ? `${COLOR_LABELS[turn]} is in check!` : undefined,
  };
}

export function makeGameMove(
  state: GameState,
  move: Move,
  registry: PieceRegistry
): GameState {
  const rules = getBoardRules(state.boardDef);
  const movingPiece = state.grid[move.from.r]?.[move.from.c];
  const movingDef = movingPiece ? registry[movingPiece.pieceId] : undefined;
  const { tiles, grid, blastCaptures } = applyMoveToBoard(state.tiles, state.grid, move, registry);

  const capturedByColor: Record<Color, PlacedPiece[]> = {
    white: [...state.capturedByColor.white],
    black: [...state.capturedByColor.black],
    red: [...state.capturedByColor.red],
    blue: [...state.capturedByColor.blue],
  };
  const lostByColor: Record<Color, PlacedPiece[]> = {
    white: [...state.lostByColor.white],
    black: [...state.lostByColor.black],
    red: [...state.lostByColor.red],
    blue: [...state.lostByColor.blue],
  };

  if (move.captured) {
    capturedByColor[state.turn].push(move.captured);
    lostByColor[move.captured.color].push(move.captured);
  }
  for (const bc of blastCaptures) {
    lostByColor[bc.color].push(bc);
    if (bc.color !== state.turn) {
      capturedByColor[state.turn].push(bc);
    }
  }

  let nextEnPassant: GameState['enPassantTarget'] = null;
  if (move.isDoubleStep && movingPiece && (movingDef?.rules.enPassant || movingDef?.rules.pawnDoubleStep)) {
    const midR = Math.round((move.from.r + move.to.r) / 2);
    const midC = Math.round((move.from.c + move.to.c) / 2);
    nextEnPassant = {
      targetSquare: { r: midR, c: midC },
      pawnSquare: move.portalExit ?? move.to,
      pawnColor: state.turn,
    };
  }

  // Track checks delivered for Three-Check win condition
  const checksDelivered = { ...state.checksDelivered };
  const nextTurn = nextActiveColor(state.turn, state.players, state.eliminatedPlayers);
  if (isColorInCheck(tiles, grid, nextTurn, registry, rules)) {
    checksDelivered[state.turn] = (checksDelivered[state.turn] ?? 0) + 1;
  }

  const nextHash = computePositionHash(grid, nextTurn, nextEnPassant);
  const nextCounts = {
    ...state.positionCounts,
    [nextHash]: (state.positionCounts[nextHash] ?? 0) + 1,
  };

  const resetClock = Boolean(move.captured || movingDef?.rules.pawnDoubleStep || move.promotedTo);

  const next: GameState = {
    ...state,
    tiles,
    grid,
    turn: nextTurn,
    moveHistory: [...state.moveHistory, move],
    capturedByColor,
    lostByColor,
    checksDelivered,
    halfMoveClock: resetClock ? 0 : state.halfMoveClock + 1,
    enPassantTarget: nextEnPassant,
    positionCounts: nextCounts,
  };

  return evaluateGameStatus(next, registry);
}
