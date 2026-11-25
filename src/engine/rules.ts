import {
  BoardDefinition,
  Color,
  Coord,
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

export function oppositeColor(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
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

export function createInitialGameState(
  boardDef: BoardDefinition,
  registry: PieceRegistry
): GameState {
  const tiles = cloneTiles(boardDef.tiles);
  const grid = cloneGrid(boardDef.initialPieces);
  const base: GameState = {
    boardDef,
    tiles,
    grid,
    turn: 'white',
    moveHistory: [],
    capturedByWhite: [],
    capturedByBlack: [],
    status: 'playing',
    halfMoveClock: 0,
  };
  return evaluateGameStatus(base, registry);
}

function flipDirectionForColor(dir: Direction8, color: Color): Direction8 {
  if (color === 'white') return dir;
  const map: Record<Direction8, Direction8> = {
    N: 'S',
    NE: 'SE',
    E: 'E',
    SE: 'NE',
    S: 'N',
    SW: 'NW',
    W: 'W',
    NW: 'SW',
  };
  return map[dir];
}

export function canCaptureTarget(
  attackerDef: PieceDefinition,
  targetPiece: PlacedPiece,
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
      if (t.rule === 'portal' && t.portalChannel === channel) {
        // Only warp if the exit square is empty (prevents accidental telefragging)
        if (!grid[r][c]) {
          return { r, c };
        }
      }
    }
  }
  return undefined;
}

/**
 * Generates pseudo-legal moves for a single piece at (r, c), ignoring self-check.
 */
export function generatePseudoMovesForSquare(
  tiles: TileConfig[][],
  grid: (PlacedPiece | null)[][],
  r: number,
  c: number,
  registry: PieceRegistry
): Move[] {
  const piece = grid[r]?.[c];
  if (!piece) return [];
  const def = registry[piece.pieceId];
  if (!def) return [];

  const rows = tiles.length;
  const cols = tiles[0].length;
  const moves: Move[] = [];
  const dirSign = piece.color === 'white' ? 1 : -1;

  const tryAddMove = (tr: number, tc: number, allowMove: boolean, allowCapture: boolean) => {
    if (tr < 0 || tr >= rows || tc < 0 || tc >= cols) return 'oob';
    const targetTile = tiles[tr][tc];
    if (targetTile.rule === 'void') return 'void';

    const occupant = grid[tr][tc];
    if (!occupant) {
      if (allowMove) {
        let portalExit: Coord | undefined;
        if (targetTile.rule === 'portal' && targetTile.portalChannel) {
          portalExit = findPortalExit(tiles, grid, { r: tr, c: tc }, targetTile.portalChannel);
        }
        const finalCoord = portalExit ?? { r: tr, c: tc };
        const finalTile = tiles[finalCoord.r][finalCoord.c];
        const promotedTo = getPromotionTarget(def, piece.color, finalTile);
        moves.push({
          from: { r, c },
          to: { r: tr, c: tc },
          portalExit,
          promotedTo,
          notation: formatNotation(def, { r, c }, { r: tr, c: tc }, rows, false, false, portalExit, promotedTo),
        });
      }
      return 'empty';
    }

    if (occupant.color === piece.color) {
      return 'friendly';
    }

    // Enemy piece
    if (allowCapture) {
      const targetDef = registry[occupant.pieceId];
      if (targetDef && canCaptureTarget(def, occupant, targetDef, targetTile)) {
        const isRanged = Boolean(def.rules.rangedAttack);
        let portalExit: Coord | undefined;
        if (!isRanged && targetTile.rule === 'portal' && targetTile.portalChannel) {
          portalExit = findPortalExit(tiles, grid, { r: tr, c: tc }, targetTile.portalChannel);
        }
        const finalCoord = isRanged ? { r, c } : (portalExit ?? { r: tr, c: tc });
        const finalTile = tiles[finalCoord.r][finalCoord.c];
        const promotedTo = isRanged ? undefined : getPromotionTarget(def, piece.color, finalTile);
        moves.push({
          from: { r, c },
          to: { r: tr, c: tc },
          portalExit,
          isRangedCapture: isRanged,
          captured: occupant,
          promotedTo,
          notation: formatNotation(def, { r, c }, { r: tr, c: tc }, rows, true, isRanged, portalExit, promotedTo),
        });
      }
    }
    return 'enemy';
  };

  // 1. Hops (7x7 relative offsets, can jump over anything including void)
  for (const hop of def.hops) {
    const tr = r + hop.dr * dirSign;
    const tc = c + hop.dc;
    tryAddMove(
      tr,
      tc,
      hop.mode === 'both' || hop.mode === 'move',
      hop.mode === 'both' || hop.mode === 'capture'
    );
  }

  // 2. Pawn-like first double step
  if (def.rules.pawnDoubleStep && !piece.hasMoved) {
    const step1r = r - 1 * dirSign;
    const step2r = r - 2 * dirSign;
    if (
      step1r >= 0 &&
      step1r < rows &&
      step2r >= 0 &&
      step2r < rows &&
      tiles[step1r][c].rule !== 'void' &&
      !grid[step1r][c] &&
      tiles[step2r][c].rule !== 'void' &&
      !grid[step2r][c]
    ) {
      tryAddMove(step2r, c, true, false);
    }
  }

  // 3. Sliding rays (8 directions)
  const slideEntries = Object.entries(def.slides) as [Direction8, number | undefined][];
  for (const [rawDir, maxDist] of slideEntries) {
    if (!maxDist || maxDist <= 0) continue;
    const actualDir = flipDirectionForColor(rawDir, piece.color);
    const { dr, dc } = DIRECTIONS_8[actualDir];
    for (let step = 1; step <= maxDist; step++) {
      const tr = r + dr * step;
      const tc = c + dc * step;
      const res = tryAddMove(tr, tc, true, true);
      if (res !== 'empty') break; // blocked by void, oob, friendly, or enemy
    }
  }

  return moves;
}

function getPromotionTarget(
  def: PieceDefinition,
  color: Color,
  tile: TileConfig
): string | undefined {
  if (tile.rule !== 'promotion') return undefined;
  if (def.rules.royal) return undefined; // Royals don't lose royalty via promotion
  const targetId = tile.promoteToPieceId || 'queen';
  if (def.id === targetId) return undefined;
  if (tile.promotionFor === 'both' || tile.promotionFor === color) {
    return targetId;
  }
  return undefined;
}

function formatNotation(
  def: PieceDefinition,
  from: Coord,
  to: Coord,
  rows: number,
  isCapture: boolean,
  isRanged: boolean,
  portalExit?: Coord,
  promotedTo?: string
): string {
  const fromStr = coordToAlgebraic(from.r, from.c, rows);
  const toStr = coordToAlgebraic(to.r, to.c, rows);
  const sep = isRanged ? '→×' : isCapture ? '×' : '-';
  let out = `${def.shortCode}${fromStr}${sep}${toStr}`;
  if (portalExit) {
    out += `⟿${coordToAlgebraic(portalExit.r, portalExit.c, rows)}`;
  }
  if (promotedTo) {
    out += `=${promotedTo[0].toUpperCase()}`;
  }
  return out;
}

export function applyMoveToBoard(
  tiles: TileConfig[][],
  grid: (PlacedPiece | null)[][],
  move: Move
): { tiles: TileConfig[][]; grid: (PlacedPiece | null)[][] } {
  const nextTiles = cloneTiles(tiles);
  const nextGrid = cloneGrid(grid);
  const moving = nextGrid[move.from.r][move.from.c];
  if (!moving) return { tiles: nextTiles, grid: nextGrid };

  if (move.isRangedCapture) {
    // Attacker stays in place, target is removed
    nextGrid[move.to.r][move.to.c] = null;
    moving.hasMoved = true;
  } else {
    nextGrid[move.from.r][move.from.c] = null;
    const finalCoord = move.portalExit ?? move.to;
    const updatedPiece: PlacedPiece = {
      ...moving,
      hasMoved: true,
      pieceId: move.promotedTo ?? moving.pieceId,
    };
    nextGrid[finalCoord.r][finalCoord.c] = updatedPiece;

    // Handle Fallow tile wear on departure or arrival
    const landedTile = nextTiles[move.to.r][move.to.c];
    if (landedTile.rule === 'fallow') {
      const remaining = (landedTile.fallowUses ?? 1) - 1;
      if (remaining <= 0) {
        // Tile will crumble once the piece leaves? Or right after being stepped on when moving off?
        // In ChessCraft, fallow tiles count down each time they are stepped on and crumble when 0!
        // We set fallowUses to 0 so it's marked fragile, and if it was already 0 on departure it turns to void.
        landedTile.fallowUses = 0;
      } else {
        landedTile.fallowUses = remaining;
      }
    }
    const departedTile = nextTiles[move.from.r][move.from.c];
    if (departedTile.rule === 'fallow' && (departedTile.fallowUses ?? 1) <= 0) {
      nextTiles[move.from.r][move.from.c] = { rule: 'void' };
    }
  }

  return { tiles: nextTiles, grid: nextGrid };
}

export function isColorInCheck(
  tiles: TileConfig[][],
  grid: (PlacedPiece | null)[][],
  color: Color,
  registry: PieceRegistry
): boolean {
  const rows = tiles.length;
  const cols = tiles[0].length;
  const royalCoords: Coord[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (p && p.color === color && registry[p.pieceId]?.rules.royal) {
        royalCoords.push({ r, c });
      }
    }
  }
  if (royalCoords.length === 0) return false;

  const enemy = oppositeColor(color);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (!p || p.color !== enemy) continue;
      const enemyMoves = generatePseudoMovesForSquare(tiles, grid, r, c, registry);
      for (const m of enemyMoves) {
        if (!m.captured) continue;
        for (const rc of royalCoords) {
          if (m.to.r === rc.r && m.to.c === rc.c) {
            return true;
          }
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
  registry: PieceRegistry
): Move[] {
  const rows = tiles.length;
  const cols = tiles[0].length;
  const legal: Move[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (!p || p.color !== color) continue;
      const pseudo = generatePseudoMovesForSquare(tiles, grid, r, c, registry);
      for (const m of pseudo) {
        const next = applyMoveToBoard(tiles, grid, m);
        if (!isColorInCheck(next.tiles, next.grid, color, registry)) {
          legal.push(m);
        }
      }
    }
  }
  return legal;
}

export function evaluateGameStatus(state: GameState, registry: PieceRegistry): GameState {
  const { tiles, grid, turn } = state;
  const rows = tiles.length;
  const cols = tiles[0].length;

  let whiteCount = 0;
  let blackCount = 0;
  let turnHasRoyal = false;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (!p) continue;
      if (p.color === 'white') whiteCount++;
      else blackCount++;
      if (p.color === turn && registry[p.pieceId]?.rules.royal) {
        turnHasRoyal = true;
      }
    }
  }

  if (whiteCount === 0) {
    return { ...state, status: 'victory_black', winner: 'black', statusReason: 'All White pieces eliminated' };
  }
  if (blackCount === 0) {
    return { ...state, status: 'victory_white', winner: 'white', statusReason: 'All Black pieces eliminated' };
  }

  const legalMoves = generateLegalMoves(tiles, grid, turn, registry);
  const inCheck = isColorInCheck(tiles, grid, turn, registry);

  if (legalMoves.length === 0) {
    if (inCheck) {
      const winner = oppositeColor(turn);
      return {
        ...state,
        status: 'checkmate',
        winner,
        statusReason: `Checkmate! ${winner === 'white' ? 'White' : 'Black'} wins.`,
      };
    }
    if (!turnHasRoyal) {
      const winner = oppositeColor(turn);
      return {
        ...state,
        status: winner === 'white' ? 'victory_white' : 'victory_black',
        winner,
        statusReason: `${turn === 'white' ? 'White' : 'Black'} has no legal moves.`,
      };
    }
    return {
      ...state,
      status: 'stalemate',
      winner: undefined,
      statusReason: 'Stalemate — Draw!',
    };
  }

  return {
    ...state,
    status: inCheck ? 'check' : 'playing',
    winner: undefined,
    statusReason: inCheck ? `${turn === 'white' ? 'White' : 'Black'} is in check!` : undefined,
  };
}

export function makeGameMove(
  state: GameState,
  move: Move,
  registry: PieceRegistry
): GameState {
  const { tiles, grid } = applyMoveToBoard(state.tiles, state.grid, move);
  const capturedByWhite = [...state.capturedByWhite];
  const capturedByBlack = [...state.capturedByBlack];
  if (move.captured) {
    if (state.turn === 'white') capturedByWhite.push(move.captured);
    else capturedByBlack.push(move.captured);
  }

  const next: GameState = {
    ...state,
    tiles,
    grid,
    turn: oppositeColor(state.turn),
    moveHistory: [...state.moveHistory, move],
    capturedByWhite,
    capturedByBlack,
    halfMoveClock: move.captured ? 0 : state.halfMoveClock + 1,
  };

  return evaluateGameStatus(next, registry);
}
