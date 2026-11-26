import React, { useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Crown,
  Grid,
  Hammer,
  Sliders,
  Swords,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ADVENTURE_NODES, BUILTIN_BOARDS, BUILTIN_PIECES } from './engine/presets';
import {
  AdventureNode,
  AdventureProgress,
  BoardDefinition,
  BoardFrameStyle,
  BoardTheme,
  PieceDefinition,
  PiecePalette,
  UIPreferences,
} from './engine/types';
import { PieceRegistry } from './engine/rules';
import {
  loadAdventureProgress,
  loadCustomBoards,
  loadCustomPieces,
  loadUIPreferences,
  saveAdventureProgress,
  saveCustomBoards,
  saveCustomPieces,
  saveUIPreferences,
} from './engine/storage';
import { soundEngine } from './engine/sound';
import { BOARD_THEME_COLORS } from './components/ChessBoardView';
import { PlayView } from './components/PlayView';
import { AdventureView } from './components/AdventureView';
import { PieceForgeView } from './components/PieceForgeView';
import { BoardForgeView } from './components/BoardForgeView';

type Tab = 'adventure' | 'play' | 'piece-forge' | 'board-forge';

export default function App() {
  const [tab, setTab] = useState<Tab>('play');
  const [customPieces, setCustomPieces] = useState<PieceDefinition[]>(() => loadCustomPieces());
  const [customBoards, setCustomBoards] = useState<BoardDefinition[]>(() => loadCustomBoards());
  const [progress, setProgress] = useState<AdventureProgress>(() => loadAdventureProgress());
  const [uiPrefs, setUiPrefs] = useState<UIPreferences>(() => loadUIPreferences());
  const [showSettings, setShowSettings] = useState(false);
  const [activeBoardId, setActiveBoardId] = useState<string>('classic-chess');
  const [activeAdventureNode, setActiveAdventureNode] = useState<AdventureNode | null>(null);
  const [boardToEdit, setBoardToEdit] = useState<BoardDefinition | null>(null);

  useEffect(() => {
    soundEngine.enabled = uiPrefs.soundEnabled;
    saveUIPreferences(uiPrefs);
  }, [uiPrefs]);

  const allPieces = useMemo(() => [...BUILTIN_PIECES, ...customPieces], [customPieces]);

  const registry: PieceRegistry = useMemo(
    () => Object.fromEntries(allPieces.map((p) => [p.id, p])),
    [allPieces]
  );

  const allBoards = useMemo(() => [...BUILTIN_BOARDS, ...customBoards], [customBoards]);

  const activeBoard = useMemo(
    () => allBoards.find((b) => b.id === activeBoardId) ?? BUILTIN_BOARDS[0],
    [allBoards, activeBoardId]
  );

  function updatePrefs(patch: Partial<UIPreferences>) {
    setUiPrefs((prev) => ({ ...prev, ...patch }));
  }

  function handleSavePiece(piece: PieceDefinition) {
    setCustomPieces((prev) => {
      const exists = prev.some((p) => p.id === piece.id);
      const next = exists ? prev.map((p) => (p.id === piece.id ? piece : p)) : [...prev, piece];
      saveCustomPieces(next);
      return next;
    });
  }

  function handleDeletePiece(pieceId: string) {
    setCustomPieces((prev) => {
      const next = prev.filter((p) => p.id !== pieceId);
      saveCustomPieces(next);
      return next;
    });
  }

  function handleSaveBoard(board: BoardDefinition) {
    setCustomBoards((prev) => {
      const exists = prev.some((b) => b.id === board.id);
      const next = exists ? prev.map((b) => (b.id === board.id ? board : b)) : [...prev, board];
      saveCustomBoards(next);
      return next;
    });
  }

  function handleDeleteBoard(boardId: string) {
    setCustomBoards((prev) => {
      const next = prev.filter((b) => b.id !== boardId);
      saveCustomBoards(next);
      return next;
    });
    if (activeBoardId === boardId) {
      setActiveBoardId('classic-chess');
    }
  }

  function handlePlayAdventureNode(node: AdventureNode) {
    setActiveAdventureNode(node);
    setActiveBoardId(node.boardId);
    setTab('play');
  }

  function handleAdventureVictory(node: AdventureNode) {
    setProgress((prev) => {
      if (prev.completedNodeIds.includes(node.id)) return prev;
      const next: AdventureProgress = {
        completedNodeIds: [...prev.completedNodeIds, node.id],
        xp: prev.xp + node.rewardXp,
        gems: prev.gems + node.rewardGems,
      };
      saveAdventureProgress(next);
      return next;
    });
  }

  function handleUnlockAll() {
    const next: AdventureProgress = {
      completedNodeIds: ADVENTURE_NODES.map((n) => n.id),
      xp: Math.max(progress.xp, 3500),
      gems: Math.max(progress.gems, 500),
    };
    setProgress(next);
    saveAdventureProgress(next);
  }

  function handleImportBoard(board: BoardDefinition, importedPieces: PieceDefinition[]) {
    for (const p of importedPieces) {
      handleSavePiece(p);
    }
    const newBoard = { ...board, id: `imported_${Date.now()}`, isBuiltin: false };
    handleSaveBoard(newBoard);
    setActiveAdventureNode(null);
    setActiveBoardId(newBoard.id);
  }

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'play', label: 'Play Arena', icon: <Swords className="w-4 h-4" /> },
    { id: 'adventure', label: 'Adventure', icon: <Compass className="w-4 h-4" /> },
    { id: 'piece-forge', label: 'Piece Forge', icon: <Hammer className="w-4 h-4" /> },
    { id: 'board-forge', label: 'Board Forge', icon: <Grid className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-amber-500/20 bg-[#18130e]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center shadow-lg border border-amber-200/40">
              <Crown className="w-5 h-5 text-stone-950" />
            </div>
            <div>
              <h1 className="font-display text-lg font-extrabold tracking-wide text-amber-100 leading-none">
                CHESSFORGE
              </h1>
              <p className="text-[11px] text-stone-400">
                Custom Chess Variant Sandbox &amp; Graph AI
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1.5 flex-wrap" aria-label="Main Navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'play') setActiveAdventureNode(null);
                  setTab(item.id);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  tab === item.id
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 shadow'
                    : 'text-stone-300 hover:text-amber-200 hover:bg-amber-500/10'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="ml-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#221a13] border border-amber-500/25 text-xs font-semibold text-amber-200 hover:border-amber-400 cursor-pointer"
              title="Customize board theme, piece colors, and display"
            >
              <Sliders className="w-3.5 h-3.5" /> Customize
            </button>

            <button
              type="button"
              onClick={() => updatePrefs({ soundEnabled: !uiPrefs.soundEnabled })}
              className="p-2 rounded-xl bg-[#221a13] border border-amber-500/20 text-amber-300 hover:border-amber-400 cursor-pointer"
              title={uiPrefs.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              aria-label={uiPrefs.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            >
              {uiPrefs.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {tab === 'adventure' && (
          <AdventureView
            boards={allBoards}
            registry={registry}
            progress={progress}
            onPlayNode={handlePlayAdventureNode}
            onUnlockAll={handleUnlockAll}
          />
        )}

        {tab === 'play' && (
          <PlayView
            boards={allBoards}
            activeBoard={activeBoard}
            onSelectBoard={(b) => {
              setActiveAdventureNode(null);
              setActiveBoardId(b.id);
            }}
            registry={registry}
            allPieces={allPieces}
            uiPrefs={uiPrefs}
            onOpenSettings={() => setShowSettings(true)}
            activeAdventureNode={activeAdventureNode}
            onAdventureVictory={handleAdventureVictory}
            onImportBoard={handleImportBoard}
            onEditInBoardForge={(b) => {
              setBoardToEdit(b);
              setTab('board-forge');
            }}
          />
        )}

        {tab === 'piece-forge' && (
          <PieceForgeView
            pieces={allPieces}
            piecePalette={uiPrefs.piecePalette}
            onSavePiece={handleSavePiece}
            onDeletePiece={handleDeletePiece}
          />
        )}

        {tab === 'board-forge' && (
          <BoardForgeView
            boards={allBoards}
            initialBoard={boardToEdit}
            pieces={allPieces}
            registry={registry}
            piecePalette={uiPrefs.piecePalette}
            onSaveBoard={handleSaveBoard}
            onDeleteBoard={handleDeleteBoard}
            onTestPlay={(board) => {
              setActiveAdventureNode(null);
              setActiveBoardId(board.id);
              setTab('play');
            }}
          />
        )}
      </main>

      {/* Global Appearance & Display Customization Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="parchment-panel rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-amber-200">
                Customize Appearance &amp; Display
              </h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-stone-400 hover:text-white p-1 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label htmlFor="pref-theme" className="text-xs font-semibold text-stone-300">
                Board Theme Override
              </label>
              <select
                id="pref-theme"
                value={uiPrefs.boardThemeOverride}
                onChange={(e) =>
                  updatePrefs({ boardThemeOverride: e.target.value as BoardTheme | 'board_default' })
                }
                className="w-full rounded-lg bg-[#16110d] border border-amber-500/30 px-3 py-2 text-sm text-amber-50"
              >
                <option value="board_default">Use Each Board&apos;s Theme</option>
                {(Object.keys(BOARD_THEME_COLORS) as BoardTheme[]).map((t) => (
                  <option key={t} value={t}>
                    {BOARD_THEME_COLORS[t].label}
                  </option>
                ))}
              </select>
              {uiPrefs.boardThemeOverride === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="text-[11px] text-stone-300 flex items-center justify-between bg-[#18120d] px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                    Light Tile
                    <input
                      type="color"
                      value={uiPrefs.customLightSquare}
                      onChange={(e) => updatePrefs({ customLightSquare: e.target.value })}
                      className="w-7 h-6 rounded bg-transparent cursor-pointer"
                    />
                  </label>
                  <label className="text-[11px] text-stone-300 flex items-center justify-between bg-[#18120d] px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                    Dark Tile
                    <input
                      type="color"
                      value={uiPrefs.customDarkSquare}
                      onChange={(e) => updatePrefs({ customDarkSquare: e.target.value })}
                      className="w-7 h-6 rounded bg-transparent cursor-pointer"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="pref-frame" className="text-xs font-semibold text-stone-300">
                  Board Frame
                </label>
                <select
                  id="pref-frame"
                  value={uiPrefs.boardFrame}
                  onChange={(e) => updatePrefs({ boardFrame: e.target.value as BoardFrameStyle })}
                  className="w-full rounded-lg bg-[#16110d] border border-amber-500/30 px-2.5 py-1.5 text-xs text-amber-50"
                >
                  <option value="walnut">Carved Walnut</option>
                  <option value="gold">Gilded Gold</option>
                  <option value="steel">Obsidian Steel</option>
                  <option value="minimal">Minimal Clean</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pref-scale" className="text-xs font-semibold text-stone-300">
                  Piece Size
                </label>
                <select
                  id="pref-scale"
                  value={uiPrefs.pieceScale}
                  onChange={(e) =>
                    updatePrefs({ pieceScale: e.target.value as 'compact' | 'normal' | 'large' })
                  }
                  className="w-full rounded-lg bg-[#16110d] border border-amber-500/30 px-2.5 py-1.5 text-xs text-amber-50"
                >
                  <option value="compact">Compact</option>
                  <option value="normal">Normal</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-300">Piece Color Palette</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['ivory', 'Ivory & Obsidian'],
                    ['royal_gold', 'Royal Gold & Amethyst'],
                    ['jade_ruby', 'Jade & Ruby'],
                    ['blueprint', 'Ice & Midnight'],
                  ] as [PiecePalette, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updatePrefs({ piecePalette: id })}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-left cursor-pointer ${
                      uiPrefs.piecePalette === id
                        ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                        : 'bg-[#18120d] border-amber-500/15 text-stone-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <span className="text-xs font-semibold text-stone-300">Board Aids</span>
              {(
                [
                  ['showLegalMoves', 'Highlight Legal Moves (dots, Castling O-O, En Passant EP)'],
                  ['showLastMove', 'Highlight Last Move Squares'],
                  ['showCoordinates', 'Show Rank & File Coordinates (a1-h8)'],
                  ['soundEnabled', 'Enable Tactile Sound Effects'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-[#19130e] border border-amber-500/15 text-xs text-stone-200 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={uiPrefs[key]}
                    onChange={(e) => updatePrefs({ [key]: e.target.checked })}
                    className="accent-amber-500"
                  />
                  {label}
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs hover:bg-amber-400 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-amber-500/15 py-3 text-center text-xs text-stone-500">
        ChessForge — Clean-room chess variant sandbox built with React, TypeScript &amp; Graph-Theory AI.
      </footer>
    </div>
  );
}
