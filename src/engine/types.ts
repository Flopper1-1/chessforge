export type Color = 'white' | 'black';

export type Direction8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export const DIRECTIONS_8: Record<Direction8, { dr: number; dc: number }> = {
  N: { dr: -1, dc: 0 },
  NE: { dr: -1, dc: 1 },
  E: { dr: 0, dc: 1 },
  SE: { dr: 1, dc: 1 },
  S: { dr: 1, dc: 0 },
  SW: { dr: 1, dc: -1 },
  W: { dr: 0, dc: -1 },
  NW: { dr: -1, dc: -1 },
};

export type HopMode = 'both' | 'move' | 'capture';

export interface HopOffset {
  /** Row delta from White's perspective (-1 = forward/up, +1 = backward/down). Flipped automatically for Black. */
  dr: number;
  /** Column delta (-3..+3). */
  dc: number;
  mode: HopMode;
}

export type SlideRanges = Partial<Record<Direction8, number>>; // 0 or undefined = disabled, 1..16 = max steps (16 = unlimited)

export type PieceIconId =
  | 'king'
  | 'queen'
  | 'rook'
  | 'bishop'
  | 'knight'
  | 'pawn'
  | 'archer'
  | 'golem'
  | 'blacksmith'
  | 'dragon'
  | 'wizard'
  | 'gryphon'
  | 'shield'
  | 'spear'
  | 'crown'
  | 'star'
  | 'ghost'
  | 'cannon'
  | 'hammer'
  | 'tower';

export interface PieceRules {
  /** Must be defended; can be put in check and checkmated. */
  royal?: boolean;
  /** Cannot be captured by normal pieces (only by Blacksmith pieces). */
  iron?: boolean;
  /** Can capture Iron pieces. */
  blacksmith?: boolean;
  /** Captures enemy pieces from afar without moving onto their square. */
  rangedAttack?: boolean;
  /** Allows a 2-step forward move on its first move (classic Pawn feel). */
  pawnDoubleStep?: boolean;
  /** Can perform and be captured by En Passant after a 2-step move. */
  enPassant?: boolean;
  /** Can initiate castling as the Royal piece. */
  castleKing?: boolean;
  /** Can participate in castling as the Rook partner. */
  castleRook?: boolean;
  /** Atomic/Explosive capture: destroys adjacent non-Royal pieces in a 3x3 blast. */
  explosive?: boolean;
  /** Sliding rays can phase through friendly pieces. */
  phasing?: boolean;
  /** Eligible to promote on Promotion Zones (defaults to true for non-Royals). */
  canPromote?: boolean;
}

export interface PieceDefinition {
  id: string;
  name: string;
  shortCode: string;
  icon: PieceIconId;
  description: string;
  /** Relative hops in the 7x7 grid (dr, dc in -3..3) from White's perspective. */
  hops: HopOffset[];
  /** Sliding rays in 8 directions (from White's perspective; N/S flipped for Black). */
  slides: SlideRanges;
  rules: PieceRules;
  isBuiltin?: boolean;
}

export type PortalChannel = 'A' | 'B' | 'C';

export type TileRuleType =
  | 'normal'
  | 'void'
  | 'sanctuary'
  | 'portal'
  | 'promotion'
  | 'fallow';

export interface TileConfig {
  rule: TileRuleType;
  portalChannel?: PortalChannel;
  /** Which color(s) can promote on this tile. */
  promotionFor?: 'white' | 'black' | 'both';
  /** Optional fixed piece ID to promote into. When omitted, player chooses from board's promotionPool! */
  promoteToPieceId?: string;
  /** Remaining steps allowed on a fallow tile before it crumbles to void. */
  fallowUses?: number;
}

export type BoardTheme =
  | 'classic'
  | 'stone'
  | 'emerald'
  | 'obsidian'
  | 'sandstone'
  | 'crimson'
  | 'frost';

export type PiecePalette = 'ivory' | 'royal_gold' | 'jade_ruby' | 'blueprint';

export type WinCondition = 'checkmate' | 'king_of_the_hill' | 'annihilation';

export interface BoardRuleSettings {
  castlingEnabled: boolean;
  enPassantEnabled: boolean;
  drawByRepetition: boolean;
  drawByFiftyMove: boolean;
  drawByInsufficientMaterial: boolean;
  winCondition: WinCondition;
  /** Piece IDs the player can choose from when promoting. */
  promotionPool: string[];
}

export const DEFAULT_BOARD_RULES: BoardRuleSettings = {
  castlingEnabled: true,
  enPassantEnabled: true,
  drawByRepetition: true,
  drawByFiftyMove: true,
  drawByInsufficientMaterial: true,
  winCondition: 'checkmate',
  promotionPool: ['queen', 'rook', 'bishop', 'knight'],
};

export interface PlacedPiece {
  id: string; // unique instance id
  pieceId: string; // references PieceDefinition.id
  color: Color;
  hasMoved?: boolean;
}

export interface BoardDefinition {
  id: string;
  name: string;
  description: string;
  rows: number; // 4..16
  cols: number; // 4..16
  /** Indexed [r][c] */
  tiles: TileConfig[][];
  /** Initial placement indexed [r][c] */
  initialPieces: (PlacedPiece | null)[][];
  /** Custom piece definitions bundled with this board (for sharing/portability). */
  customPieces?: PieceDefinition[];
  difficulty?: 1 | 2 | 3;
  theme?: BoardTheme;
  rules?: Partial<BoardRuleSettings>;
  isBuiltin?: boolean;
}

export interface Coord {
  r: number;
  c: number;
}

export interface Move {
  from: Coord;
  to: Coord;
  /** If a portal warps the piece after landing on `to`, this is its final square. */
  portalExit?: Coord;
  /** True when a Ranged Attack captures on `to` while the attacker stays on `from`. */
  isRangedCapture?: boolean;
  /** Castling partner rook movement */
  castling?: {
    rookFrom: Coord;
    rookTo: Coord;
    side: 'kingside' | 'queenside';
  };
  /** En passant capture square (where the captured pawn actually sits) */
  enPassantCaptureCoord?: Coord;
  /** True when a pawn performed a 2-step double push (sets enPassantTarget on next state) */
  isDoubleStep?: boolean;
  captured?: PlacedPiece;
  promotedTo?: string;
  /** When multiple promotion options exist on this square, UI opens the picker! */
  promotionOptions?: string[];
  notation: string;
}

export type GameStatus =
  | 'playing'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'victory_white'
  | 'victory_black';

export interface GameState {
  boardDef: BoardDefinition;
  /** Live mutable-cloned tiles (fallow tiles decrement and crumble to void). */
  tiles: TileConfig[][];
  /** Live pieces [r][c] */
  grid: (PlacedPiece | null)[][];
  turn: Color;
  moveHistory: Move[];
  capturedByWhite: PlacedPiece[];
  capturedByBlack: PlacedPiece[];
  status: GameStatus;
  winner?: Color;
  statusReason?: string;
  halfMoveClock: number;
  /** En passant target square available on the very next ply only. */
  enPassantTarget?: {
    targetSquare: Coord;
    pawnSquare: Coord;
    pawnColor: Color;
  } | null;
  /** Position hash -> occurrence count for threefold repetition detection. */
  positionCounts: Record<string, number>;
}

export interface GraphPieceMetrics {
  pieceId: string;
  materialValue: number;
  avgMobility: number;
  /** Normalized 0..1 heatmap [r][c] per color. */
  pstWhite: number[][];
  pstBlack: number[][];
}

export interface BoardGraphAnalysis {
  metricsByPiece: Record<string, GraphPieceMetrics>;
  activeTileCount: number;
  portalPairs: number;
  sanctuaryCount: number;
  computeTimeMs: number;
}

export type AIDifficulty = 'novice' | 'tactician' | 'grandmaster';

export interface AdventureNode {
  id: string;
  island: 'Academy Isle' | 'Iron Citadel' | 'Portal Archipelago' | 'Grandmaster Spire';
  islandIndex: number;
  order: number;
  title: string;
  subtitle: string;
  boardId: string;
  aiDifficulty: AIDifficulty;
  rewardXp: number;
  rewardGems: number;
  /** Coordinates on the SVG island map (0..1000 x 0..560). */
  mapX: number;
  mapY: number;
  requires?: string[];
}

export interface AdventureProgress {
  completedNodeIds: string[];
  xp: number;
  gems: number;
}

export interface UIPreferences {
  boardThemeOverride: BoardTheme | 'board_default';
  piecePalette: PiecePalette;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  showLastMove: boolean;
  soundEnabled: boolean;
}
