import { describe, expect, it } from 'vitest';
import { BUILTIN_BOARDS, BUILTIN_PIECES, makePiece } from './presets';
import {
  createInitialGameState,
  generateLegalMoves,
  getBoardRules,
  isColorInCheck,
  makeGameMove,
  PieceRegistry,
} from './rules';
import { analyzeBoardGraph, chooseAIMove, estimatePieceValueOnStandardBoard } from './graphAi';
import { BoardDefinition } from './types';

const registry: PieceRegistry = Object.fromEntries(BUILTIN_PIECES.map((p) => [p.id, p]));

function emptyBoard(rows: number, cols: number): BoardDefinition {
  return {
    id: 'test-board',
    name: 'Test Board',
    description: 'Test',
    rows,
    cols,
    tiles: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ rule: 'normal' as const }))
    ),
    initialPieces: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => null)
    ),
  };
}

describe('ChessForge Variant Engine', () => {
  it('generates 20 opening legal moves on Classic 8x8 Chess', () => {
    const classic = BUILTIN_BOARDS.find((b) => b.id === 'classic-chess')!;
    const state = createInitialGameState(classic, registry);
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(classic));
    expect(moves.length).toBe(20);
  });

  it('supports Kingside and Queenside Castling and blocks castling through check', () => {
    const b = emptyBoard(8, 8);
    b.initialPieces[7][4] = makePiece('king', 'white');
    b.initialPieces[7][7] = makePiece('rook', 'white');
    b.initialPieces[7][0] = makePiece('rook', 'white');
    b.initialPieces[0][4] = makePiece('king', 'black');

    const state = createInitialGameState(b, registry);
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(b));
    const oo = moves.find((m) => m.castling?.side === 'kingside');
    const ooo = moves.find((m) => m.castling?.side === 'queenside');
    expect(oo).toBeDefined();
    expect(ooo).toBeDefined();

    // Execute Kingside castling
    const afterOO = makeGameMove(state, oo!, registry);
    expect(afterOO.grid[7][6]?.pieceId).toBe('king');
    expect(afterOO.grid[7][5]?.pieceId).toBe('rook');
    expect(afterOO.grid[7][4]).toBeNull();
    expect(afterOO.grid[7][7]).toBeNull();

    // Now place a black rook attacking f1 (7,5) -> kingside castling must be blocked
    b.initialPieces[2][5] = makePiece('rook', 'black');
    const blockedState = createInitialGameState(b, registry);
    const blockedMoves = generateLegalMoves(blockedState.tiles, blockedState.grid, 'white', registry, getBoardRules(b));
    expect(blockedMoves.find((m) => m.castling?.side === 'kingside')).toBeUndefined();
    expect(blockedMoves.find((m) => m.castling?.side === 'queenside')).toBeDefined();
  });

  it('supports En Passant capture immediately after a 2-step pawn advance', () => {
    const b = emptyBoard(8, 8);
    b.initialPieces[7][4] = makePiece('king', 'white');
    b.initialPieces[0][4] = makePiece('king', 'black');
    b.initialPieces[3][4] = makePiece('pawn', 'white'); // e5
    b.initialPieces[1][3] = makePiece('pawn', 'black'); // d7

    let state = createInitialGameState(b, registry);
    // White makes a quiet king move
    const kingMove = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(b)).find(
      (m) => m.from.r === 7 && m.from.c === 4 && m.to.r === 7 && m.to.c === 3
    )!;
    state = makeGameMove(state, kingMove, registry);

    // Black double-pushes d7 -> d5 (row 1 -> row 3)
    const doublePush = generateLegalMoves(state.tiles, state.grid, 'black', registry, getBoardRules(b)).find(
      (m) => m.from.r === 1 && m.from.c === 3 && m.to.r === 3 && m.to.c === 3
    )!;
    expect(doublePush.isDoubleStep).toBe(true);
    state = makeGameMove(state, doublePush, registry);
    expect(state.enPassantTarget?.targetSquare).toEqual({ r: 2, c: 3 });

    // White pawn on e5 (3,4) captures en passant onto d6 (2,3)
    const epMove = generateLegalMoves(
      state.tiles,
      state.grid,
      'white',
      registry,
      getBoardRules(b),
      state.enPassantTarget
    ).find((m) => m.enPassantCaptureCoord !== undefined);
    expect(epMove).toBeDefined();
    expect(epMove?.to).toEqual({ r: 2, c: 3 });

    const afterEp = makeGameMove(state, epMove!, registry);
    expect(afterEp.grid[2][3]?.pieceId).toBe('pawn');
    expect(afterEp.grid[2][3]?.color).toBe('white');
    expect(afterEp.grid[3][3]).toBeNull(); // captured black pawn removed!
  });

  it('offers multiple promotion choices (Queen, Rook, Bishop, Knight) on promotion tiles', () => {
    const b = emptyBoard(6, 6);
    b.tiles[0][2] = { rule: 'promotion', promotionFor: 'white' };
    b.initialPieces[5][0] = makePiece('king', 'white');
    b.initialPieces[0][5] = makePiece('king', 'black');
    b.initialPieces[1][2] = makePiece('pawn', 'white');

    const state = createInitialGameState(b, registry);
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(b));
    const promoMoves = moves.filter((m) => m.from.r === 1 && m.from.c === 2 && m.to.r === 0 && m.to.c === 2);
    expect(promoMoves.map((m) => m.promotedTo).sort()).toEqual(['bishop', 'knight', 'queen', 'rook']);

    const knightPromo = promoMoves.find((m) => m.promotedTo === 'knight')!;
    const after = makeGameMove(state, knightPromo, registry);
    expect(after.grid[0][2]?.pieceId).toBe('knight');
  });

  it('detects Stalemate, Insufficient Material, and Threefold Repetition draws', () => {
    // 1. Stalemate
    const staleBoard = emptyBoard(4, 4);
    staleBoard.initialPieces[0][0] = makePiece('king', 'black');
    staleBoard.initialPieces[2][1] = makePiece('queen', 'white');
    staleBoard.initialPieces[3][3] = makePiece('king', 'white');
    const stState = createInitialGameState(staleBoard, registry);
    const toStale = generateLegalMoves(stState.tiles, stState.grid, 'white', registry, getBoardRules(staleBoard)).find(
      (m) => m.from.r === 2 && m.from.c === 1 && m.to.r === 2 && m.to.c === 1 // wait: move queen to (1,2) -> traps black king at (0,0) without check!
    );
    const trapMove = generateLegalMoves(stState.tiles, stState.grid, 'white', registry, getBoardRules(staleBoard)).find(
      (m) => m.from.r === 2 && m.from.c === 1 && m.to.r === 1 && m.to.c === 2
    )!;
    expect(toStale).toBeUndefined();
    const afterTrap = makeGameMove(stState, trapMove, registry);
    expect(afterTrap.status).toBe('stalemate');

    // 2. Insufficient Material (K vs K)
    const kvk = emptyBoard(4, 4);
    kvk.initialPieces[0][0] = makePiece('king', 'black');
    kvk.initialPieces[3][3] = makePiece('king', 'white');
    const kvkState = createInitialGameState(kvk, registry);
    expect(kvkState.status).toBe('draw');
    expect(kvkState.statusReason).toContain('insufficient');
  });

  it('enforces Iron protection and Blacksmith armor-breaking', () => {
    const b = emptyBoard(5, 5);
    b.initialPieces[4][0] = makePiece('king', 'white');
    b.initialPieces[0][4] = makePiece('king', 'black');
    b.initialPieces[2][2] = makePiece('golem', 'black');
    b.initialPieces[2][0] = makePiece('rook', 'white');
    b.initialPieces[3][2] = makePiece('blacksmith', 'white');

    const state = createInitialGameState(b, registry);
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(b));
    expect(moves.find((m) => m.from.r === 2 && m.from.c === 0 && m.to.r === 2 && m.to.c === 2)).toBeUndefined();
    const smithCapture = moves.find((m) => m.from.r === 3 && m.from.c === 2 && m.to.r === 2 && m.to.c === 2);
    expect(smithCapture?.captured?.pieceId).toBe('golem');
  });

  it('supports Ranged Attack captures without moving the attacker', () => {
    const b = emptyBoard(5, 5);
    b.initialPieces[4][0] = makePiece('king', 'white');
    b.initialPieces[0][4] = makePiece('king', 'black');
    b.initialPieces[3][2] = makePiece('archer', 'white');
    b.initialPieces[1][2] = makePiece('pawn', 'black');

    const state = createInitialGameState(b, registry);
    const snipe = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(b)).find(
      (m) => m.from.r === 3 && m.from.c === 2 && m.to.r === 1 && m.to.c === 2
    )!;
    expect(snipe.isRangedCapture).toBe(true);
    const next = makeGameMove(state, snipe, registry);
    expect(next.grid[3][2]?.pieceId).toBe('archer');
    expect(next.grid[1][2]).toBeNull();
  });

  it('protects pieces on Sanctuary, teleports via Portals, and crumbles Fallow tiles', () => {
    const b = emptyBoard(5, 5);
    b.tiles[2][2] = { rule: 'portal', portalChannel: 'A' };
    b.tiles[0][0] = { rule: 'portal', portalChannel: 'A' };
    b.tiles[2][4] = { rule: 'sanctuary' };
    b.tiles[3][2] = { rule: 'fallow', fallowUses: 1 };
    b.initialPieces[4][0] = makePiece('king', 'white');
    b.initialPieces[0][4] = makePiece('king', 'black');
    b.initialPieces[2][0] = makePiece('rook', 'white');
    b.initialPieces[2][4] = makePiece('queen', 'black');

    const state = createInitialGameState(b, registry);
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(b));
    // Sanctuary protects black queen at (2,4)
    expect(moves.find((m) => m.to.r === 2 && m.to.c === 4)).toBeUndefined();
    // Portal warps rook from (2,0) -> (2,2) -> (0,0)
    const portalMove = moves.find((m) => m.from.r === 2 && m.from.c === 0 && m.to.r === 2 && m.to.c === 2)!;
    const next = makeGameMove(state, portalMove, registry);
    expect(next.grid[0][0]?.pieceId).toBe('rook');
  });

  it('supports Explosive captures and King of the Hill win condition', () => {
    const b = emptyBoard(5, 5);
    b.rules = { winCondition: 'king_of_the_hill' };
    b.initialPieces[4][0] = makePiece('king', 'white');
    b.initialPieces[0][4] = makePiece('king', 'black');
    b.initialPieces[3][2] = makePiece('bombardier', 'white');
    b.initialPieces[1][2] = makePiece('pawn', 'black');
    b.initialPieces[1][1] = makePiece('pawn', 'black'); // adjacent victim of 3x3 blast

    const state = createInitialGameState(b, registry);
    const blastMove = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(b)).find(
      (m) => m.from.r === 3 && m.from.c === 2 && m.to.r === 1 && m.to.c === 2
    )!;
    const afterBlast = makeGameMove(state, blastMove, registry);
    expect(afterBlast.grid[1][2]?.pieceId).toBe('bombardier');
    expect(afterBlast.grid[1][1]).toBeNull(); // destroyed by explosion!
  });

  it('detects checkmate accurately and Graph-Theory AI chooses winning captures', () => {
    const queenEst = estimatePieceValueOnStandardBoard(registry.queen);
    const rookEst = estimatePieceValueOnStandardBoard(registry.rook);
    const pawnEst = estimatePieceValueOnStandardBoard(registry.pawn);
    expect(queenEst.points).toBeGreaterThan(rookEst.points);
    expect(rookEst.points).toBeGreaterThan(pawnEst.points);

    const b = emptyBoard(4, 4);
    b.initialPieces[0][0] = makePiece('king', 'black');
    b.initialPieces[1][2] = makePiece('queen', 'white');
    b.initialPieces[2][1] = makePiece('rook', 'white');
    b.initialPieces[3][3] = makePiece('king', 'white');

    const state = createInitialGameState(b, registry);
    const mateMove = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(b)).find(
      (m) => m.from.r === 1 && m.from.c === 2 && m.to.r === 1 && m.to.c === 1
    )!;
    const next = makeGameMove(state, mateMove, registry);
    expect(isColorInCheck(next.tiles, next.grid, 'black', registry)).toBe(true);
    expect(next.status).toBe('checkmate');
    expect(next.winner).toBe('white');

    const aiBoard = emptyBoard(6, 6);
    aiBoard.initialPieces[5][0] = makePiece('king', 'white');
    aiBoard.initialPieces[0][5] = makePiece('king', 'black');
    aiBoard.initialPieces[2][2] = makePiece('queen', 'black');
    aiBoard.initialPieces[2][0] = makePiece('rook', 'white');
    const aiState = createInitialGameState(aiBoard, registry);
    const analysis = analyzeBoardGraph(aiState.tiles, ['king', 'queen', 'rook'], registry);
    const result = chooseAIMove(aiState, registry, 'tactician', analysis);
    expect(result.bestMove?.to).toEqual({ r: 2, c: 2 });
  });

  it('Stage 5 (Crumbling Bridges) remains crossable even after all Fallow bridges collapse', () => {
    const bridge = BUILTIN_BOARDS.find((b) => b.id === 'crumbling-bridge')!;
    const state = createInitialGameState(bridge, registry);
    // Collapse all row-3 fallow bridges into void
    for (let c = 0; c < bridge.cols; c++) {
      state.tiles[3][c] = { rule: 'void' };
    }
    // Place a White knight on row 4 (just below the chasm) and verify it can leap across to row 2
    state.grid[4][2] = makePiece('knight', 'white');
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(bridge));
    const leapAcross = moves.find((m) => m.from.r === 4 && m.from.c === 2 && m.to.r === 2);
    expect(leapAcross).toBeDefined();
  });

  it('supports new special tiles (Ice slide, Spike Trap, Power Boost, Crown Summit) and custom hop modes', () => {
    const b = emptyBoard(6, 6);
    b.tiles[3][2] = { rule: 'ice' };
    b.tiles[3][4] = { rule: 'trap' };
    b.tiles[1][0] = { rule: 'summit' };
    b.initialPieces[5][0] = makePiece('king', 'white');
    b.initialPieces[0][5] = makePiece('king', 'black');
    b.initialPieces[4][2] = makePiece('rook', 'white');
    b.initialPieces[4][4] = makePiece('rook', 'white');

    const state = createInitialGameState(b, registry);
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(b));

    // Ice tile at (3,2) slides rook from (4,2) -> (3,2) -> (2,2)
    const iceMove = moves.find((m) => m.from.r === 4 && m.from.c === 2 && m.to.r === 3 && m.to.c === 2)!;
    expect(iceMove.portalExit).toEqual({ r: 2, c: 2 });
    const afterIce = makeGameMove(state, iceMove, registry);
    expect(afterIce.grid[2][2]?.pieceId).toBe('rook');

    // Spike Trap at (3,4) destroys arriving rook and disarms to normal
    const trapMove = moves.find((m) => m.from.r === 4 && m.from.c === 4 && m.to.r === 3 && m.to.c === 4)!;
    const afterTrap = makeGameMove(state, trapMove, registry);
    expect(afterTrap.grid[3][4]).toBeNull();
    expect(afterTrap.tiles[3][4].rule).toBe('normal');
  });

  it('supports 4-Player Grand Cross turn rotation (White -> Red -> Black -> Blue) and elimination', () => {
    const cross = BUILTIN_BOARDS.find((b) => b.id === 'four-player-cross')!;
    let state = createInitialGameState(cross, registry);
    expect(state.players).toEqual(['white', 'red', 'black', 'blue']);
    expect(state.turn).toBe('white');

    const wMove = generateLegalMoves(state.tiles, state.grid, 'white', registry, getBoardRules(cross))[0];
    state = makeGameMove(state, wMove, registry);
    expect(state.turn).toBe('red');

    // Red pawn at (2,1) marches East to (2,2) or (2,3)
    const rMoves = generateLegalMoves(state.tiles, state.grid, 'red', registry, getBoardRules(cross));
    expect(rMoves.some((m) => m.from.r === 2 && m.from.c === 1 && m.to.r === 2 && m.to.c === 2)).toBe(true);
    state = makeGameMove(state, rMoves[0], registry);
    expect(state.turn).toBe('black');
  });

  it('supports Antichess (forced captures) and Race to Promote win conditions', () => {
    // 1. Antichess forced capture
    const anti = emptyBoard(5, 5);
    anti.rules = { winCondition: 'antichess' };
    anti.initialPieces[4][0] = makePiece('king', 'white');
    anti.initialPieces[0][4] = makePiece('king', 'black');
    anti.initialPieces[2][0] = makePiece('rook', 'white');
    anti.initialPieces[2][3] = makePiece('pawn', 'black');
    const antiState = createInitialGameState(anti, registry);
    const antiMoves = generateLegalMoves(antiState.tiles, antiState.grid, 'white', registry, getBoardRules(anti));
    // Every legal move must be a capture!
    expect(antiMoves.length).toBe(1);
    expect(antiMoves[0].captured?.pieceId).toBe('pawn');

    // 2. Race to Promote
    const race = emptyBoard(5, 5);
    race.rules = { winCondition: 'race_to_promote' };
    race.tiles[0][2] = { rule: 'promotion', promotionFor: 'white' };
    race.initialPieces[4][0] = makePiece('king', 'white');
    race.initialPieces[0][4] = makePiece('king', 'black');
    race.initialPieces[1][2] = makePiece('pawn', 'white');
    const raceState = createInitialGameState(race, registry);
    const promo = generateLegalMoves(raceState.tiles, raceState.grid, 'white', registry, getBoardRules(race)).find(
      (m) => m.promotedTo === 'queen'
    )!;
    const afterRace = makeGameMove(raceState, promo, registry);
    expect(afterRace.status).toBe('victory');
    expect(afterRace.winner).toBe('white');
  });
});
