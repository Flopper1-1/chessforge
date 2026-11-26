import React from 'react';
import {
  BoardFrameStyle,
  BoardTheme,
  Coord,
  Move,
  PiecePalette,
  PlacedPiece,
  TileConfig,
} from '../engine/types';
import { PieceRegistry } from '../engine/rules';
import { PieceIcon } from './PieceIcon';

interface ChessBoardViewProps {
  rows: number;
  cols: number;
  tiles: TileConfig[][];
  grid: (PlacedPiece | null)[][];
  registry: PieceRegistry;
  theme?: BoardTheme;
  customLightSquare?: string;
  customDarkSquare?: string;
  boardFrame?: BoardFrameStyle;
  piecePalette?: PiecePalette;
  pieceScale?: 'compact' | 'normal' | 'large';
  selected?: Coord | null;
  legalMoves?: Move[];
  lastMove?: Move | null;
  flipped?: boolean;
  showCoordinates?: boolean;
  showLegalMoves?: boolean;
  showLastMove?: boolean;
  /** Optional 0..1 heatmap overlay [r][c] from the Graph-Theory AI. */
  heatmap?: number[][] | null;
  onSquareClick?: (r: number, c: number) => void;
  interactive?: boolean;
  compact?: boolean;
}

export const BOARD_THEME_COLORS: Record<
  BoardTheme,
  { label: string; light: string; dark: string }
> = {
  classic: { label: 'Classic Walnut', light: '#e8d5b5', dark: '#9e7248' },
  stone: { label: 'Slate Citadel', light: '#cbd2d9', dark: '#6b7785' },
  emerald: { label: 'Emerald Grove', light: '#d6e5cc', dark: '#547a57' },
  obsidian: { label: 'Obsidian Void', light: '#7b7485', dark: '#373242' },
  sandstone: { label: 'Sandstone Oasis', light: '#ecd8b1', dark: '#b37a45' },
  crimson: { label: 'Royal Crimson', light: '#f0d5d5', dark: '#8c3b46' },
  frost: { label: 'Frost Marble', light: '#e2eef8', dark: '#5b7fa6' },
  custom: { label: 'Custom Colors', light: '#e8d5b5', dark: '#9e7248' },
};

const FRAME_CLASSES: Record<BoardFrameStyle, string> = {
  walnut: 'wood-frame',
  gold: 'bg-gradient-to-br from-amber-600 via-yellow-700 to-amber-900 border-[3px] border-amber-300/70 shadow-2xl',
  steel: 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950 border-[3px] border-slate-500/60 shadow-2xl',
  minimal: 'bg-[#1a1612] border border-amber-500/25 shadow-xl',
};

export const ChessBoardView: React.FC<ChessBoardViewProps> = ({
  rows,
  cols,
  tiles,
  grid,
  registry,
  theme = 'classic',
  customLightSquare = '#e8d5b5',
  customDarkSquare = '#9e7248',
  boardFrame = 'walnut',
  piecePalette = 'ivory',
  pieceScale = 'normal',
  selected,
  legalMoves = [],
  lastMove,
  flipped = false,
  showCoordinates = true,
  showLegalMoves = true,
  showLastMove = true,
  heatmap = null,
  onSquareClick,
  interactive = true,
  compact = false,
}) => {
  const palette =
    theme === 'custom'
      ? { label: 'Custom', light: customLightSquare, dark: customDarkSquare }
      : BOARD_THEME_COLORS[theme] ?? BOARD_THEME_COLORS.classic;
  const pieceSizeClass =
    pieceScale === 'compact' ? 'w-[72%] h-[72%]' : pieceScale === 'large' ? 'w-[92%] h-[92%]' : 'w-[84%] h-[84%]';

  const rowOrder = Array.from({ length: rows }, (_, i) => (flipped ? rows - 1 - i : i));
  const colOrder = Array.from({ length: cols }, (_, i) => (flipped ? cols - 1 - i : i));

  // Deduplicate legal moves by destination square (promotion moves share a destination)
  const moveTargetMap = new Map<string, Move>();
  for (const m of legalMoves) {
    const key = `${m.to.r},${m.to.c}`;
    if (!moveTargetMap.has(key)) {
      moveTargetMap.set(key, m);
    }
  }

  const maxBoardPx = compact ? 220 : Math.min(620, Math.max(420, cols * 64));

  return (
    <div
      className={`${FRAME_CLASSES[boardFrame] ?? FRAME_CLASSES.walnut} rounded-xl ${compact ? 'p-1.5' : 'p-2.5 sm:p-3.5'} select-none mx-auto`}
      style={{
        width: '100%',
        maxWidth: `${maxBoardPx}px`,
      }}
    >
      <div
        className="grid gap-0 rounded-md overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          aspectRatio: `${cols} / ${rows}`,
        }}
      >
        {rowOrder.map((r) =>
          colOrder.map((c) => {
            const tile = tiles[r]?.[c] ?? { rule: 'normal' };
            const piece = grid[r]?.[c] ?? null;
            const pieceDef = piece ? registry[piece.pieceId] : null;
            const isLight = (r + c) % 2 === 0;
            const isVoid = tile.rule === 'void';
            const isSelected = selected?.r === r && selected?.c === c;
            const targetMove = showLegalMoves ? moveTargetMap.get(`${r},${c}`) : undefined;
            const isLastFrom = showLastMove && lastMove?.from.r === r && lastMove?.from.c === c;
            const isLastTo =
              showLastMove &&
              ((lastMove?.to.r === r && lastMove?.to.c === c) ||
                (lastMove?.portalExit?.r === r && lastMove?.portalExit?.c === c));

            const heatVal = heatmap?.[r]?.[c];

            if (isVoid) {
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={!interactive}
                  onClick={() => interactive && onSquareClick?.(r, c)}
                  className={`relative aspect-square bg-[#120e0b]/90 border border-[#241c15]/50 ${
                    interactive ? 'cursor-pointer hover:bg-[#1e1712]' : 'cursor-default'
                  }`}
                  title={interactive ? `Void chasm (${String.fromCharCode(97 + c)}${rows - r})` : undefined}
                />
              );
            }

            if (tile.rule === 'wall') {
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={!interactive}
                  onClick={() => interactive && onSquareClick?.(r, c)}
                  className={`relative aspect-square bg-gradient-to-br from-stone-600 to-stone-800 border-2 border-stone-500/80 shadow-inner flex items-center justify-center ${
                    interactive ? 'cursor-pointer hover:brightness-110' : 'cursor-default'
                  }`}
                  title="Stone Wall (Blocks sliding pieces; leapers can jump over)"
                >
                  {!compact && (
                    <span className="text-[9px] font-mono font-bold tracking-tight text-stone-200 bg-stone-900/70 px-1 rounded">
                      WALL
                    </span>
                  )}
                </button>
              );
            }

            let bg = isLight ? palette.light : palette.dark;
            if (isSelected) bg = '#d99b26';
            else if (isLastFrom || isLastTo) {
              bg = isLight ? '#e8d47b' : '#b89b3c';
            }

            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={!interactive}
                onClick={() => interactive && onSquareClick?.(r, c)}
                style={{ backgroundColor: bg }}
                className={`relative aspect-square flex items-center justify-center transition-colors duration-100 ${
                  interactive ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400/80' : 'cursor-default'
                }`}
                aria-label={`${String.fromCharCode(97 + c)}${rows - r}${pieceDef ? ` ${piece?.color} ${pieceDef.name}` : ''}`}
              >
                {/* Tile rule visuals (clean typographic badges, zero emojis) */}
                {tile.rule === 'sanctuary' && (
                  <div className="absolute inset-0.5 rounded-sm border-2 border-amber-300/85 bg-amber-400/20 pointer-events-none flex items-start justify-end p-0.5">
                    {!compact && (
                      <span className="text-[8px] leading-none font-mono font-bold text-amber-950 bg-amber-300/95 px-1 py-0.5 rounded">
                        SAFE
                      </span>
                    )}
                  </div>
                )}

                {tile.rule === 'portal' && (
                  <div
                    className={`absolute inset-0.5 rounded-full border-2 pointer-events-none flex items-start justify-end p-0.5 ${
                      tile.portalChannel === 'B'
                        ? 'border-purple-400 portal-glow-B'
                        : tile.portalChannel === 'C'
                          ? 'border-emerald-400 portal-glow-C'
                          : 'border-sky-400 portal-glow-A'
                    }`}
                  >
                    {!compact && (
                      <span className="text-[8px] leading-none font-mono font-bold text-white bg-black/70 px-1 py-0.5 rounded">
                        P{tile.portalChannel ?? 'A'}
                      </span>
                    )}
                  </div>
                )}

                {tile.rule === 'promotion' && !compact && (
                  <div className="absolute inset-0 pointer-events-none flex items-start justify-start p-0.5">
                    <span
                      className={`text-[8px] leading-none font-mono font-bold px-1 py-0.5 rounded ${
                        tile.promotionFor === 'white'
                          ? 'bg-amber-100/90 text-amber-950'
                          : tile.promotionFor === 'black'
                            ? 'bg-stone-900/85 text-amber-300'
                            : tile.promotionFor === 'red'
                              ? 'bg-red-600/90 text-white'
                              : tile.promotionFor === 'blue'
                                ? 'bg-blue-600/90 text-white'
                                : 'bg-amber-500/90 text-stone-950'
                      }`}
                    >
                      PRO
                    </span>
                  </div>
                )}

                {tile.rule === 'fallow' && (
                  <div className="absolute inset-0.5 border border-dashed border-orange-900/80 bg-orange-950/20 pointer-events-none flex items-end justify-end p-0.5">
                    {!compact && (
                      <span className="text-[8px] leading-none font-mono font-bold bg-orange-950/85 text-orange-200 px-1 py-0.5 rounded">
                        {tile.fallowUses ?? 0}x
                      </span>
                    )}
                  </div>
                )}

                {tile.rule === 'ice' && (
                  <div className="absolute inset-0.5 border border-cyan-300/80 bg-cyan-300/25 pointer-events-none flex items-start justify-end p-0.5">
                    {!compact && (
                      <span className="text-[8px] leading-none font-mono font-bold text-cyan-950 bg-cyan-200/95 px-1 py-0.5 rounded">
                        ICE
                      </span>
                    )}
                  </div>
                )}

                {tile.rule === 'trap' && (
                  <div className="absolute inset-0.5 border border-rose-500/80 bg-rose-600/20 pointer-events-none flex items-start justify-end p-0.5">
                    {!compact && (
                      <span className="text-[8px] leading-none font-mono font-bold text-white bg-rose-700/95 px-1 py-0.5 rounded">
                        TRAP
                      </span>
                    )}
                  </div>
                )}

                {tile.rule === 'boost' && (
                  <div className="absolute inset-0.5 border-2 border-emerald-400/80 bg-emerald-400/20 pointer-events-none flex items-start justify-end p-0.5">
                    {!compact && (
                      <span className="text-[8px] leading-none font-mono font-bold text-emerald-950 bg-emerald-300/95 px-1 py-0.5 rounded">
                        +1
                      </span>
                    )}
                  </div>
                )}

                {tile.rule === 'summit' && (
                  <div className="absolute inset-0.5 border-2 border-yellow-300 bg-yellow-400/30 pointer-events-none flex items-start justify-end p-0.5">
                    {!compact && (
                      <span className="text-[8px] leading-none font-mono font-bold text-yellow-950 bg-yellow-300 px-1 py-0.5 rounded">
                        HILL
                      </span>
                    )}
                  </div>
                )}

                {/* Graph-Theory AI Heatmap Overlay */}
                {heatVal !== undefined && heatVal > 0 && (
                  <div
                    className="absolute inset-0 pointer-events-none flex items-end justify-start p-0.5"
                    style={{
                      backgroundColor: `rgba(${Math.round(240 * heatVal)}, ${Math.round(
                        170 * (1 - Math.abs(heatVal - 0.5))
                      )}, ${Math.round(220 * (1 - heatVal))}, ${0.22 + heatVal * 0.45})`,
                    }}
                  >
                    {!compact && cols <= 10 && (
                      <span className="text-[9px] font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                        {Math.round(heatVal * 100)}
                      </span>
                    )}
                  </div>
                )}

                {/* Piece */}
                {piece && pieceDef && (
                  <div className={`relative z-10 ${pieceSizeClass} drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)] transition-transform duration-150`}>
                    <PieceIcon
                      icon={pieceDef.icon}
                      color={piece.color}
                      rules={pieceDef.rules}
                      palette={piecePalette}
                      customAppearance={pieceDef.customAppearance}
                    />
                  </div>
                )}

                {/* Legal move target indicator */}
                {targetMove && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    {targetMove.castling ? (
                      <div className="px-1.5 py-0.5 rounded bg-amber-400/95 text-stone-950 text-[9px] font-mono font-extrabold shadow-md border border-amber-100">
                        O-O
                      </div>
                    ) : targetMove.isSwap ? (
                      <div className="px-1.5 py-0.5 rounded bg-cyan-400/95 text-stone-950 text-[9px] font-mono font-extrabold shadow-md border border-cyan-100">
                        SWP
                      </div>
                    ) : targetMove.isRangedCapture ? (
                      <div className="w-[88%] h-[88%] rounded-full border-[3px] border-amber-400 bg-red-600/30 animate-pulse" />
                    ) : targetMove.enPassantCaptureCoord ? (
                      <div className="w-[72%] h-[72%] rounded-full border-[3px] border-dashed border-rose-400 bg-rose-500/25 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white bg-rose-600/90 px-1 rounded">EP</span>
                      </div>
                    ) : targetMove.captured ? (
                      <div className="w-[88%] h-[88%] rounded-full border-[3px] border-rose-500/90" />
                    ) : targetMove.portalExit ? (
                      <div className="w-[46%] h-[46%] rounded-full border-2 border-sky-300 bg-sky-400/50" />
                    ) : (
                      <div className="w-[30%] h-[30%] rounded-full bg-stone-900/45 ring-2 ring-amber-200/60" />
                    )}
                  </div>
                )}

                {/* Coordinates on edges */}
                {showCoordinates && !compact && c === colOrder[0] && (
                  <span
                    className="absolute top-0.5 left-1 text-[9px] font-mono font-semibold opacity-70 pointer-events-none"
                    style={{ color: isLight ? '#4a321a' : '#f3e5cc' }}
                  >
                    {rows - r}
                  </span>
                )}
                {showCoordinates && !compact && r === rowOrder[rowOrder.length - 1] && (
                  <span
                    className="absolute bottom-0.5 right-1 text-[9px] font-mono font-semibold opacity-70 pointer-events-none"
                    style={{ color: isLight ? '#4a321a' : '#f3e5cc' }}
                  >
                    {String.fromCharCode(97 + c)}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
