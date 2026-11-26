export type Color = 'white' | 'black' | 'red' | 'blue';

export const ALL_COLORS: Color[] = ['white', 'black', 'red', 'blue'];

export const COLOR_LABELS: Record<Color, string> = {
  white: 'White',
  black: 'Black',
  red: 'Red',
  blue: 'Blue',
};

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

export type HopMode =
  | 'both'
  | 'move'
  | 'capture'
  | 'first_move'
  | 'en_passant'
  | 'ranged'
  | 'swap';

export interface HopOffset {
  /** Row delta from White's perspective (-1 = forward/up, +1 = backward/down). Rotated automatically for Black/Red/Blue. */
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

export type PieceBaseStyle = 'none' | 'classic' | 'pedestal' | 'shield' | 'rings';
export type PieceCrestStyle = 'none' | 'halo' | 'crown' | 'horns' | 'flame' | 'star';

export interface CustomPieceAppearance {
  mode: 'layered' | 'pixel';
  base: PieceBaseStyle;
  bodyIcon: PieceIconId;
  crest: PieceCrestStyle;
  primaryColor?: string;
  accentColor?: string;
  glowColor?: string;
  pixels?: string[][];
}

export interface PieceRules {
  royal?: boolean;
  iron?: boolean;
  blacksmith?: boolean;
  rangedAttack?: boolean;
  pawnDoubleStep?: boolean;
  enPassant?: boolean;
  castleKing?: boolean;
  castleRook?: boolean;
  explosive?: boolean;
  phasing?: boolean;
  canPromote?: boolean;
}

export interface PieceDefinition {
  id: string;
  name: string;
  shortCode: string;
  icon: PieceIconId;
  customAppearance?: CustomPieceAppearance;
  description: string;
  hops: HopOffset[];
  slides: SlideRanges;
  rules: PieceRules;
  isBuiltin?: boolean;
}

export type PortalChannel = 'A' | 'B' | 'C';

export type TileRuleType =
  | 'normal'
  | 'void'
  | 'wall'
  | 'sanctuary'
  | 'portal'
  | 'promotion'
  | 'fallow'
  | 'ice'
  | 'trap'
  | 'boost'
  | 'summit';

export interface TileConfig {
  rule: TileRuleType;
  portalChannel?: PortalChannel;
  /** Which color(s) can promote on this tile ('both' / 'all' means any player). */
  promotionFor?: Color | 'both' | 'all';
  /** Optional fixed piece ID to promote into. */
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
  | 'frost'
  | 'custom';

export type BoardFrameStyle = 'walnut' | 'gold' | 'steel' | 'minimal';

export type PiecePalette = 'ivory' | 'royal_gold' | 'jade_ruby' | 'blueprint';

export type WinCondition =
  | 'checkmate'
  | 'king_of_the_hill'
  | 'annihilation'
  | 'three_check'
  | 'capture_the_king'
  | 'antichess'
  | 'race_to_promote';

export type PromotionRuleMode =
  | 'player_choice'
  | 'all_non_royal'
  | 'captured_only'
  | 'random_pool';

export interface BoardRuleSettings {
  castlingEnabled: boolean;
  enPassantEnabled: boolean;
  drawByRepetition: boolean;
  drawByFiftyMove: boolean;
  drawByInsufficientMaterial: boolean;
  mandatoryCapture: boolean;
  friendlyFire: boolean;
  winCondition: WinCondition;
  promotionMode: PromotionRuleMode;
  promoteOnCapture: boolean;
  promotionPool: string[];
}

export const DEFAULT_BOARD_RULES: BoardRuleSettings = {
  castlingEnabled: true,
  enPassantEnabled: true,
  drawByRepetition: true,
  drawByFiftyMove: true,
  drawByInsufficientMaterial: true,
  mandatoryCapture: false,
  friendlyFire: false,
  winCondition: 'checkmate',
  promotionMode: 'player_choice',
  promoteOnCapture: false,
  promotionPool: ['queen', 'rook', 'bishop', 'knight'],
};

export interface PlacedPiece {
  id: string;
  pieceId: string;
  color: Color;
  hasMoved?: boolean;
}

export interface BoardDefinition {
  id: string;
  name: string;
  description: string;
  rows: number;
  cols: number;
  /** Active players on this board (defaults to ['white', 'black']). */
  players?: Color[];
  tiles: TileConfig[][];
  initialPieces: (PlacedPiece | null)[][];
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
  portalExit?: Coord;
  isIceSlide?: boolean;
  isRangedCapture?: boolean;
  isSwap?: boolean;
  castling?: {
    rookFrom: Coord;
    rookTo: Coord;
    side: 'kingside' | 'queenside';
  };
  enPassantCaptureCoord?: Coord;
  isDoubleStep?: boolean;
  captured?: PlacedPiece;
  promotedTo?: string;
  promotionOptions?: string[];
  notation: string;
}

export type GameStatus =
  | 'playing'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'victory';

export interface GameState {
  boardDef: BoardDefinition;
  tiles: TileConfig[][];
  grid: (PlacedPiece | null)[][];
  /** Active turn order of players on this board. */
  players: Color[];
  /** Eliminated players in 3P/4P games. */
  eliminatedPlayers: Color[];
  turn: Color;
  moveHistory: Move[];
  /** Captured pieces grouped by the color that lost them (for Captured-Only promotion & trays). */
  capturedByColor: Record<Color, PlacedPiece[]>;
  /** Pieces lost by each color. */
  lostByColor: Record<Color, PlacedPiece[]>;
  /** Checks delivered by each player (for Three-Check win condition). */
  checksDelivered: Record<Color, number>;
  status: GameStatus;
  winner?: Color;
  statusReason?: string;
  halfMoveClock: number;
  enPassantTarget?: {
    targetSquare: Coord;
    pawnSquare: Coord;
    pawnColor: Color;
  } | null;
  positionCounts: Record<string, number>;
}

export interface GraphPieceMetrics {
  pieceId: string;
  materialValue: number;
  avgMobility: number;
  pstByColor: Record<Color, number[][]>;
}

export interface BoardGraphAnalysis {
  metricsByPiece: Record<string, GraphPieceMetrics>;
  activeTileCount: number;
  portalPairs: number;
  sanctuaryCount: number;
  computeTimeMs: number;
}

export type AIDifficulty = 'novice' | 'tactician' | 'grandmaster';

export type PlayerControl = 'human' | 'ai';

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
  customLightSquare: string;
  customDarkSquare: string;
  boardFrame: BoardFrameStyle;
  piecePalette: PiecePalette;
  pieceScale: 'compact' | 'normal' | 'large';
  showCoordinates: boolean;
  showLegalMoves: boolean;
  showLastMove: boolean;
  soundEnabled: boolean;
}
