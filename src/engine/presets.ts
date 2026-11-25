import {
  AdventureNode,
  BoardDefinition,
  PieceDefinition,
  PlacedPiece,
  TileConfig,
} from './types';

export const BUILTIN_PIECES: PieceDefinition[] = [
  {
    id: 'king',
    name: 'King',
    shortCode: 'K',
    icon: 'king',
    description: 'Royal ruler. Moves 1 square in any direction. Must be defended from checkmate.',
    hops: [
      { dr: -1, dc: -1, mode: 'both' },
      { dr: -1, dc: 0, mode: 'both' },
      { dr: -1, dc: 1, mode: 'both' },
      { dr: 0, dc: -1, mode: 'both' },
      { dr: 0, dc: 1, mode: 'both' },
      { dr: 1, dc: -1, mode: 'both' },
      { dr: 1, dc: 0, mode: 'both' },
      { dr: 1, dc: 1, mode: 'both' },
    ],
    slides: {},
    rules: { royal: true, castleKing: true },
    isBuiltin: true,
  },
  {
    id: 'queen',
    name: 'Queen',
    shortCode: 'Q',
    icon: 'queen',
    description: 'Commands all 8 orthogonal and diagonal rays across the board.',
    hops: [],
    slides: { N: 16, NE: 16, E: 16, SE: 16, S: 16, SW: 16, W: 16, NW: 16 },
    rules: {},
    isBuiltin: true,
  },
  {
    id: 'rook',
    name: 'Rook',
    shortCode: 'R',
    icon: 'rook',
    description: 'Slides any distance along ranks and files. Can castle with an unmoved King.',
    hops: [],
    slides: { N: 16, E: 16, S: 16, W: 16 },
    rules: { castleRook: true },
    isBuiltin: true,
  },
  {
    id: 'bishop',
    name: 'Bishop',
    shortCode: 'B',
    icon: 'bishop',
    description: 'Slides any distance along diagonals.',
    hops: [],
    slides: { NE: 16, SE: 16, SW: 16, NW: 16 },
    rules: {},
    isBuiltin: true,
  },
  {
    id: 'knight',
    name: 'Knight',
    shortCode: 'N',
    icon: 'knight',
    description: 'Leaps in an L-shape (2+1), jumping over blocking pieces and chasms.',
    hops: [
      { dr: -2, dc: -1, mode: 'both' },
      { dr: -2, dc: 1, mode: 'both' },
      { dr: -1, dc: -2, mode: 'both' },
      { dr: -1, dc: 2, mode: 'both' },
      { dr: 1, dc: -2, mode: 'both' },
      { dr: 1, dc: 2, mode: 'both' },
      { dr: 2, dc: -1, mode: 'both' },
      { dr: 2, dc: 1, mode: 'both' },
    ],
    slides: {},
    rules: {},
    isBuiltin: true,
  },
  {
    id: 'pawn',
    name: 'Pawn',
    shortCode: 'P',
    icon: 'pawn',
    description: 'Steps forward 1 (or 2 on first move), captures diagonally forward, supports En Passant, and promotes on the far rank.',
    hops: [
      { dr: -1, dc: 0, mode: 'move' },
      { dr: -1, dc: -1, mode: 'capture' },
      { dr: -1, dc: 1, mode: 'capture' },
    ],
    slides: {},
    rules: { pawnDoubleStep: true, enPassant: true, canPromote: true },
    isBuiltin: true,
  },
  {
    id: 'archer',
    name: 'Archer',
    shortCode: 'A',
    icon: 'archer',
    description: 'Ranged marksman: steps 1 square orthogonally, and snipes enemies 2 squares away without moving!',
    hops: [
      { dr: -1, dc: 0, mode: 'move' },
      { dr: 1, dc: 0, mode: 'move' },
      { dr: 0, dc: -1, mode: 'move' },
      { dr: 0, dc: 1, mode: 'move' },
      { dr: -2, dc: 0, mode: 'capture' },
      { dr: -2, dc: -1, mode: 'capture' },
      { dr: -2, dc: 1, mode: 'capture' },
      { dr: 0, dc: -2, mode: 'capture' },
      { dr: 0, dc: 2, mode: 'capture' },
      { dr: 2, dc: 0, mode: 'capture' },
    ],
    slides: {},
    rules: { rangedAttack: true },
    isBuiltin: true,
  },
  {
    id: 'golem',
    name: 'Iron Golem',
    shortCode: 'G',
    icon: 'golem',
    description: 'Armored Iron sentinel: moves 1 square orthogonally or diagonally, and CANNOT be captured except by a Blacksmith!',
    hops: [
      { dr: -1, dc: 0, mode: 'both' },
      { dr: 1, dc: 0, mode: 'both' },
      { dr: 0, dc: -1, mode: 'both' },
      { dr: 0, dc: 1, mode: 'both' },
      { dr: -1, dc: -1, mode: 'both' },
      { dr: -1, dc: 1, mode: 'both' },
      { dr: 1, dc: -1, mode: 'both' },
      { dr: 1, dc: 1, mode: 'both' },
    ],
    slides: {},
    rules: { iron: true },
    isBuiltin: true,
  },
  {
    id: 'blacksmith',
    name: 'Blacksmith',
    shortCode: 'S',
    icon: 'blacksmith',
    description: 'Master of iron: leaps like a Knight or steps 1 orthogonally, and can shatter Iron pieces.',
    hops: [
      { dr: -2, dc: -1, mode: 'both' },
      { dr: -2, dc: 1, mode: 'both' },
      { dr: -1, dc: -2, mode: 'both' },
      { dr: -1, dc: 2, mode: 'both' },
      { dr: 1, dc: -2, mode: 'both' },
      { dr: 1, dc: 2, mode: 'both' },
      { dr: 2, dc: -1, mode: 'both' },
      { dr: 2, dc: 1, mode: 'both' },
      { dr: -1, dc: 0, mode: 'both' },
      { dr: 1, dc: 0, mode: 'both' },
      { dr: 0, dc: -1, mode: 'both' },
      { dr: 0, dc: 1, mode: 'both' },
    ],
    slides: {},
    rules: { blacksmith: true },
    isBuiltin: true,
  },
  {
    id: 'dragon',
    name: 'Dragon',
    shortCode: 'D',
    icon: 'dragon',
    description: 'Apex mythic piece: combines Rook slides with Knight leaps.',
    hops: [
      { dr: -2, dc: -1, mode: 'both' },
      { dr: -2, dc: 1, mode: 'both' },
      { dr: -1, dc: -2, mode: 'both' },
      { dr: -1, dc: 2, mode: 'both' },
      { dr: 1, dc: -2, mode: 'both' },
      { dr: 1, dc: 2, mode: 'both' },
      { dr: 2, dc: -1, mode: 'both' },
      { dr: 2, dc: 1, mode: 'both' },
    ],
    slides: { N: 16, E: 16, S: 16, W: 16 },
    rules: {},
    isBuiltin: true,
  },
  {
    id: 'wizard',
    name: 'Wizard',
    shortCode: 'W',
    icon: 'wizard',
    description: 'Teleports 2 or 3 squares diagonally or orthogonally (Camel + Alfil hops).',
    hops: [
      { dr: -2, dc: -2, mode: 'both' },
      { dr: -2, dc: 2, mode: 'both' },
      { dr: 2, dc: -2, mode: 'both' },
      { dr: 2, dc: 2, mode: 'both' },
      { dr: -3, dc: -1, mode: 'both' },
      { dr: -3, dc: 1, mode: 'both' },
      { dr: 3, dc: -1, mode: 'both' },
      { dr: 3, dc: 1, mode: 'both' },
      { dr: -1, dc: -3, mode: 'both' },
      { dr: -1, dc: 3, mode: 'both' },
      { dr: 1, dc: -3, mode: 'both' },
      { dr: 1, dc: 3, mode: 'both' },
    ],
    slides: {},
    rules: {},
    isBuiltin: true,
  },
  {
    id: 'gryphon',
    name: 'Gryphon',
    shortCode: 'Y',
    icon: 'gryphon',
    description: 'Slides diagonally up to 4 squares and hops 1 square orthogonally.',
    hops: [
      { dr: -1, dc: 0, mode: 'both' },
      { dr: 1, dc: 0, mode: 'both' },
      { dr: 0, dc: -1, mode: 'both' },
      { dr: 0, dc: 1, mode: 'both' },
    ],
    slides: { NE: 4, SE: 4, SW: 4, NW: 4 },
    rules: {},
    isBuiltin: true,
  },
  {
    id: 'spearman',
    name: 'Spearman',
    shortCode: 'L',
    icon: 'spear',
    description: 'Slides up to 2 squares forward and captures 1 square diagonally forward or sideways.',
    hops: [
      { dr: -1, dc: -1, mode: 'capture' },
      { dr: -1, dc: 1, mode: 'capture' },
      { dr: 0, dc: -1, mode: 'both' },
      { dr: 0, dc: 1, mode: 'both' },
      { dr: 1, dc: 0, mode: 'move' },
    ],
    slides: { N: 2 },
    rules: {},
    isBuiltin: true,
  },
  {
    id: 'bombardier',
    name: 'Bombardier',
    shortCode: 'X',
    icon: 'cannon',
    description: 'Explosive siege engine: hops 2 squares orthogonally or 1 diagonally. Capturing triggers a 3×3 blast!',
    hops: [
      { dr: -2, dc: 0, mode: 'both' },
      { dr: 2, dc: 0, mode: 'both' },
      { dr: 0, dc: -2, mode: 'both' },
      { dr: 0, dc: 2, mode: 'both' },
      { dr: -1, dc: -1, mode: 'both' },
      { dr: -1, dc: 1, mode: 'both' },
      { dr: 1, dc: -1, mode: 'both' },
      { dr: 1, dc: 1, mode: 'both' },
    ],
    slides: {},
    rules: { explosive: true },
    isBuiltin: true,
  },
  {
    id: 'phantom',
    name: 'Phantom',
    shortCode: 'F',
    icon: 'ghost',
    description: 'Spectral slider: glides up to 4 squares diagonally and phases right through friendly pieces.',
    hops: [],
    slides: { NE: 4, SE: 4, SW: 4, NW: 4 },
    rules: { phasing: true },
    isBuiltin: true,
  },
];

let uidCounter = 1;
export function makePiece(pieceId: string, color: 'white' | 'black'): PlacedPiece {
  return {
    id: `${color[0]}_${pieceId}_${uidCounter++}`,
    pieceId,
    color,
    hasMoved: false,
  };
}

function createEmptyGrid(rows: number, cols: number): {
  tiles: TileConfig[][];
  pieces: (PlacedPiece | null)[][];
} {
  const tiles: TileConfig[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ rule: 'normal' as const }))
  );
  const pieces: (PlacedPiece | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
  return { tiles, pieces };
}

function addStandardPromotions(tiles: TileConfig[][], fixedPieceId?: string) {
  const rows = tiles.length;
  const cols = tiles[0].length;
  for (let c = 0; c < cols; c++) {
    if (tiles[0][c].rule === 'normal') {
      tiles[0][c] = { rule: 'promotion', promotionFor: 'white', promoteToPieceId: fixedPieceId };
    }
    if (tiles[rows - 1][c].rule === 'normal') {
      tiles[rows - 1][c] = { rule: 'promotion', promotionFor: 'black', promoteToPieceId: fixedPieceId };
    }
  }
}

function buildClassicChess(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(8, 8);
  addStandardPromotions(tiles);
  const back = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let c = 0; c < 8; c++) {
    pieces[0][c] = makePiece(back[c], 'black');
    pieces[1][c] = makePiece('pawn', 'black');
    pieces[6][c] = makePiece('pawn', 'white');
    pieces[7][c] = makePiece(back[c], 'white');
  }
  return {
    id: 'classic-chess',
    name: 'Classic 8×8 Chess',
    description: 'Traditional chess on an 8×8 board with promotion zones on the back ranks.',
    rows: 8,
    cols: 8,
    tiles,
    initialPieces: pieces,
    theme: 'classic',
    difficulty: 2,
    isBuiltin: true,
  };
}

function buildAcademySkirmish(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(5, 5);
  addStandardPromotions(tiles);
  const back = ['rook', 'knight', 'king', 'bishop', 'rook'];
  for (let c = 0; c < 5; c++) {
    pieces[0][c] = makePiece(back[c], 'black');
    pieces[1][c] = makePiece('pawn', 'black');
    pieces[3][c] = makePiece('pawn', 'white');
    pieces[4][c] = makePiece(back[c], 'white');
  }
  return {
    id: 'academy-skirmish',
    name: 'Courtyard Skirmish',
    description: 'A brisk 5×5 tactical board — fast opening clashes and immediate king safety lessons.',
    rows: 5,
    cols: 5,
    tiles,
    initialPieces: pieces,
    theme: 'classic',
    difficulty: 1,
    isBuiltin: true,
  };
}

function buildAcademyArchers(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(6, 6);
  addStandardPromotions(tiles);
  const back = ['rook', 'archer', 'king', 'queen', 'archer', 'rook'];
  for (let c = 0; c < 6; c++) {
    pieces[0][c] = makePiece(back[c], 'black');
    pieces[1][c] = makePiece('pawn', 'black');
    pieces[4][c] = makePiece('pawn', 'white');
    pieces[5][c] = makePiece(back[c], 'white');
  }
  return {
    id: 'academy-archers',
    name: 'Archers of the Watch',
    description: 'Introduces Ranged Attack Archers that snipe enemy pieces from 2 squares away without moving.',
    rows: 6,
    cols: 6,
    tiles,
    initialPieces: pieces,
    theme: 'emerald',
    difficulty: 1,
    isBuiltin: true,
  };
}

function buildSanctuaryGarden(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(7, 7);
  addStandardPromotions(tiles);
  // Central sanctuary cross
  tiles[3][3] = { rule: 'sanctuary' };
  tiles[3][1] = { rule: 'sanctuary' };
  tiles[3][5] = { rule: 'sanctuary' };
  const back = ['rook', 'knight', 'bishop', 'king', 'bishop', 'knight', 'rook'];
  for (let c = 0; c < 7; c++) {
    pieces[0][c] = makePiece(back[c], 'black');
    pieces[1][c] = makePiece('pawn', 'black');
    pieces[5][c] = makePiece('pawn', 'white');
    pieces[6][c] = makePiece(back[c], 'white');
  }
  return {
    id: 'sanctuary-garden',
    name: 'Sanctuary Courtyard',
    description: 'Three gilded Sanctuary tiles protect any piece standing upon them from capture.',
    rows: 7,
    cols: 7,
    tiles,
    initialPieces: pieces,
    theme: 'emerald',
    difficulty: 1,
    isBuiltin: true,
  };
}

function buildIronGate(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(7, 7);
  addStandardPromotions(tiles, 'dragon');
  const back = ['rook', 'blacksmith', 'golem', 'king', 'golem', 'blacksmith', 'rook'];
  for (let c = 0; c < 7; c++) {
    pieces[0][c] = makePiece(back[c], 'black');
    pieces[1][c] = makePiece('spearman', 'black');
    pieces[5][c] = makePiece('spearman', 'white');
    pieces[6][c] = makePiece(back[c], 'white');
  }
  return {
    id: 'iron-gate',
    name: 'The Iron Bastion',
    description: 'Iron Golems cannot be captured by ordinary pieces — only Blacksmiths can shatter their armor!',
    rows: 7,
    cols: 7,
    tiles,
    initialPieces: pieces,
    theme: 'stone',
    difficulty: 2,
    isBuiltin: true,
  };
}

function buildCrumblingBridge(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(7, 7);
  // Central 1-row chasm with a permanent stone causeway at c=3 and two crumbling Fallow flank bridges (3 crossings each).
  for (let c = 0; c < 7; c++) {
    if (c === 1 || c === 5) {
      tiles[3][c] = { rule: 'fallow', fallowUses: 3 };
    } else if (c === 3) {
      tiles[3][c] = { rule: 'boost' };
    } else {
      tiles[3][c] = { rule: 'void' };
    }
  }
  addStandardPromotions(tiles);
  const whiteBack = ['rook', 'knight', 'gryphon', 'king', 'queen', 'knight', 'rook'];
  const blackBack = ['rook', 'knight', 'spearman', 'king', 'gryphon', 'knight', 'rook'];
  for (let c = 0; c < 7; c++) {
    pieces[0][c] = makePiece(blackBack[c], 'black');
    pieces[1][c] = makePiece('pawn', 'black');
    pieces[5][c] = makePiece('pawn', 'white');
    pieces[6][c] = makePiece(whiteBack[c], 'white');
  }
  return {
    id: 'crumbling-bridge',
    name: 'Crumbling Bridges',
    description: 'Two Fallow flank bridges crumble after 3 crossings while a central Boost causeway stays open. Lead your Queen and Knights across!',
    rows: 7,
    cols: 7,
    tiles,
    initialPieces: pieces,
    theme: 'sandstone',
    difficulty: 1,
    isBuiltin: true,
  };
}

function buildIronFortress(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(8, 8);
  // Cut corners into an octagonal arena
  const voids = [
    [0, 0], [0, 7], [7, 0], [7, 7],
    [3, 3], [3, 4], [4, 3], [4, 4],
  ];
  for (const [r, c] of voids) tiles[r][c] = { rule: 'void' };
  tiles[2][3] = { rule: 'sanctuary' };
  tiles[5][4] = { rule: 'sanctuary' };
  addStandardPromotions(tiles, 'dragon');

  const back = [null, 'blacksmith', 'golem', 'king', 'queen', 'golem', 'blacksmith', null];
  for (let c = 0; c < 8; c++) {
    if (back[c]) {
      pieces[0][c] = makePiece(back[c]!, 'black');
      pieces[7][c] = makePiece(back[c]!, 'white');
    }
    pieces[1][c] = makePiece(c % 2 === 0 ? 'archer' : 'pawn', 'black');
    pieces[6][c] = makePiece(c % 2 === 0 ? 'archer' : 'pawn', 'white');
  }
  return {
    id: 'iron-fortress',
    name: 'Citadel Ring',
    description: 'An octagonal fortress with a hollow center, twin Sanctuaries, Archers, and Iron Golems.',
    rows: 8,
    cols: 8,
    tiles,
    initialPieces: pieces,
    theme: 'stone',
    difficulty: 2,
    isBuiltin: true,
  };
}

function buildTwinPortals(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(8, 8);
  addStandardPromotions(tiles);
  // Portal pair A on flanks, pair B diagonally
  tiles[2][0] = { rule: 'portal', portalChannel: 'A' };
  tiles[5][7] = { rule: 'portal', portalChannel: 'A' };
  tiles[2][7] = { rule: 'portal', portalChannel: 'B' };
  tiles[5][0] = { rule: 'portal', portalChannel: 'B' };
  const back = ['rook', 'wizard', 'bishop', 'queen', 'king', 'bishop', 'wizard', 'rook'];
  for (let c = 0; c < 8; c++) {
    pieces[0][c] = makePiece(back[c], 'black');
    pieces[1][c] = makePiece('pawn', 'black');
    pieces[6][c] = makePiece('pawn', 'white');
    pieces[7][c] = makePiece(back[c], 'white');
  }
  return {
    id: 'twin-portals',
    name: 'Witch Window Strait',
    description: 'Linked Portals warp pieces instantly across flanks, paired with leaping Wizards.',
    rows: 8,
    cols: 8,
    tiles,
    initialPieces: pieces,
    theme: 'obsidian',
    difficulty: 2,
    isBuiltin: true,
  };
}

function buildSplitIslands(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(8, 9);
  // Two islands separated by column 4 chasm, connected ONLY by Portals and jumpers!
  for (let r = 0; r < 8; r++) {
    tiles[r][4] = { rule: 'void' };
  }
  tiles[2][2] = { rule: 'portal', portalChannel: 'A' };
  tiles[5][6] = { rule: 'portal', portalChannel: 'A' };
  tiles[5][2] = { rule: 'portal', portalChannel: 'B' };
  tiles[2][6] = { rule: 'portal', portalChannel: 'B' };
  tiles[3][1] = { rule: 'sanctuary' };
  tiles[4][7] = { rule: 'sanctuary' };
  addStandardPromotions(tiles, 'dragon');

  const leftBack = ['rook', 'wizard', 'king', 'archer'];
  const rightBack = ['archer', 'queen', 'wizard', 'rook'];
  for (let i = 0; i < 4; i++) {
    pieces[0][i] = makePiece(leftBack[i], 'black');
    pieces[1][i] = makePiece('pawn', 'black');
    pieces[0][i + 5] = makePiece(rightBack[i], 'black');
    pieces[1][i + 5] = makePiece('pawn', 'black');

    pieces[7][i] = makePiece(leftBack[i], 'white');
    pieces[6][i] = makePiece('pawn', 'white');
    pieces[7][i + 5] = makePiece(rightBack[i], 'white');
    pieces[6][i + 5] = makePiece('pawn', 'white');
  }
  return {
    id: 'split-islands',
    name: 'Split Archipelago',
    description: 'A chasm splits the board in two! Only Portals, Wizards, and Ranged Archers can project power across.',
    rows: 8,
    cols: 9,
    tiles,
    initialPieces: pieces,
    theme: 'obsidian',
    difficulty: 3,
    isBuiltin: true,
  };
}

function buildDragonCrown(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(9, 9);
  addStandardPromotions(tiles, 'dragon');
  tiles[4][4] = { rule: 'sanctuary' };
  tiles[4][0] = { rule: 'portal', portalChannel: 'C' };
  tiles[4][8] = { rule: 'portal', portalChannel: 'C' };
  const back = ['rook', 'knight', 'gryphon', 'dragon', 'king', 'queen', 'gryphon', 'knight', 'rook'];
  for (let c = 0; c < 9; c++) {
    pieces[0][c] = makePiece(back[c], 'black');
    pieces[1][c] = makePiece(c === 4 ? 'golem' : 'pawn', 'black');
    pieces[7][c] = makePiece(c === 4 ? 'golem' : 'pawn', 'white');
    pieces[8][c] = makePiece(back[c], 'white');
  }
  return {
    id: 'dragon-crown',
    name: 'Dragon Crown 9×9',
    description: 'Expanded 9×9 battlefield featuring Dragons, Gryphons, Iron vanguard, and flank Portals.',
    rows: 9,
    cols: 9,
    tiles,
    initialPieces: pieces,
    theme: 'sandstone',
    difficulty: 3,
    isBuiltin: true,
  };
}

function buildGrandColosseum(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(10, 10);
  // Diamond-trimmed corners
  const corners = [
    [0, 0], [0, 9], [9, 0], [9, 9],
  ];
  for (const [r, c] of corners) tiles[r][c] = { rule: 'void' };
  tiles[4][4] = { rule: 'fallow', fallowUses: 3 };
  tiles[4][5] = { rule: 'fallow', fallowUses: 3 };
  tiles[5][4] = { rule: 'fallow', fallowUses: 3 };
  tiles[5][5] = { rule: 'fallow', fallowUses: 3 };
  tiles[3][1] = { rule: 'portal', portalChannel: 'A' };
  tiles[6][8] = { rule: 'portal', portalChannel: 'A' };
  tiles[3][8] = { rule: 'portal', portalChannel: 'B' };
  tiles[6][1] = { rule: 'portal', portalChannel: 'B' };
  tiles[4][2] = { rule: 'sanctuary' };
  tiles[5][7] = { rule: 'sanctuary' };
  addStandardPromotions(tiles, 'dragon');

  const back = [null, 'rook', 'blacksmith', 'wizard', 'dragon', 'king', 'queen', 'gryphon', 'rook', null];
  for (let c = 0; c < 10; c++) {
    if (back[c]) {
      pieces[0][c] = makePiece(back[c]!, 'black');
      pieces[9][c] = makePiece(back[c]!, 'white');
    }
    pieces[1][c] = makePiece(c === 2 || c === 7 ? 'archer' : c === 4 || c === 5 ? 'golem' : 'pawn', 'black');
    pieces[8][c] = makePiece(c === 2 || c === 7 ? 'archer' : c === 4 || c === 5 ? 'golem' : 'pawn', 'white');
  }
  return {
    id: 'grand-colosseum',
    name: 'Grandmaster Colosseum',
    description: 'The ultimate 10×10 variant: every custom piece and tile rule converges in one epic clash.',
    rows: 10,
    cols: 10,
    tiles,
    initialPieces: pieces,
    theme: 'obsidian',
    difficulty: 3,
    isBuiltin: true,
  };
}

function buildRoyalTwinKings(): BoardDefinition {
  const { tiles, pieces } = createEmptyGrid(8, 8);
  addStandardPromotions(tiles);
  tiles[3][3] = { rule: 'sanctuary' };
  tiles[4][4] = { rule: 'sanctuary' };
  const back = ['rook', 'knight', 'king', 'queen', 'bishop', 'king', 'knight', 'rook'];
  for (let c = 0; c < 8; c++) {
    pieces[0][c] = makePiece(back[c], 'black');
    pieces[1][c] = makePiece('spearman', 'black');
    pieces[6][c] = makePiece('spearman', 'white');
    pieces[7][c] = makePiece(back[c], 'white');
  }
  return {
    id: 'twin-kings',
    name: 'Dual Monarchy',
    description: 'Two Royal Kings per side! Protect both crowns — any check against either King must be answered.',
    rows: 8,
    cols: 8,
    tiles,
    initialPieces: pieces,
    theme: 'classic',
    difficulty: 3,
    isBuiltin: true,
  };
}

export const BUILTIN_BOARDS: BoardDefinition[] = [
  buildAcademySkirmish(),
  buildAcademyArchers(),
  buildSanctuaryGarden(),
  buildClassicChess(),
  buildIronGate(),
  buildCrumblingBridge(),
  buildIronFortress(),
  buildTwinPortals(),
  buildSplitIslands(),
  buildRoyalTwinKings(),
  buildDragonCrown(),
  buildGrandColosseum(),
];

export const ADVENTURE_NODES: AdventureNode[] = [
  // Island 1: Academy Isle
  {
    id: 'node-1',
    island: 'Academy Isle',
    islandIndex: 0,
    order: 1,
    title: 'Courtyard Skirmish',
    subtitle: '5×5 Quick Clash',
    boardId: 'academy-skirmish',
    aiDifficulty: 'novice',
    rewardXp: 100,
    rewardGems: 15,
    mapX: 115,
    mapY: 390,
  },
  {
    id: 'node-2',
    island: 'Academy Isle',
    islandIndex: 0,
    order: 2,
    title: 'Archers of the Watch',
    subtitle: 'Ranged Attacks',
    boardId: 'academy-archers',
    aiDifficulty: 'novice',
    rewardXp: 140,
    rewardGems: 20,
    mapX: 195,
    mapY: 285,
    requires: ['node-1'],
  },
  {
    id: 'node-3',
    island: 'Academy Isle',
    islandIndex: 0,
    order: 3,
    title: 'Sanctuary Courtyard',
    subtitle: 'Safe Haven Tiles',
    boardId: 'sanctuary-garden',
    aiDifficulty: 'novice',
    rewardXp: 180,
    rewardGems: 25,
    mapX: 255,
    mapY: 410,
    requires: ['node-2'],
  },
  // Island 2: Iron Citadel
  {
    id: 'node-4',
    island: 'Iron Citadel',
    islandIndex: 1,
    order: 4,
    title: 'The Iron Bastion',
    subtitle: 'Iron vs Blacksmith',
    boardId: 'iron-gate',
    aiDifficulty: 'tactician',
    rewardXp: 220,
    rewardGems: 35,
    mapX: 380,
    mapY: 315,
    requires: ['node-3'],
  },
  {
    id: 'node-5',
    island: 'Iron Citadel',
    islandIndex: 1,
    order: 5,
    title: 'Crumbling Bridges',
    subtitle: 'Fallow & Boost Causeway',
    boardId: 'crumbling-bridge',
    aiDifficulty: 'novice',
    rewardXp: 260,
    rewardGems: 40,
    mapX: 430,
    mapY: 190,
    requires: ['node-4'],
  },
  {
    id: 'node-6',
    island: 'Iron Citadel',
    islandIndex: 1,
    order: 6,
    title: 'Citadel Ring',
    subtitle: 'Octagonal Arena',
    boardId: 'iron-fortress',
    aiDifficulty: 'tactician',
    rewardXp: 300,
    rewardGems: 50,
    mapX: 525,
    mapY: 295,
    requires: ['node-5'],
  },
  // Island 3: Portal Archipelago
  {
    id: 'node-7',
    island: 'Portal Archipelago',
    islandIndex: 2,
    order: 7,
    title: 'Witch Window Strait',
    subtitle: 'Teleporter Portals',
    boardId: 'twin-portals',
    aiDifficulty: 'tactician',
    rewardXp: 340,
    rewardGems: 55,
    mapX: 625,
    mapY: 405,
    requires: ['node-6'],
  },
  {
    id: 'node-8',
    island: 'Portal Archipelago',
    islandIndex: 2,
    order: 8,
    title: 'Split Archipelago',
    subtitle: 'Divided Islands',
    boardId: 'split-islands',
    aiDifficulty: 'tactician',
    rewardXp: 380,
    rewardGems: 65,
    mapX: 735,
    mapY: 340,
    requires: ['node-7'],
  },
  {
    id: 'node-9',
    island: 'Portal Archipelago',
    islandIndex: 2,
    order: 9,
    title: 'Dual Monarchy',
    subtitle: 'Twin Royal Kings',
    boardId: 'twin-kings',
    aiDifficulty: 'grandmaster',
    rewardXp: 420,
    rewardGems: 75,
    mapX: 705,
    mapY: 215,
    requires: ['node-8'],
  },
  // Island 4: Grandmaster Spire
  {
    id: 'node-10',
    island: 'Grandmaster Spire',
    islandIndex: 3,
    order: 10,
    title: 'Classic Mastery',
    subtitle: 'Traditional 8×8',
    boardId: 'classic-chess',
    aiDifficulty: 'grandmaster',
    rewardXp: 460,
    rewardGems: 80,
    mapX: 820,
    mapY: 165,
    requires: ['node-9'],
  },
  {
    id: 'node-11',
    island: 'Grandmaster Spire',
    islandIndex: 3,
    order: 11,
    title: 'Dragon Crown 9×9',
    subtitle: 'Mythic Vanguard',
    boardId: 'dragon-crown',
    aiDifficulty: 'grandmaster',
    rewardXp: 540,
    rewardGems: 100,
    mapX: 895,
    mapY: 255,
    requires: ['node-10'],
  },
  {
    id: 'node-12',
    island: 'Grandmaster Spire',
    islandIndex: 3,
    order: 12,
    title: 'Grandmaster Colosseum',
    subtitle: 'Final Obelisk 10×10',
    boardId: 'grand-colosseum',
    aiDifficulty: 'grandmaster',
    rewardXp: 750,
    rewardGems: 150,
    mapX: 905,
    mapY: 105,
    requires: ['node-11'],
  },
];
