import { AdventureProgress, BoardDefinition, PieceDefinition, UIPreferences } from './types';

const KEYS = {
  CUSTOM_PIECES: 'chessforge_custom_pieces_v1',
  CUSTOM_BOARDS: 'chessforge_custom_boards_v1',
  ADVENTURE: 'chessforge_adventure_v1',
  UI_PREFS: 'chessforge_ui_prefs_v1',
};

export const DEFAULT_UI_PREFS: UIPreferences = {
  boardThemeOverride: 'board_default',
  customLightSquare: '#e8d5b5',
  customDarkSquare: '#9e7248',
  boardFrame: 'walnut',
  piecePalette: 'ivory',
  pieceScale: 'normal',
  showCoordinates: true,
  showLegalMoves: true,
  showLastMove: true,
  soundEnabled: true,
};

export function loadUIPreferences(): UIPreferences {
  try {
    const raw = localStorage.getItem(KEYS.UI_PREFS);
    if (!raw) return DEFAULT_UI_PREFS;
    return { ...DEFAULT_UI_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_UI_PREFS;
  }
}

export function saveUIPreferences(prefs: UIPreferences) {
  try {
    localStorage.setItem(KEYS.UI_PREFS, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function loadCustomPieces(): PieceDefinition[] {
  try {
    const raw = localStorage.getItem(KEYS.CUSTOM_PIECES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPieces(pieces: PieceDefinition[]) {
  try {
    localStorage.setItem(KEYS.CUSTOM_PIECES, JSON.stringify(pieces));
  } catch {
    // ignore quota errors
  }
}

export function loadCustomBoards(): BoardDefinition[] {
  try {
    const raw = localStorage.getItem(KEYS.CUSTOM_BOARDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomBoards(boards: BoardDefinition[]) {
  try {
    localStorage.setItem(KEYS.CUSTOM_BOARDS, JSON.stringify(boards));
  } catch {
    // ignore
  }
}

export function loadAdventureProgress(): AdventureProgress {
  try {
    const raw = localStorage.getItem(KEYS.ADVENTURE);
    if (!raw) return { completedNodeIds: [], xp: 0, gems: 0 };
    const parsed = JSON.parse(raw);
    return {
      completedNodeIds: Array.isArray(parsed.completedNodeIds) ? parsed.completedNodeIds : [],
      xp: typeof parsed.xp === 'number' ? parsed.xp : 0,
      gems: typeof parsed.gems === 'number' ? parsed.gems : 0,
    };
  } catch {
    return { completedNodeIds: [], xp: 0, gems: 0 };
  }
}

export function saveAdventureProgress(progress: AdventureProgress) {
  try {
    localStorage.setItem(KEYS.ADVENTURE, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export function encodeBoardShareCode(
  board: BoardDefinition,
  customPieces: PieceDefinition[]
): string {
  const payload = {
    v: 1,
    board: { ...board, isBuiltin: false },
    customPieces: customPieces.filter((p) => !p.isBuiltin),
  };
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeBoardShareCode(code: string): {
  board: BoardDefinition;
  customPieces: PieceDefinition[];
} | null {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const parsed = JSON.parse(json);
    if (!parsed?.board?.rows || !parsed?.board?.cols || !Array.isArray(parsed?.board?.tiles)) {
      return null;
    }
    return {
      board: parsed.board as BoardDefinition,
      customPieces: Array.isArray(parsed.customPieces) ? parsed.customPieces : [],
    };
  } catch {
    return null;
  }
}
