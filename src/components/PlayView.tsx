import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Brain,
  Copy,
  Crown,
  Download,
  Flag,
  FlipVertical2,
  Handshake,
  RotateCcw,
  Share2,
  Sliders,
  Sparkles,
  Swords,
  Trophy,
  Undo2,
  Users,
} from 'lucide-react';
import {
  AdventureNode,
  AIDifficulty,
  BoardDefinition,
  BoardGraphAnalysis,
  Coord,
  GameState,
  Move,
  PieceDefinition,
  UIPreferences,
} from '../engine/types';
import {
  createInitialGameState,
  generateLegalMoves,
  getBoardRules,
  makeGameMove,
  PieceRegistry,
} from '../engine/rules';
import {
  analyzeBoardGraph,
  chooseAIMove,
  collectBoardPieceIds,
  evaluatePosition,
} from '../engine/graphAi';
import { decodeBoardShareCode, encodeBoardShareCode } from '../engine/storage';
import { soundEngine } from '../engine/sound';
import { ChessBoardView } from './ChessBoardView';
import { PieceIcon } from './PieceIcon';

interface PlayViewProps {
  boards: BoardDefinition[];
  activeBoard: BoardDefinition;
  onSelectBoard: (board: BoardDefinition) => void;
  registry: PieceRegistry;
  allPieces: PieceDefinition[];
  uiPrefs: UIPreferences;
  onOpenSettings: () => void;
  activeAdventureNode?: AdventureNode | null;
  onAdventureVictory?: (node: AdventureNode) => void;
  onImportBoard: (board: BoardDefinition, pieces: PieceDefinition[]) => void;
  onEditInBoardForge: (board: BoardDefinition) => void;
}

type RightTab = 'moves' | 'guide' | 'ai';

export const PlayView: React.FC<PlayViewProps> = ({
  boards,
  activeBoard,
  onSelectBoard,
  registry,
  allPieces,
  uiPrefs,
  onOpenSettings,
  activeAdventureNode,
  onAdventureVictory,
  onImportBoard,
  onEditInBoardForge,
}) => {
  const [historyStates, setHistoryStates] = useState<GameState[]>(() => [
    createInitialGameState(activeBoard, registry),
  ]);
  const [selected, setSelected] = useState<Coord | null>(null);
  const [pendingPromotionMoves, setPendingPromotionMoves] = useState<Move[] | null>(null);
  const [vsAI, setVsAI] = useState(true);
  const [difficulty, setDifficulty] = useState<AIDifficulty>(
    activeAdventureNode?.aiDifficulty ?? 'tactician'
  );
  const [flipped, setFlipped] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiStats, setAiStats] = useState<{ nodes: number; depth: number; evalCp: number } | null>(
    null
  );
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapPieceId, setHeatmapPieceId] = useState<string>('queen');
  const [rightTab, setRightTab] = useState<RightTab>('moves');
  const [victoryClaimed, setVictoryClaimed] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const gameState = historyStates[historyStates.length - 1];
  const boardRules = useMemo(() => getBoardRules(gameState.boardDef), [gameState.boardDef]);

  const effectiveTheme =
    uiPrefs.boardThemeOverride === 'board_default'
      ? gameState.boardDef.theme ?? 'classic'
      : uiPrefs.boardThemeOverride;

  // Reset when activeBoard changes
  useEffect(() => {
    setHistoryStates([createInitialGameState(activeBoard, registry)]);
    setSelected(null);
    setPendingPromotionMoves(null);
    setAiThinking(false);
    setAiStats(null);
    setVictoryClaimed(false);
    if (activeAdventureNode) {
      setVsAI(true);
      setDifficulty(activeAdventureNode.aiDifficulty);
    }
  }, [activeBoard, registry, activeAdventureNode]);

  const boardPieceIds = useMemo(
    () => collectBoardPieceIds(gameState.boardDef, gameState.grid, registry),
    [gameState.boardDef, gameState.grid, registry]
  );

  const graphAnalysis: BoardGraphAnalysis = useMemo(
    () => analyzeBoardGraph(gameState.tiles, boardPieceIds, registry),
    [gameState.tiles, boardPieceIds, registry]
  );

  useEffect(() => {
    if (!graphAnalysis.metricsByPiece[heatmapPieceId] && boardPieceIds.length > 0) {
      const nonKing = boardPieceIds.find((id) => !registry[id]?.rules.royal) ?? boardPieceIds[0];
      setHeatmapPieceId(nonKing);
    }
  }, [graphAnalysis, heatmapPieceId, boardPieceIds, registry]);

  const allLegalMoves = useMemo(
    () =>
      gameState.status === 'playing' || gameState.status === 'check'
        ? generateLegalMoves(
            gameState.tiles,
            gameState.grid,
            gameState.turn,
            registry,
            boardRules,
            gameState.enPassantTarget
          )
        : [],
    [gameState, registry, boardRules]
  );

  const selectedLegalMoves = useMemo(() => {
    if (!selected) return [];
    return allLegalMoves.filter((m) => m.from.r === selected.r && m.from.c === selected.c);
  }, [selected, allLegalMoves]);

  const liveEvalCp = useMemo(() => {
    if (aiStats) return aiStats.evalCp;
    return evaluatePosition(gameState.tiles, gameState.grid, graphAnalysis, registry);
  }, [aiStats, gameState.tiles, gameState.grid, graphAnalysis, registry]);

  // Notify Adventure Mode on White victory
  useEffect(() => {
    if (
      activeAdventureNode &&
      !victoryClaimed &&
      gameState.winner === 'white' &&
      (gameState.status === 'checkmate' || gameState.status === 'victory_white')
    ) {
      setVictoryClaimed(true);
      soundEngine.playVictory();
      onAdventureVictory?.(activeAdventureNode);
    }
  }, [activeAdventureNode, victoryClaimed, gameState.winner, gameState.status, onAdventureVictory]);

  // AI Turn trigger (AI plays Black)
  useEffect(() => {
    if (!vsAI) return;
    if (pendingPromotionMoves) return;
    if (gameState.turn !== 'black') return;
    if (gameState.status !== 'playing' && gameState.status !== 'check') return;

    setAiThinking(true);
    const timer = window.setTimeout(() => {
      const res = chooseAIMove(gameState, registry, difficulty, graphAnalysis);
      if (res.bestMove) {
        const next = makeGameMove(gameState, res.bestMove, registry);
        playMoveSound(res.bestMove, next);
        setHistoryStates((prev) => [...prev, next]);
        setAiStats({
          nodes: res.nodesSearched,
          depth: res.depthReached,
          evalCp: res.score,
        });
      }
      setAiThinking(false);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [vsAI, pendingPromotionMoves, gameState, difficulty, registry, graphAnalysis]);

  function playMoveSound(move: Move, nextState: GameState) {
    if (
      nextState.status === 'checkmate' ||
      nextState.status === 'victory_white' ||
      nextState.status === 'victory_black'
    ) {
      soundEngine.playVictory();
    } else if (nextState.status === 'check') {
      soundEngine.playCheck();
    } else if (move.portalExit) {
      soundEngine.playPortal();
    } else if (move.isRangedCapture) {
      soundEngine.playRanged();
    } else if (move.captured) {
      soundEngine.playCapture();
    } else {
      soundEngine.playMove();
    }
  }

  function executeMove(move: Move) {
    const next = makeGameMove(gameState, move, registry);
    playMoveSound(move, next);
    setHistoryStates((prev) => [...prev, next]);
    setSelected(null);
    setPendingPromotionMoves(null);
  }

  function handleSquareClick(r: number, c: number) {
    if (aiThinking || pendingPromotionMoves) return;
    if (gameState.status !== 'playing' && gameState.status !== 'check') return;
    if (vsAI && gameState.turn === 'black') return;

    if (selected) {
      const matchingMoves = selectedLegalMoves.filter((m) => m.to.r === r && m.to.c === c);
      if (matchingMoves.length > 1) {
        // Multiple promotion options -> open Promotion Picker modal!
        setPendingPromotionMoves(matchingMoves);
        return;
      }
      if (matchingMoves.length === 1) {
        executeMove(matchingMoves[0]);
        return;
      }
    }

    const piece = gameState.grid[r]?.[c];
    if (piece && piece.color === gameState.turn) {
      setSelected({ r, c });
      if (showHeatmap && graphAnalysis.metricsByPiece[piece.pieceId]) {
        setHeatmapPieceId(piece.pieceId);
      }
    } else {
      setSelected(null);
    }
  }

  function handleUndo() {
    if (aiThinking) return;
    if (historyStates.length <= 1) return;
    const stepsBack = vsAI && gameState.turn === 'white' && historyStates.length >= 3 ? 2 : 1;
    setHistoryStates((prev) => prev.slice(0, Math.max(1, prev.length - stepsBack)));
    setSelected(null);
    setPendingPromotionMoves(null);
  }

  function handleReset() {
    setHistoryStates([createInitialGameState(activeBoard, registry)]);
    setSelected(null);
    setPendingPromotionMoves(null);
    setAiThinking(false);
    setAiStats(null);
  }

  function handleResign() {
    if (gameState.status !== 'playing' && gameState.status !== 'check') return;
    const winner = gameState.turn === 'white' ? 'black' : 'white';
    setHistoryStates((prev) => [
      ...prev,
      {
        ...gameState,
        status: winner === 'white' ? 'victory_white' : 'victory_black',
        winner,
        statusReason: `${gameState.turn === 'white' ? 'White' : 'Black'} resigned.`,
      },
    ]);
  }

  function handleDeclareDraw() {
    if (gameState.status !== 'playing' && gameState.status !== 'check') return;
    setHistoryStates((prev) => [
      ...prev,
      {
        ...gameState,
        status: 'draw',
        winner: undefined,
        statusReason: 'Draw agreed by players.',
      },
    ]);
  }

  const lastMove =
    gameState.moveHistory.length > 0
      ? gameState.moveHistory[gameState.moveHistory.length - 1]
      : null;

  const activeHeatmap = useMemo(() => {
    if (!showHeatmap) return null;
    const metrics = graphAnalysis.metricsByPiece[heatmapPieceId];
    if (!metrics) return null;
    return gameState.turn === 'black' ? metrics.pstBlack : metrics.pstWhite;
  }, [showHeatmap, graphAnalysis, heatmapPieceId, gameState.turn]);

  const whiteBarPct = Math.max(5, Math.min(95, 50 + Math.tanh(liveEvalCp / 600) * 45));
  const isGameOver =
    gameState.status !== 'playing' && gameState.status !== 'check';

  const shareCode = useMemo(
    () => (showShareModal ? encodeBoardShareCode(activeBoard, allPieces) : ''),
    [showShareModal, activeBoard, allPieces]
  );

  const selectedPieceDef = selected
    ? registry[gameState.grid[selected.r]?.[selected.c]?.pieceId ?? '']
    : null;

  const renderCapturedRow = (pieces: import('../engine/types').PlacedPiece[], label: string) => (
    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#19130e]/85 border border-amber-500/15 min-h-[34px]">
      <span className="text-[11px] font-medium text-stone-400">{label}</span>
      <div className="flex items-center gap-0.5 flex-wrap justify-end">
        {pieces.length === 0 ? (
          <span className="text-[11px] text-stone-600 italic">None</span>
        ) : (
          pieces.map((p, i) => {
            const def = registry[p.pieceId];
            if (!def) return null;
            return (
              <span key={`${p.id}_${i}`} className="w-5 h-5 inline-block" title={def.name}>
                <PieceIcon icon={def.icon} color={p.color} rules={def.rules} palette={uiPrefs.piecePalette} />
              </span>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Column: Match Setup & Controls */}
      <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
        {activeAdventureNode && (
          <div className="parchment-panel rounded-xl p-4 border-amber-500/40 bg-amber-950/20">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Trophy className="w-4 h-4" /> Adventure Stage {activeAdventureNode.order}
            </div>
            <h3 className="text-lg font-bold text-amber-100 mt-1">{activeAdventureNode.title}</h3>
            <p className="text-xs text-stone-300 mt-0.5">
              {activeAdventureNode.island} · {activeAdventureNode.subtitle}
            </p>
            <div className="flex gap-3 mt-2.5 text-xs font-mono text-amber-300">
              <span>+{activeAdventureNode.rewardXp} XP</span>
              <span>+{activeAdventureNode.rewardGems} Gems</span>
            </div>
          </div>
        )}

        <div className="parchment-panel rounded-xl p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
              Match Setup
            </h3>
            <button
              type="button"
              onClick={() => onEditInBoardForge(activeBoard)}
              className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
            >
              Customize Board
            </button>
          </div>

          <div className="space-y-1">
            <label htmlFor="board-select" className="text-[11px] uppercase tracking-wider text-stone-400">
              Choose Variant
            </label>
            <select
              id="board-select"
              value={activeBoard.id}
              onChange={(e) => {
                const found = boards.find((b) => b.id === e.target.value);
                if (found) onSelectBoard(found);
              }}
              className="w-full rounded-lg bg-[#18130e] border border-amber-500/30 px-3 py-2 text-sm text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.rows}×{b.cols}){b.isBuiltin ? '' : ' ★'}
                </option>
              ))}
            </select>
            <p className="text-xs text-stone-300 leading-relaxed pt-1">{activeBoard.description}</p>
          </div>

          {/* Opponent Mode */}
          <div className="pt-2 border-t border-amber-500/15 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVsAI(true)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  vsAI
                    ? 'bg-amber-600 text-stone-950 shadow'
                    : 'bg-[#1b1510] text-stone-300 border border-amber-500/20 hover:border-amber-500/40'
                }`}
              >
                <Brain className="w-3.5 h-3.5" /> vs Graph AI
              </button>
              <button
                type="button"
                onClick={() => setVsAI(false)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  !vsAI
                    ? 'bg-amber-600 text-stone-950 shadow'
                    : 'bg-[#1b1510] text-stone-300 border border-amber-500/20 hover:border-amber-500/40'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> 2P Local
              </button>
            </div>

            {vsAI && (
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-stone-400">
                  AI Strength
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['novice', 'tactician', 'grandmaster'] as AIDifficulty[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDifficulty(lvl)}
                      className={`py-1.5 rounded-md text-xs font-medium capitalize transition cursor-pointer ${
                        difficulty === lvl
                          ? 'bg-amber-500/25 text-amber-200 border border-amber-400/60'
                          : 'bg-[#17120e] text-stone-400 border border-stone-700/60 hover:text-stone-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-500/15">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyStates.length <= 1 || aiThinking}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-[#1d1712] border border-amber-500/20 hover:border-amber-400/50 disabled:opacity-40 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-[#1d1712] border border-amber-500/20 hover:border-amber-400/50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restart
            </button>
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-[#1d1712] border border-amber-500/20 hover:border-amber-400/50 cursor-pointer"
            >
              <FlipVertical2 className="w-3.5 h-3.5" /> Flip Board
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-[#1d1712] border border-amber-500/20 hover:border-amber-400/50 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" /> Appearance
            </button>
            <button
              type="button"
              onClick={handleDeclareDraw}
              disabled={isGameOver}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-[#1d1712] border border-amber-500/20 hover:border-amber-400/50 disabled:opacity-40 cursor-pointer"
            >
              <Handshake className="w-3.5 h-3.5" /> Draw
            </button>
            <button
              type="button"
              onClick={handleResign}
              disabled={isGameOver}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-[#1d1712] border border-rose-500/25 text-rose-200 hover:border-rose-400/60 disabled:opacity-40 cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" /> Resign
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowShareModal(true);
              setShareStatus(null);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-[#19130e] border border-amber-500/20 text-amber-200 hover:border-amber-400/50 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" /> Share / Import Board Code
          </button>
        </div>
      </div>

      {/* Center Column: Status Banner, Captured Pieces, Interactive Board */}
      <div className="lg:col-span-6 space-y-2.5 order-1 lg:order-2">
        {/* Turn & Evaluation Bar */}
        <div className="parchment-panel rounded-xl px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3.5 h-3.5 rounded-full border-2 ${
                  gameState.turn === 'white'
                    ? 'bg-[#f8f1df] border-amber-400'
                    : 'bg-[#262120] border-amber-300'
                }`}
              />
              <span className="font-display font-bold text-sm sm:text-base text-amber-100">
                {isGameOver
                  ? gameState.status === 'stalemate'
                    ? 'Stalemate — Draw'
                    : gameState.status === 'draw'
                      ? 'Draw'
                      : gameState.winner === 'white'
                        ? 'White Wins!'
                        : 'Black Wins!'
                  : aiThinking
                    ? 'Graph AI is thinking…'
                    : `${gameState.turn === 'white' ? 'White' : 'Black'} to move`}
              </span>
              {gameState.status === 'check' && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600/90 text-white text-xs font-bold animate-pulse">
                  CHECK
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-stone-400">
              Eval:{' '}
              <span className={liveEvalCp >= 0 ? 'text-amber-300' : 'text-sky-300'}>
                {liveEvalCp >= 0 ? '+' : ''}
                {(liveEvalCp / 100).toFixed(1)}
              </span>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-stone-900 overflow-hidden flex border border-amber-500/20">
            <div
              className="h-full bg-gradient-to-r from-amber-200 to-amber-400 transition-all duration-300"
              style={{ width: `${whiteBarPct}%` }}
            />
          </div>

          {isGameOver && gameState.statusReason && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/20">
              <p className="text-xs text-amber-200 font-medium">{gameState.statusReason}</p>
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1 rounded-lg bg-amber-500 text-stone-950 text-xs font-bold hover:bg-amber-400 cursor-pointer"
              >
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* Captured by Black (top) */}
        {renderCapturedRow(
          flipped ? gameState.capturedByWhite : gameState.capturedByBlack,
          flipped ? 'Captured by White' : 'Captured by Black'
        )}

        {/* Interactive Board */}
        <div className="relative">
          <ChessBoardView
            rows={gameState.boardDef.rows}
            cols={gameState.boardDef.cols}
            tiles={gameState.tiles}
            grid={gameState.grid}
            registry={registry}
            theme={effectiveTheme}
            customLightSquare={uiPrefs.customLightSquare}
            customDarkSquare={uiPrefs.customDarkSquare}
            boardFrame={uiPrefs.boardFrame}
            piecePalette={uiPrefs.piecePalette}
            pieceScale={uiPrefs.pieceScale}
            selected={selected}
            legalMoves={selectedLegalMoves}
            lastMove={lastMove}
            flipped={flipped}
            showCoordinates={uiPrefs.showCoordinates}
            showLegalMoves={uiPrefs.showLegalMoves}
            showLastMove={uiPrefs.showLastMove}
            heatmap={activeHeatmap}
            onSquareClick={handleSquareClick}
          />

          {/* Promotion Choice Modal */}
          {pendingPromotionMoves && (
            <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm rounded-xl flex items-center justify-center p-4">
              <div className="parchment-panel rounded-2xl p-5 max-w-sm w-full space-y-4 border-amber-400/60 shadow-2xl">
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <Crown className="w-4 h-4" /> Promotion!
                  </div>
                  <h4 className="font-display text-lg font-bold text-amber-100">
                    Choose Your Promotion Piece
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {pendingPromotionMoves.map((m) => {
                    const pid = m.promotedTo ?? 'queen';
                    const def = registry[pid];
                    if (!def) return null;
                    const pts = ((graphAnalysis.metricsByPiece[pid]?.materialValue ?? 300) / 100).toFixed(1);
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => executeMove(m)}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#1c1510] border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/20 transition cursor-pointer text-left"
                      >
                        <span className="w-9 h-9 shrink-0">
                          <PieceIcon
                            icon={def.icon}
                            color={gameState.turn}
                            rules={def.rules}
                            palette={uiPrefs.piecePalette}
                          />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-amber-100 truncate">{def.name}</div>
                          <div className="text-[10px] font-mono text-amber-400">{pts} pts</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setPendingPromotionMoves(null)}
                  className="w-full py-2 rounded-lg bg-[#1a140f] border border-stone-700 text-xs text-stone-300 hover:text-white cursor-pointer"
                >
                  Cancel Move
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Captured by White (bottom) */}
        {renderCapturedRow(
          flipped ? gameState.capturedByBlack : gameState.capturedByWhite,
          flipped ? 'Captured by Black' : 'Captured by White'
        )}
      </div>

      {/* Right Column: Clean 3-Tab Inspector (Moves | Guide | AI Brain) */}
      <div className="lg:col-span-3 parchment-panel rounded-2xl overflow-hidden order-3">
        <div className="grid grid-cols-3 border-b border-amber-500/20 bg-[#17120d]">
          {(
            [
              ['moves', 'Moves', <Swords key="m" className="w-3.5 h-3.5" />],
              ['guide', 'Guide', <BookOpen key="g" className="w-3.5 h-3.5" />],
              ['ai', 'AI Brain', <Sparkles key="a" className="w-3.5 h-3.5" />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRightTab(id)}
              className={`py-2.5 px-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                rightTab === id
                  ? 'bg-amber-500/20 text-amber-200 border-b-2 border-amber-400'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {rightTab === 'moves' && (
            <>
              {/* Active Rules Summary */}
              <div className="rounded-xl bg-[#18120d] border border-amber-500/15 p-3 space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  Active Board Rules
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {boardRules.castlingEnabled && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-200">Castling</span>
                  )}
                  {boardRules.enPassantEnabled && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-200">En Passant</span>
                  )}
                  {boardRules.drawByRepetition && (
                    <span className="px-2 py-0.5 rounded bg-stone-700/60 text-stone-200">3-Fold Draw</span>
                  )}
                  {boardRules.drawByFiftyMove && (
                    <span className="px-2 py-0.5 rounded bg-stone-700/60 text-stone-200">50-Move Draw</span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-200 capitalize">
                    Win: {boardRules.winCondition.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  Move Chronicle ({gameState.moveHistory.length} plies)
                </div>
                {gameState.moveHistory.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">
                    Click any White piece to see its legal moves, including Castling (⇄) and En Passant (EP).
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1 max-h-80 overflow-y-auto font-mono text-xs pr-1">
                    {gameState.moveHistory.map((m, idx) => (
                      <div
                        key={idx}
                        className={`px-2 py-1 rounded ${
                          idx % 2 === 0 ? 'bg-[#1f1812] text-amber-100' : 'bg-[#16110d] text-stone-300'
                        }`}
                      >
                        <span className="text-stone-500 mr-1.5">
                          {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : ''}
                        </span>
                        {m.notation}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {rightTab === 'guide' && (
            <div className="space-y-4">
              {selectedPieceDef ? (
                <div className="rounded-xl bg-[#19130e] border border-amber-400/40 p-3.5 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#120e0a] p-1 border border-amber-500/30">
                      <PieceIcon
                        icon={selectedPieceDef.icon}
                        color={gameState.grid[selected!.r]?.[selected!.c]?.color ?? 'white'}
                        rules={selectedPieceDef.rules}
                        palette={uiPrefs.piecePalette}
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-100 text-sm">{selectedPieceDef.name}</h4>
                      <p className="text-[11px] font-mono text-amber-400">
                        Value:{' '}
                        {selectedPieceDef.rules.royal
                          ? 'ROYAL'
                          : `${((graphAnalysis.metricsByPiece[selectedPieceDef.id]?.materialValue ?? 100) / 100).toFixed(1)} pts`}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed">{selectedPieceDef.description}</p>
                </div>
              ) : (
                <p className="text-xs text-stone-400 italic">
                  Select any piece on the board to inspect its movement rules and abilities here.
                </p>
              )}

              <div className="space-y-2 text-xs text-stone-300">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  Move &amp; Tile Symbols
                </div>
                <ul className="space-y-1.5 text-[11px] leading-relaxed">
                  <li><strong className="text-amber-200">⇄ Castling / Swap:</strong> Castle an unmoved King &amp; Rook, or swap with an ally (cyan).</li>
                  <li><strong className="text-rose-300">EP En Passant:</strong> Capture a pawn that just double-stepped beside yours.</li>
                  <li><strong className="text-amber-300">★ Promotion:</strong> Reach this tile to choose a new piece to promote into.</li>
                  <li><strong className="text-amber-200">🛡 Sanctuary:</strong> Pieces standing here cannot be captured.</li>
                  <li><strong className="text-sky-300">◎ Portal A/B/C:</strong> Warps arriving pieces to the matching portal tile.</li>
                  <li><strong className="text-cyan-300">❄ Ice Slide:</strong> Pieces landing here glide 1 extra square forward.</li>
                  <li><strong className="text-rose-400">⚠ Spike Trap:</strong> One-time hazard that destroys a non-Royal/non-Iron intruder.</li>
                  <li><strong className="text-emerald-300">⚡ Power Boost:</strong> Grants +1 orthogonal step while standing on this rune.</li>
                  <li><strong className="text-yellow-300">♛ Crown Summit:</strong> Reaching this tile with a Royal wins immediately!</li>
                  <li><strong className="text-stone-300">🧱 Stone Wall:</strong> Blocks sliding pieces; leapers can jump over it.</li>
                  <li><strong className="text-orange-300"># Fallow Tile:</strong> Crumbles into Void after its counter hits 0.</li>
                </ul>
              </div>
            </div>
          )}

          {rightTab === 'ai' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-200">Graph Heatmap Overlay</span>
                <button
                  type="button"
                  onClick={() => setShowHeatmap((s) => !s)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    showHeatmap
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-[#1a140f] text-amber-300 border border-amber-500/30 hover:border-amber-400'
                  }`}
                >
                  {showHeatmap ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                Analyzed <span className="font-mono text-amber-300">{graphAnalysis.activeTileCount}</span> tiles in{' '}
                <span className="font-mono text-amber-300">{graphAnalysis.computeTimeMs}ms</span>. Click any piece to view its dynamic Piece-Square Table on the board.
              </p>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {boardPieceIds.map((pid) => {
                  const def = registry[pid];
                  const m = graphAnalysis.metricsByPiece[pid];
                  if (!def || !m) return null;
                  const isActive = showHeatmap && heatmapPieceId === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => {
                        setHeatmapPieceId(pid);
                        setShowHeatmap(true);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        isActive
                          ? 'bg-amber-500/25 border border-amber-400/60 text-amber-100'
                          : 'bg-[#19130e] border border-amber-500/10 hover:border-amber-500/35 text-stone-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 inline-block">
                          <PieceIcon icon={def.icon} color="white" rules={def.rules} palette={uiPrefs.piecePalette} />
                        </span>
                        <span className="font-medium">{def.name}</span>
                      </span>
                      <span className="font-mono text-amber-300">
                        {def.rules.royal ? 'ROYAL' : `${(m.materialValue / 100).toFixed(1)}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {aiStats && (
                <div className="text-[11px] font-mono text-stone-400 pt-2 border-t border-amber-500/15 flex justify-between">
                  <span>Depth {aiStats.depth}</span>
                  <span>{aiStats.nodes.toLocaleString()} nodes</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Share / Import Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="parchment-panel rounded-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-amber-200">
                Share or Import Variant Board
              </h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-stone-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="export-code" className="text-xs text-stone-300 font-semibold">
                Export Code for &ldquo;{activeBoard.name}&rdquo;
              </label>
              <textarea
                id="export-code"
                readOnly
                value={shareCode}
                rows={3}
                className="w-full rounded-lg bg-[#14100c] border border-amber-500/25 p-2.5 text-xs font-mono text-amber-200"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(shareCode);
                  setShareStatus('Copied share code to clipboard!');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-stone-950 text-xs font-semibold hover:bg-amber-500 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Code
              </button>
            </div>

            <div className="space-y-1.5 pt-3 border-t border-amber-500/20">
              <label htmlFor="import-code" className="text-xs text-stone-300 font-semibold">
                Import a Variant Share Code
              </label>
              <textarea
                id="import-code"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste a ChessForge board share code here..."
                rows={3}
                className="w-full rounded-lg bg-[#14100c] border border-amber-500/25 p-2.5 text-xs font-mono text-stone-100"
              />
              <button
                type="button"
                onClick={() => {
                  const decoded = decodeBoardShareCode(importText);
                  if (!decoded) {
                    setShareStatus('Invalid share code. Please check the pasted text.');
                    return;
                  }
                  onImportBoard(decoded.board, decoded.customPieces);
                  setImportText('');
                  setShowShareModal(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Import &amp; Play
              </button>
            </div>

            {shareStatus && <p className="text-xs text-amber-300">{shareStatus}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
