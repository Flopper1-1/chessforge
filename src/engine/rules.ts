import {
  BoardDefinition,
  BoardRuleSettings,
  Color,
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

export function oppositeColor(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
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

export function createInitialGameState(
  boardDef: BoardDefinition,
  registry: PieceRegistry
): GameState {
  const tiles = cloneTiles(boardDef.tiles);
  const grid = cloneGrid(boardDef.initialPieces);
  const hash = computePositionHash(grid, 'white', null);
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
    enPassantTarget: null,
    positionCounts: { [hash]: 1 },
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
        if (!grid[r][c]) {
          return { r, c };
        }
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
  registry: PieceRegistry
): string[] | undefined {
  if (tile.rule !== 'promotion') return undefined;
  if (def.rules.royal || def.rules.canPromote === false) return undefined;
  if (tile.promotionFor !== 'both' && tile.promotionFor !== color) return undefined;

  // If tile pins a specific fixed piece, only promote into that piece (unless already that piece)
  if (tile.promoteToPieceId && registry[tile.promoteToPieceId]) {
    return def.id === tile.promoteToPieceId ? undefined : [tile.promoteToPieceId];
  }

  // Otherwise use the board's promotionPool (filtered to valid non-royal pieces != current piece)
  const pool = rules.promotionPool.filter(
    (pid) => registry[pid] && !registry[pid].rules.royal && pid !== def.id
  );
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
  const sep = isRanged ? '→×' : isCapture ? '×' : '-';
  let out = `${def.shortCode}${fromStr}${sep}${toStr}`;
  if (isEnPassant) out += ' e.p.';
  if (portalExit) {
    out += `⟿${coordToAlgebraic(portalExit.r, portalExit.c, rows)}`;
  }
  if (promotedTo) {
    out += `=${promotedTo[0].toUpperCase()}`;
  }
  return out;
}

/**
 * Checks whether a specific square (tr, tc) is attacked by `byColor`.
 */
export function isSquareAttackedBy(
  tiles: TileConfig[][],
  grid: (PlacedPiece | null)[][],
  target: Coord,
  byColor: Color,
  registry: PieceRegistry,
  rules: BoardRuleSettings
): boolean {
  const rows = tiles.length;
  const cols = tiles[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (!p || p.color !== byColor) continue;
      const moves = generatePseudoMovesForSquare(tiles, grid, r, c, registry, rules, null, true);
      for (const m of moves) {
        if (m.to.r === target.r && m.to.c === target.c && !m.castling) {
          // For pawns/move-only hops, only count capture-capable attacks
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

function isAttackingSquare(
  def: PieceDefinition,
  color: Color,
  from: Coord,
  to: Coord
): boolean {
  const dirSign = color === 'white' ? 1 : -1;
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  // Check hops
  for (const h of def.hops) {
    if (h.dr * dirSign === dr && h.dc === dc) {
      return h.mode === 'both' || h.mode === 'capture';
    }
  }
  // Slides always capture
  return true;
}

/**
 * Generates pseudo-legal moves for a single piece at (r, c), ignoring self-check.
 */
export function generatePseudoMovesForSquare(
  tiles: TileConfig[][],
  grid: (PlacedPiece | null)[][],
  r: number,
  c: number,
  registry: PieceRegistry,
  rules: BoardRuleSettings,
  enPassantTarget?: GameState['enPassantTarget'],
  skipCastling = false
): Move[] {
  const piece = grid[r]?.[c];
  if (!piece) return [];
  const def = registry[piece.pieceId];
  if (!def) return [];

  const rows = tiles.length;
  const cols = tiles[0].length;
  const moves: Move[] = [];
  const dirSign = piece.color === 'white' ? 1 : -1;

  const pushMoveWithPromotions = (base: Omit<Move, 'promotedTo' | 'notation'>, isCapture: boolean, isRanged: boolean) => {
    const finalCoord = isRanged ? base.from : (base.portalExit ?? base.to);
    const finalTile = tiles[finalCoord.r][finalCoord.c];
    const promoOpts = isRanged ? undefined : getPromotionOptions(def, piece.color, finalTile, rules, registry);

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
    isDoubleStep = false
  ) => {
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
        pushMoveWithPromotions(
          {
            from: { r, c },
            to: { r: tr, c: tc },
            portalExit,
            isDoubleStep,
          },
          false,
          false
        );
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
        pushMoveWithPromotions(
          {
            from: { r, c },
            to: { r: tr, c: tc },
            portalExit,
            isRangedCapture: isRanged,
            captured: occupant,
          },
          true,
          isRanged
        );
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
      tryAddMove(step2r, c, true, false, true);
    }
  }

  // 3. En Passant capture
  if (
    rules.enPassantEnabled &&
    (def.rules.enPassant || def.rules.pawnDoubleStep) &&
    enPassantTarget &&
    enPassantTarget.pawnColor !== piece.color
  ) {
    const ep = enPassantTarget.targetSquare;
    const epPawn = grid[enPassantTarget.pawnSquare.r]?.[enPassantTarget.pawnSquare.c];
    const epTile = tiles[enPassantTarget.pawnSquare.r]?.[enPassantTarget.pawnSquare.c];
    if (
      epPawn &&
      epTile &&
      epTile.rule !== 'sanctuary' &&
      ep.r === r - 1 * dirSign &&
      Math.abs(ep.c - c) === 1 &&
      tiles[ep.r]?.[ep.c]?.rule !== 'void' &&
      !grid[ep.r][ep.c]
    ) {
      const targetDef = registry[epPawn.pieceId];
      if (targetDef && canCaptureTarget(def, epPawn, targetDef, epTile)) {
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

  // 4. Sliding rays (8 directions)
  const slideEntries = Object.entries(def.slides) as [Direction8, number | undefined][];
  for (const [rawDir, maxDist] of slideEntries) {
    if (!maxDist || maxDist <= 0) continue;
    const actualDir = flipDirectionForColor(rawDir, piece.color);
    const { dr, dc } = DIRECTIONS_8[actualDir];
    for (let step = 1; step <= maxDist; step++) {
      const tr = r + dr * step;
      const tc = c + dc * step;
      const res = tryAddMove(tr, tc, true, true);
      if (res === 'friendly' && def.rules.phasing) {
        continue; // Phasing pieces slide right through friendly pieces!
      }
      if (res !== 'empty') break;
    }
  }

  // 5. Castling (for unmoved Royal pieces with castleKing enabled)
  if (
    !skipCastling &&
    rules.castlingEnabled &&
    (def.rules.castleKing || def.rules.royal) &&
    !piece.hasMoved
  ) {
    const enemy = oppositeColor(piece.color);
    // Cannot castle out of check
    if (!isSquareAttackedBy(tiles, grid, { r, c }, enemy, registry, rules)) {
      for (const side of ['kingside', 'queenside'] as const) {
        const dcStep = side === 'kingside' ? 1 : -1;
        // Scan along the same rank for an unmoved friendly castleRook
        let rookCol = -1;
        for (let sc = c + dcStep; sc >= 0 && sc < cols; sc += dcStep) {
          if (tiles[r][sc].rule === 'void') break;
          const occ = grid[r][sc];
          if (occ) {
            const occDef = registry[occ.pieceId];
            if (
              occ.color === piece.color &&
              !occ.hasMoved &&
              occDef &&
              (occDef.rules.castleRook || occ.pieceId === 'rook')
            ) {
              rookCol = sc;
            }
            break;
          }
        }

        if (rookCol !== -1 && Math.abs(rookCol - c) >= 2) {
          const kingTargetCol = c + dcStep * 2;
          const rookTargetCol = c + dcStep;
          if (
            kingTargetCol >= 0 &&
            kingTargetCol < cols &&
            tiles[r][kingTargetCol].rule !== 'void' &&
            tiles[r][rookTargetCol].rule !== 'void'
          ) {
            // Ensure squares King passes through and lands on are not attacked
            const passSafe = !isSquareAttackedBy(
              tiles,
              grid,
              { r, c: rookTargetCol },
              enemy,
              registry,
              rules
            );
            const landSafe = !isSquareAttackedBy(
              tiles,
              grid,
              { r, c: kingTargetCol },
              enemy,
              registry,
              rules
            );
            if (passSafe && landSafe) {
              moves.push({
                from: { r, c },
                to: { r, c: kingTargetCol },
                castling: {
                  rookFrom: { r, c: rookCol },
                  rookTo: { r, c: rookTargetCol },
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
    nextGrid[finalCoord.r][finalCoord.c] = updatedPiece;

    // Explosive / Atomic capture blast (destroys adjacent non-royal, non-sanctuary, non-iron pieces)
    const movingDef = registry?.[moving.pieceId];
    if (move.captured && movingDef?.rules.explosive && registry) {
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

    // Handle Fallow tile wear
    const landedTile = nextTiles[move.to.r][move.to.c];
    if (landedTile.rule === 'fallow') {
      const remaining = (landedTile.fallowUses ?? 1) - 1;
      landedTile.fallowUses = Math.max(0, remaining);
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
  for (const rc of royalCoords) {
    if (isSquareAttackedBy(tiles, grid, rc, enemy, registry, rules)) {
      return true;
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
  enPassantTarget?: GameState['enPassantTarget']
): Move[] {
  const rows = tiles.length;
  const cols = tiles[0].length;
  const legal: Move[] = [];

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
        enPassantTarget
      );
      for (const m of pseudo) {
        const next = applyMoveToBoard(tiles, grid, m, registry);
        if (!isColorInCheck(next.tiles, next.grid, color, registry, rules)) {
          legal.push(m);
        }
      }
    }
  }
  return legal;
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
      if (!def.rules.royal) {
        nonRoyals.push(def);
      }
    }
  }
  // King vs King
  if (nonRoyals.length === 0) return true;
  // King + single minor (Bishop or Knight) vs King
  if (
    nonRoyals.length === 1 &&
    (nonRoyals[0].id === 'bishop' || nonRoyals[0].id === 'knight')
  ) {
    return true;
  }
  return false;
}

export function evaluateGameStatus(state: GameState, registry: PieceRegistry): GameState {
  const { tiles, grid, turn, boardDef } = state;
  const rules = getBoardRules(boardDef);
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

      // King of the Hill win condition: Royal reaches a Sanctuary or exact center square
      if (rules.winCondition === 'king_of_the_hill' && registry[p.pieceId]?.rules.royal) {
        const isCenter =
          Math.abs(r - (rows - 1) / 2) <= 0.6 && Math.abs(c - (cols - 1) / 2) <= 0.6;
        if (tiles[r][c].rule === 'sanctuary' || isCenter) {
          return {
            ...state,
            status: p.color === 'white' ? 'victory_white' : 'victory_black',
            winner: p.color,
            statusReason: `King of the Hill! ${p.color === 'white' ? 'White' : 'Black'}'s Royal claimed the summit.`,
          };
        }
      }
    }
  }

  if (whiteCount === 0) {
    return { ...state, status: 'victory_black', winner: 'black', statusReason: 'All White pieces eliminated.' };
  }
  if (blackCount === 0) {
    return { ...state, status: 'victory_white', winner: 'white', statusReason: 'All Black pieces eliminated.' };
  }

  // Draw rules: 50-move rule, threefold repetition, insufficient material
  if (rules.drawByFiftyMove && state.halfMoveClock >= 100) {
    return {
      ...state,
      status: 'draw',
      winner: undefined,
      statusReason: 'Draw by 50-move rule (no capture or pawn advance in 50 moves).',
    };
  }

  if (rules.drawByRepetition) {
    const hash = computePositionHash(grid, turn, state.enPassantTarget);
    if ((state.positionCounts[hash] ?? 0) >= 3) {
      return {
        ...state,
        status: 'draw',
        winner: undefined,
        statusReason: 'Draw by threefold repetition.',
      };
    }
  }

  if (rules.drawByInsufficientMaterial && rules.winCondition === 'checkmate' && isInsufficientMaterial(grid, registry)) {
    return {
      ...state,
      status: 'draw',
      winner: undefined,
      statusReason: 'Draw by insufficient checkmating material.',
    };
  }

  const legalMoves = generateLegalMoves(tiles, grid, turn, registry, rules, state.enPassantTarget);
  const inCheck = isColorInCheck(tiles, grid, turn, registry, rules);

  if (legalMoves.length === 0) {
    if (inCheck && rules.winCondition !== 'annihilation') {
      const winner = oppositeColor(turn);
      return {
        ...state,
        status: 'checkmate',
        winner,
        statusReason: `Checkmate! ${winner === 'white' ? 'White' : 'Black'} wins.`,
      };
    }
    if (!turnHasRoyal || rules.winCondition === 'annihilation') {
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
      statusReason: `Stalemate — ${turn === 'white' ? 'White' : 'Black'} has no legal moves and is not in check.`,
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
  const movingPiece = state.grid[move.from.r]?.[move.from.c];
  const movingDef = movingPiece ? registry[movingPiece.pieceId] : undefined;
  const { tiles, grid, blastCaptures } = applyMoveToBoard(state.tiles, state.grid, move, registry);

  const capturedByWhite = [...state.capturedByWhite];
  const capturedByBlack = [...state.capturedByBlack];
  if (move.captured) {
    if (state.turn === 'white') capturedByWhite.push(move.captured);
    else capturedByBlack.push(move.captured);
  }
  for (const bc of blastCaptures) {
    if (bc.color === 'black') capturedByWhite.push(bc);
    else capturedByBlack.push(bc);
  }

  // Compute En Passant target if this was a 2-step double push
  let nextEnPassant: GameState['enPassantTarget'] = null;
  if (move.isDoubleStep && movingPiece && (movingDef?.rules.enPassant || movingDef?.rules.pawnDoubleStep)) {
    const midR = Math.round((move.from.r + move.to.r) / 2);
    nextEnPassant = {
      targetSquare: { r: midR, c: move.from.c },
      pawnSquare: move.portalExit ?? move.to,
      pawnColor: state.turn,
    };
  }

  const nextTurn = oppositeColor(state.turn);
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
    capturedByWhite,
    capturedByBlack,
    halfMoveClock: resetClock ? 0 : state.halfMoveClock + 1,
    enPassantTarget: nextEnPassant,
    positionCounts: nextCounts,
  };

  return evaluateGameStatus(next, registry);
}
