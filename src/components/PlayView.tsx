import React, { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  Copy,
  Download,
  FlipVertical2,
  RotateCcw,
  Share2,
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
} from '../engine/types';
import {
  createInitialGameState,
  generateLegalMoves,
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
  activeAdventureNode?: AdventureNode | null;
  onAdventureVictory?: (node: AdventureNode) => void;
  onImportBoard: (board: BoardDefinition, pieces: PieceDefinition[]) => void;
  onEditInBoardForge: (board: BoardDefinition) => void;
}

export const PlayView: React.FC<PlayViewProps> = ({
  boards,
  activeBoard,
  onSelectBoard,
  registry,
  allPieces,
  activeAdventureNode,
  onAdventureVictory,
  onImportBoard,
  onEditInBoardForge,
}) => {
  const [historyStates, setHistoryStates] = useState<GameState[]>(() => [
    createInitialGameState(activeBoard, registry),
  ]);
  const [selected, setSelected] = useState<Coord | null>(null);
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
  const [victoryClaimed, setVictoryClaimed] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const gameState = historyStates[historyStates.length - 1];

  // Reset when activeBoard changes
  useEffect(() => {
    setHistoryStates([createInitialGameState(activeBoard, registry)]);
    setSelected(null);
    setAiThinking(false);
    setAiStats(null);
    setVictoryClaimed(false);
    if (activeAdventureNode) {
      setVsAI(true);
      setDifficulty(activeAdventureNode.aiDifficulty);
    }
  }, [activeBoard, registry, activeAdventureNode]);

  // Compute Graph-Theory Analysis for the current board
  const boardPieceIds = useMemo(
    () => collectBoardPieceIds(gameState.boardDef, gameState.grid, registry),
    [gameState.boardDef, gameState.grid, registry]
  );

  const graphAnalysis: BoardGraphAnalysis = useMemo(
    () => analyzeBoardGraph(gameState.tiles, boardPieceIds, registry),
    [gameState.tiles, boardPieceIds, registry]
  );

  // Keep heatmapPieceId valid for the current board
  useEffect(() => {
    if (!graphAnalysis.metricsByPiece[heatmapPieceId] && boardPieceIds.length > 0) {
      const nonKing = boardPieceIds.find((id) => !registry[id]?.rules.royal) ?? boardPieceIds[0];
      setHeatmapPieceId(nonKing);
    }
  }, [graphAnalysis, heatmapPieceId, boardPieceIds, registry]);

  // Legal moves for current turn
  const allLegalMoves = useMemo(
    () =>
      gameState.status === 'playing' || gameState.status === 'check'
        ? generateLegalMoves(gameState.tiles, gameState.grid, gameState.turn, registry)
        : [],
    [gameState, registry]
  );

  const selectedLegalMoves = useMemo(() => {
    if (!selected) return [];
    return allLegalMoves.filter((m) => m.from.r === selected.r && m.from.c === selected.c);
  }, [selected, allLegalMoves]);

  // Live position evaluation
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
  }, [vsAI, gameState, difficulty, registry, graphAnalysis]);

  function playMoveSound(move: Move, nextState: GameState) {
    if (nextState.status === 'checkmate' || nextState.status === 'victory_white' || nextState.status === 'victory_black') {
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

  function handleSquareClick(r: number, c: number) {
    if (aiThinking) return;
    if (gameState.status !== 'playing' && gameState.status !== 'check') return;
    if (vsAI && gameState.turn === 'black') return;

    // Check if clicking a legal move destination
    if (selected) {
      const move = selectedLegalMoves.find((m) => m.to.r === r && m.to.c === c);
      if (move) {
        const next = makeGameMove(gameState, move, registry);
        playMoveSound(move, next);
        setHistoryStates((prev) => [...prev, next]);
        setSelected(null);
        return;
      }
    }

    // Select own piece
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
  }

  function handleReset() {
    setHistoryStates([createInitialGameState(activeBoard, registry)]);
    setSelected(null);
    setAiThinking(false);
    setAiStats(null);
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

  // Eval bar percentage for White (clamped 5%..95%)
  const whiteBarPct = Math.max(5, Math.min(95, 50 + Math.tanh(liveEvalCp / 600) * 45));

  const shareCode = useMemo(
    () => (showShareModal ? encodeBoardShareCode(activeBoard, allPieces) : ''),
    [showShareModal, activeBoard, allPieces]
  );

  const selectedPieceDef = selected
    ? registry[gameState.grid[selected.r]?.[selected.c]?.pieceId ?? '']
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Column: Board selector & Controls */}
      <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
        {activeAdventureNode && (
          <div className="parchment-panel rounded-xl p-4 border-amber-500/40 bg-amber-950/20">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Trophy className="w-4 h-4" /> Adventure Stage {activeAdventureNode.order}
            </div>
            <h3 className="text-lg font-bold text-amber-100 mt-1">{activeAdventureNode.title}</h3>
            <p className="text-xs text-stone-300 mt-0.5">{activeAdventureNode.island} · {activeAdventureNode.subtitle}</p>
            <div className="flex gap-3 mt-2.5 text-xs font-mono text-amber-300">
              <span>+{activeAdventureNode.rewardXp} XP</span>
              <span>+{activeAdventureNode.rewardGems} Gems</span>
            </div>
          </div>
        )}

        <div className="parchment-panel rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">Variant Board</h3>
            <button
              type="button"
              onClick={() => onEditInBoardForge(activeBoard)}
              className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
            >
              Edit in Forge
            </button>
          </div>
          <select
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
          <p className="text-xs text-stone-300 leading-relaxed">{activeBoard.description}</p>

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
                <label className="text-[11px] uppercase tracking-wider text-stone-400">
                  AI Difficulty
                </label>
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

          <div className="grid grid-cols-2 gap-2 pt-2">
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
              <FlipVertical2 className="w-3.5 h-3.5" /> Flip
            </button>
            <button
              type="button"
              onClick={() => {
                setShowShareModal(true);
                setShareStatus(null);
              }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-[#1d1712] border border-amber-500/20 hover:border-amber-400/50 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>
        </div>

        {/* Selected Piece Inspector */}
        {selectedPieceDef && (
          <div className="parchment-panel rounded-xl p-4 space-y-2 border-amber-400/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1a140f] p-1 border border-amber-500/30">
                <PieceIcon
                  icon={selectedPieceDef.icon}
                  color={gameState.grid[selected!.r]?.[selected!.c]?.color ?? 'white'}
                  rules={selectedPieceDef.rules}
                />
              </div>
              <div>
                <h4 className="font-bold text-amber-100 text-sm">{selectedPieceDef.name}</h4>
                <p className="text-[11px] font-mono text-amber-400">
                  Graph Value:{' '}
                  {selectedPieceDef.rules.royal
                    ? 'ROYAL'
                    : `${((graphAnalysis.metricsByPiece[selectedPieceDef.id]?.materialValue ?? 100) / 100).toFixed(1)} pts`}
                </p>
              </div>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">{selectedPieceDef.description}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedPieceDef.rules.royal && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                  Royal
                </span>
              )}
              {selectedPieceDef.rules.iron && (
                <span className="px-2 py-0.5 rounded bg-slate-500/30 text-slate-200 text-[10px] font-semibold">
                  Iron (Uncapturable)
                </span>
              )}
              {selectedPieceDef.rules.blacksmith && (
                <span className="px-2 py-0.5 rounded bg-orange-500/25 text-orange-200 text-[10px] font-semibold">
                  Blacksmith
                </span>
              )}
              {selectedPieceDef.rules.rangedAttack && (
                <span className="px-2 py-0.5 rounded bg-rose-500/25 text-rose-200 text-[10px] font-semibold">
                  Ranged Attack
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Center Column: Status Bar + Live ChessBoard */}
      <div className="lg:col-span-6 space-y-3 order-1 lg:order-2">
        {/* Turn & Evaluation Bar */}
        <div className="parchment-panel rounded-xl px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3 h-3 rounded-full border ${
                  gameState.turn === 'white'
                    ? 'bg-[#f8f1df] border-amber-400'
                    : 'bg-[#262120] border-amber-300'
                }`}
              />
              <span className="font-display font-bold text-sm sm:text-base text-amber-100">
                {gameState.status === 'checkmate' ||
                gameState.status === 'victory_white' ||
                gameState.status === 'victory_black'
                  ? gameState.statusReason
                  : gameState.status === 'stalemate'
                    ? 'Stalemate — Draw'
                    : aiThinking
                      ? 'Graph AI is thinking…'
                      : `${gameState.turn === 'white' ? 'White' : 'Black'} to move`}
              </span>
              {gameState.status === 'check' && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600/80 text-white text-xs font-bold animate-pulse">
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
        </div>

        {/* Interactive Board */}
        <ChessBoardView
          rows={gameState.boardDef.rows}
          cols={gameState.boardDef.cols}
          tiles={gameState.tiles}
          grid={gameState.grid}
          registry={registry}
          theme={gameState.boardDef.theme}
          selected={selected}
          legalMoves={selectedLegalMoves}
          lastMove={lastMove}
          flipped={flipped}
          heatmap={activeHeatmap}
          onSquareClick={handleSquareClick}
        />

        {/* Tile Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-stone-400">
          <span>🛡 Sanctuary (Safe)</span>
          <span>◎ Portal A/B/C (Warp)</span>
          <span>★ Promotion Zone</span>
          <span># Fallow (Crumbles)</span>
          <span>⭕ Red/Amber Ring (Capture / Ranged)</span>
        </div>
      </div>

      {/* Right Column: Graph-Theory AI Brain & Move History */}
      <div className="lg:col-span-3 space-y-4 order-3">
        {/* Graph AI Brain Panel */}
        <div className="parchment-panel rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
                Graph AI Brain
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowHeatmap((s) => !s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                showHeatmap
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-[#1a140f] text-amber-300 border border-amber-500/30 hover:border-amber-400'
              }`}
            >
              {showHeatmap ? 'Heatmap ON' : 'Heatmap OFF'}
            </button>
          </div>

          <p className="text-[11px] text-stone-400 leading-snug">
            Computed on {graphAnalysis.activeTileCount} active nodes in{' '}
            <span className="font-mono text-amber-300">{graphAnalysis.computeTimeMs}ms</span>.
            Click a piece below to visualize its dynamic Piece-Square Table heatmap.
          </p>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
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
                      <PieceIcon icon={def.icon} color="white" rules={def.rules} />
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

        {/* Move History */}
        <div className="parchment-panel rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Swords className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
              Move Chronicle
            </h3>
          </div>
          {gameState.moveHistory.length === 0 ? (
            <p className="text-xs text-stone-400 italic">No moves played yet. Select a White piece to begin.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1 max-h-52 overflow-y-auto font-mono text-xs pr-1">
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
              <label className="text-xs text-stone-300 font-semibold">
                Export Code for &ldquo;{activeBoard.name}&rdquo;
              </label>
              <textarea
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
              <label className="text-xs text-stone-300 font-semibold">
                Import a Variant Share Code
              </label>
              <textarea
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
