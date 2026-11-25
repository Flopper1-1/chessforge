import { describe, expect, it } from 'vitest';
import { BUILTIN_BOARDS, BUILTIN_PIECES, makePiece } from './presets';
import {
  createInitialGameState,
  generateLegalMoves,
  isColorInCheck,
  makeGameMove,
  PieceRegistry,
} from './rules';
import { analyzeBoardGraph, chooseAIMove, estimatePieceValueOnStandardBoard } from './graphAi';
import { BoardDefinition, TileConfig } from './types';

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
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry);
    // 16 pawn moves (8x2) + 4 knight moves = 20
    expect(moves.length).toBe(20);
  });

  it('enforces Iron protection and Blacksmith armor-breaking', () => {
    const b = emptyBoard(5, 5);
    b.initialPieces[4][0] = makePiece('king', 'white');
    b.initialPieces[0][4] = makePiece('king', 'black');
    b.initialPieces[2][2] = makePiece('golem', 'black'); // Iron piece
    b.initialPieces[2][0] = makePiece('rook', 'white'); // Normal rook
    b.initialPieces[3][2] = makePiece('blacksmith', 'white'); // Blacksmith

    const state = createInitialGameState(b, registry);
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry);

    // Rook cannot capture Iron Golem at (2,2)
    const rookCapture = moves.find(
      (m) => m.from.r === 2 && m.from.c === 0 && m.to.r === 2 && m.to.c === 2
    );
    expect(rookCapture).toBeUndefined();

    // Blacksmith CAN capture Iron Golem at (2,2)
    const smithCapture = moves.find(
      (m) => m.from.r === 3 && m.from.c === 2 && m.to.r === 2 && m.to.c === 2
    );
    expect(smithCapture).toBeDefined();
    expect(smithCapture?.captured?.pieceId).toBe('golem');
  });

  it('supports Ranged Attack captures without moving the attacker', () => {
    const b = emptyBoard(5, 5);
    b.initialPieces[4][0] = makePiece('king', 'white');
    b.initialPieces[0][4] = makePiece('king', 'black');
    b.initialPieces[3][2] = makePiece('archer', 'white');
    b.initialPieces[1][2] = makePiece('pawn', 'black'); // 2 squares forward

    const state = createInitialGameState(b, registry);
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry);
    const snipe = moves.find(
      (m) => m.from.r === 3 && m.from.c === 2 && m.to.r === 1 && m.to.c === 2
    );
    expect(snipe).toBeDefined();
    expect(snipe?.isRangedCapture).toBe(true);

    const next = makeGameMove(state, snipe!, registry);
    // Archer remains on (3,2), black pawn at (1,2) is gone
    expect(next.grid[3][2]?.pieceId).toBe('archer');
    expect(next.grid[1][2]).toBeNull();
  });

  it('protects pieces standing on Sanctuary tiles from capture', () => {
    const b = emptyBoard(5, 5);
    b.tiles[2][2] = { rule: 'sanctuary' };
    b.initialPieces[4][0] = makePiece('king', 'white');
    b.initialPieces[0][4] = makePiece('king', 'black');
    b.initialPieces[2][2] = makePiece('queen', 'black');
    b.initialPieces[2][0] = makePiece('rook', 'white');

    const state = createInitialGameState(b, registry);
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry);
    const captureOnSanctuary = moves.find((m) => m.to.r === 2 && m.to.c === 2);
    expect(captureOnSanctuary).toBeUndefined();
  });

  it('teleports pieces through linked Portal pairs', () => {
    const b = emptyBoard(5, 5);
    b.tiles[2][2] = { rule: 'portal', portalChannel: 'A' };
    b.tiles[0][0] = { rule: 'portal', portalChannel: 'A' };
    b.initialPieces[4][4] = makePiece('king', 'white');
    b.initialPieces[0][4] = makePiece('king', 'black');
    b.initialPieces[2][0] = makePiece('rook', 'white');

    const state = createInitialGameState(b, registry);
    const moves = generateLegalMoves(state.tiles, state.grid, 'white', registry);
    const portalMove = moves.find(
      (m) => m.from.r === 2 && m.from.c === 0 && m.to.r === 2 && m.to.c === 2
    );
    expect(portalMove).toBeDefined();
    expect(portalMove?.portalExit).toEqual({ r: 0, c: 0 });

    const next = makeGameMove(state, portalMove!, registry);
    expect(next.grid[0][0]?.pieceId).toBe('rook');
    expect(next.grid[2][2]).toBeNull();
  });

  it('crumbles Fallow tiles into Void after their uses are exhausted', () => {
    const b = emptyBoard(5, 5);
    b.tiles[2][2] = { rule: 'fallow', fallowUses: 1 };
    b.initialPieces[4][0] = makePiece('king', 'white');
    b.initialPieces[0][4] = makePiece('king', 'black');
    b.initialPieces[3][2] = makePiece('rook', 'white');

    let state = createInitialGameState(b, registry);
    const stepOnto = generateLegalMoves(state.tiles, state.grid, 'white', registry).find(
      (m) => m.from.r === 3 && m.from.c === 2 && m.to.r === 2 && m.to.c === 2
    )!;
    state = makeGameMove(state, stepOnto, registry);
    expect(state.tiles[2][2].fallowUses).toBe(0);

    // Black makes any move
    const blackMove = generateLegalMoves(state.tiles, state.grid, 'black', registry)[0];
    state = makeGameMove(state, blackMove, registry);

    // White rook steps off (2,2), causing it to collapse into void
    const stepOff = generateLegalMoves(state.tiles, state.grid, 'white', registry).find(
      (m) => m.from.r === 2 && m.from.c === 2 && m.to.r === 3 && m.to.c === 2
    )!;
    state = makeGameMove(state, stepOff, registry);
    expect(state.tiles[2][2].rule).toBe('void');
  });

  it('detects checkmate accurately', () => {
    const b = emptyBoard(4, 4);
    b.initialPieces[0][0] = makePiece('king', 'black');
    b.initialPieces[1][2] = makePiece('queen', 'white');
    b.initialPieces[2][1] = makePiece('rook', 'white');
    b.initialPieces[3][3] = makePiece('king', 'white');

    const state = createInitialGameState(b, registry);
    // White queen moves to (1,1) protected by rook on (2,1) -> checkmate
    const mateMove = generateLegalMoves(state.tiles, state.grid, 'white', registry).find(
      (m) => m.from.r === 1 && m.from.c === 2 && m.to.r === 1 && m.to.c === 1
    )!;
    const next = makeGameMove(state, mateMove, registry);
    expect(isColorInCheck(next.tiles, next.grid, 'black', registry)).toBe(true);
    expect(next.status).toBe('checkmate');
    expect(next.winner).toBe('white');
  });

  it('Graph-Theory AI values Queen > Rook > Pawn and chooses winning captures', () => {
    const queenEst = estimatePieceValueOnStandardBoard(registry.queen);
    const rookEst = estimatePieceValueOnStandardBoard(registry.rook);
    const pawnEst = estimatePieceValueOnStandardBoard(registry.pawn);
    expect(queenEst.points).toBeGreaterThan(rookEst.points);
    expect(rookEst.points).toBeGreaterThan(pawnEst.points);

    // AI should capture a free hanging Queen
    const b = emptyBoard(6, 6);
    b.initialPieces[5][0] = makePiece('king', 'white');
    b.initialPieces[0][5] = makePiece('king', 'black');
    b.initialPieces[2][2] = makePiece('queen', 'black');
    b.initialPieces[2][0] = makePiece('rook', 'white');

    const state = createInitialGameState(b, registry);
    const analysis = analyzeBoardGraph(state.tiles, ['king', 'queen', 'rook'], registry);
    const result = chooseAIMove(state, registry, 'tactician', analysis);
    expect(result.bestMove).not.toBeNull();
    expect(result.bestMove?.to).toEqual({ r: 2, c: 2 });
    expect(result.bestMove?.captured?.pieceId).toBe('queen');
  });
});
