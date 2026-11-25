import React, { useMemo, useState } from 'react';
import {
  Compass,
  Grid,
  Hammer,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ADVENTURE_NODES, BUILTIN_BOARDS, BUILTIN_PIECES } from './engine/presets';
import {
  AdventureNode,
  AdventureProgress,
  BoardDefinition,
  PieceDefinition,
} from './engine/types';
import { PieceRegistry } from './engine/rules';
import {
  loadAdventureProgress,
  loadCustomBoards,
  loadCustomPieces,
  saveAdventureProgress,
  saveCustomBoards,
  saveCustomPieces,
} from './engine/storage';
import { soundEngine } from './engine/sound';
import { PlayView } from './components/PlayView';
import { AdventureView } from './components/AdventureView';
import { PieceForgeView } from './components/PieceForgeView';
import { BoardForgeView } from './components/BoardForgeView';

type Tab = 'adventure' | 'play' | 'piece-forge' | 'board-forge';

export default function App() {
  const [tab, setTab] = useState<Tab>('adventure');
  const [customPieces, setCustomPieces] = useState<PieceDefinition[]>(() => loadCustomPieces());
  const [customBoards, setCustomBoards] = useState<BoardDefinition[]>(() => loadCustomBoards());
  const [progress, setProgress] = useState<AdventureProgress>(() => loadAdventureProgress());
  const [activeBoardId, setActiveBoardId] = useState<string>('classic-chess');
  const [activeAdventureNode, setActiveAdventureNode] = useState<AdventureNode | null>(null);
  const [boardToEdit, setBoardToEdit] = useState<BoardDefinition | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const allPieces = useMemo(
    () => [...BUILTIN_PIECES, ...customPieces],
    [customPieces]
  );

  const registry: PieceRegistry = useMemo(
    () => Object.fromEntries(allPieces.map((p) => [p.id, p])),
    [allPieces]
  );

  const allBoards = useMemo(
    () => [...BUILTIN_BOARDS, ...customBoards],
    [customBoards]
  );

  const activeBoard = useMemo(
    () => allBoards.find((b) => b.id === activeBoardId) ?? BUILTIN_BOARDS[0],
    [allBoards, activeBoardId]
  );

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

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    soundEngine.enabled = next;
  }

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'adventure', label: 'Adventure', icon: <Compass className="w-4 h-4" /> },
    { id: 'play', label: 'Play Arena', icon: <Swords className="w-4 h-4" /> },
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
              <span className="font-display font-extrabold text-stone-950 text-lg">♞</span>
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
              onClick={toggleSound}
              className="ml-1 p-2 rounded-xl bg-[#221a13] border border-amber-500/20 text-amber-300 hover:border-amber-400 cursor-pointer"
              title={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
              aria-label={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
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

      {/* Footer */}
      <footer className="border-t border-amber-500/15 py-3 text-center text-xs text-stone-500">
        ChessForge — Clean-room chess variant sandbox built with React, TypeScript &amp; Graph-Theory AI.
      </footer>
    </div>
  );
}
