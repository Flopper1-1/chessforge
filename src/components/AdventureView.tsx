import React, { useState } from 'react';
import { CheckCircle2, Compass, Gem, Lock, Play, Sparkles, Trophy } from 'lucide-react';
import { ADVENTURE_NODES } from '../engine/presets';
import { AdventureNode, AdventureProgress, BoardDefinition } from '../engine/types';
import { PieceRegistry } from '../engine/rules';
import { ChessBoardView } from './ChessBoardView';

interface AdventureViewProps {
  boards: BoardDefinition[];
  registry: PieceRegistry;
  progress: AdventureProgress;
  onPlayNode: (node: AdventureNode) => void;
  onUnlockAll: () => void;
}

export const AdventureView: React.FC<AdventureViewProps> = ({
  boards,
  registry,
  progress,
  onPlayNode,
  onUnlockAll,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(ADVENTURE_NODES[0].id);

  const isCompleted = (id: string) => progress.completedNodeIds.includes(id);
  const isUnlocked = (node: AdventureNode) => {
    if (!node.requires || node.requires.length === 0) return true;
    return node.requires.every((req) => progress.completedNodeIds.includes(req));
  };

  const selectedNode =
    ADVENTURE_NODES.find((n) => n.id === selectedNodeId) ?? ADVENTURE_NODES[0];
  const selectedBoard = boards.find((b) => b.id === selectedNode.boardId) ?? boards[0];
  const selectedUnlocked = isUnlocked(selectedNode);
  const selectedCompleted = isCompleted(selectedNode.id);

  const completedCount = progress.completedNodeIds.length;

  return (
    <div className="space-y-5">
      {/* Adventure Banner */}
      <div className="parchment-panel rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-widest">
            <Compass className="w-4 h-4" /> Adventure Campaign
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-amber-100">
            Voyage Across the Four Chess Isles
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 max-w-2xl">
            Conquer 12 progressive chess variants — from Academy Skirmishes and Ranged Archers to Iron Bastions, Linked Portals, and the Grandmaster Colosseum.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-[#19130e] border border-amber-500/25 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-[10px] uppercase text-stone-400">Cleared</div>
              <div className="font-mono text-sm font-bold text-amber-200">
                {completedCount}/{ADVENTURE_NODES.length}
              </div>
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-[#19130e] border border-amber-500/25 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <div>
              <div className="text-[10px] uppercase text-stone-400">XP</div>
              <div className="font-mono text-sm font-bold text-sky-200">{progress.xp}</div>
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-[#19130e] border border-amber-500/25 flex items-center gap-2">
            <Gem className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] uppercase text-stone-400">Gems</div>
              <div className="font-mono text-sm font-bold text-emerald-200">{progress.gems}</div>
            </div>
          </div>
          {completedCount < ADVENTURE_NODES.length && (
            <button
              type="button"
              onClick={onUnlockAll}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-[#1f1812] border border-amber-500/25 text-stone-300 hover:text-amber-200 hover:border-amber-400/50 cursor-pointer"
              title="Unlock every island stage immediately for free exploration"
            >
              Unlock All
            </button>
          )}
        </div>
      </div>

      {/* Map + Selected Stage Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Interactive SVG Overworld Map */}
        <div className="lg:col-span-8 parchment-panel rounded-2xl p-3 sm:p-4 overflow-hidden">
          <svg
            viewBox="0 0 1000 520"
            className="w-full h-auto rounded-xl bg-[#122634] border border-amber-500/20"
            role="img"
            aria-label="Adventure Overworld Island Map"
          >
            <defs>
              <radialGradient id="oceanGrad" cx="50%" cy="45%" r="65%">
                <stop offset="0%" stopColor="#1b4258" />
                <stop offset="100%" stopColor="#0d1e2b" />
              </radialGradient>
              <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Ocean background */}
            <rect width="1000" height="520" fill="url(#oceanGrad)" />

            {/* Subtle sea wave contours */}
            <path d="M0 120 Q250 90 500 125 T1000 110" fill="none" stroke="#38bdf8" strokeOpacity="0.08" strokeWidth="2" />
            <path d="M0 320 Q300 355 600 310 T1000 340" fill="none" stroke="#38bdf8" strokeOpacity="0.08" strokeWidth="2" />
            <path d="M0 460 Q250 430 550 470 T1000 445" fill="none" stroke="#38bdf8" strokeOpacity="0.08" strokeWidth="2" />

            {/* Island 1: Academy Isle (Lush Green) */}
            <path
              d="M65 370 C55 300 120 235 205 245 C270 250 315 320 295 405 C280 465 185 475 110 445 C75 430 70 400 65 370 Z"
              fill="#3d6b46"
              stroke="#86b376"
              strokeWidth="4"
            />
            <text x="178" y="485" textAnchor="middle" fill="#a7d79d" fontSize="14" fontWeight="700" fontFamily="Cinzel, serif">
              ACADEMY ISLE
            </text>

            {/* Island 2: Iron Citadel (Slate Stone) */}
            <path
              d="M345 270 C340 185 405 135 485 155 C555 170 575 245 555 320 C535 375 445 380 375 355 C345 342 348 305 345 270 Z"
              fill="#4b5563"
              stroke="#94a3b8"
              strokeWidth="4"
            />
            <text x="455" y="395" textAnchor="middle" fill="#cbd5e1" fontSize="14" fontWeight="700" fontFamily="Cinzel, serif">
              IRON CITADEL
            </text>

            {/* Island 3: Portal Archipelago (Amethyst/Mystic) */}
            <path
              d="M590 365 C585 280 645 180 725 180 C785 180 805 265 785 355 C765 435 670 460 610 435 C590 425 592 395 590 365 Z"
              fill="#4c3568"
              stroke="#a78bfa"
              strokeWidth="4"
            />
            <text x="690" y="472" textAnchor="middle" fill="#ddd6fe" fontSize="14" fontWeight="700" fontFamily="Cinzel, serif">
              PORTAL ARCHIPELAGO
            </text>

            {/* Island 4: Grandmaster Spire (Volcanic Gold/Obsidian) */}
            <path
              d="M790 155 C795 85 865 55 930 75 C975 95 975 200 945 275 C920 325 845 305 810 250 C790 220 788 185 790 155 Z"
              fill="#5c3d28"
              stroke="#f59e0b"
              strokeWidth="4"
            />
            <text x="885" y="325" textAnchor="middle" fill="#fde68a" fontSize="14" fontWeight="700" fontFamily="Cinzel, serif">
              GRANDMASTER SPIRE
            </text>

            {/* Connecting Paths */}
            {ADVENTURE_NODES.map((node, idx) => {
              if (idx === 0) return null;
              const prev = ADVENTURE_NODES[idx - 1];
              const unlocked = isUnlocked(node);
              return (
                <line
                  key={`path-${node.id}`}
                  x1={prev.mapX}
                  y1={prev.mapY}
                  x2={node.mapX}
                  y2={node.mapY}
                  stroke={unlocked ? '#f59e0b' : '#64748b'}
                  strokeWidth={unlocked ? 3.5 : 2.5}
                  strokeDasharray={unlocked ? 'none' : '7 6'}
                  strokeOpacity={unlocked ? 0.9 : 0.45}
                />
              );
            })}

            {/* Interactive Stage Nodes */}
            {ADVENTURE_NODES.map((node) => {
              const completed = isCompleted(node.id);
              const unlocked = isUnlocked(node);
              const selected = node.id === selectedNode.id;

              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className="cursor-pointer"
                >
                  {selected && (
                    <circle
                      cx={node.mapX}
                      cy={node.mapY}
                      r="25"
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="3"
                      filter="url(#softGlow)"
                    />
                  )}
                  <circle
                    cx={node.mapX}
                    cy={node.mapY}
                    r="18"
                    fill={completed ? '#10b981' : unlocked ? '#d97706' : '#334155'}
                    stroke={selected ? '#fef3c7' : '#f8fafc'}
                    strokeWidth={selected ? 3 : 2}
                  />
                  <text
                    x={node.mapX}
                    y={node.mapY + 5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="13"
                    fontWeight="800"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {completed ? '✓' : node.order}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Stage Details Card */}
        <div className="lg:col-span-4 parchment-panel rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Stage {selectedNode.order} · {selectedNode.island}
              </div>
              <h3 className="text-xl font-bold text-amber-100 mt-0.5">{selectedNode.title}</h3>
              <p className="text-xs text-stone-400">{selectedNode.subtitle}</p>
            </div>
            {selectedCompleted ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
              </span>
            ) : !selectedUnlocked ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-700/60 text-stone-300 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" /> Locked
              </span>
            ) : null}
          </div>

          <ChessBoardView
            rows={selectedBoard.rows}
            cols={selectedBoard.cols}
            tiles={selectedBoard.tiles}
            grid={selectedBoard.initialPieces}
            registry={registry}
            theme={selectedBoard.theme}
            interactive={false}
            compact
          />

          <p className="text-xs text-stone-300 leading-relaxed">{selectedBoard.description}</p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[#19130e] p-2 border border-amber-500/15">
              <div className="text-[10px] text-stone-400 uppercase">Board</div>
              <div className="font-mono text-xs font-bold text-amber-200">
                {selectedBoard.rows}×{selectedBoard.cols}
              </div>
            </div>
            <div className="rounded-lg bg-[#19130e] p-2 border border-amber-500/15">
              <div className="text-[10px] text-stone-400 uppercase">AI Tier</div>
              <div className="text-xs font-bold text-amber-200 capitalize">
                {selectedNode.aiDifficulty}
              </div>
            </div>
            <div className="rounded-lg bg-[#19130e] p-2 border border-amber-500/15">
              <div className="text-[10px] text-stone-400 uppercase">Reward</div>
              <div className="font-mono text-xs font-bold text-emerald-300">
                +{selectedNode.rewardGems}💎
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!selectedUnlocked}
            onClick={() => onPlayNode(selectedNode)}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg cursor-pointer transition"
          >
            {selectedUnlocked ? (
              <>
                <Play className="w-4 h-4 fill-current" /> Play Stage {selectedNode.order}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" /> Complete Stage {selectedNode.order - 1} First
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
