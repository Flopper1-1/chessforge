import React from 'react';
import {
  BoardDefinition,
  Coord,
  Move,
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
  theme?: BoardDefinition['theme'];
  selected?: Coord | null;
  legalMoves?: Move[];
  lastMove?: Move | null;
  flipped?: boolean;
  /** Optional 0..1 heatmap overlay [r][c] from the Graph-Theory AI. */
  heatmap?: number[][] | null;
  onSquareClick?: (r: number, c: number) => void;
  interactive?: boolean;
  compact?: boolean;
}

const THEME_COLORS: Record<
  NonNullable<BoardDefinition['theme']>,
  { light: string; dark: string; coord: string }
> = {
  classic: { light: '#e8d5b5', dark: '#9e7248', coord: '#c9a97a' },
  stone: { light: '#cbd2d9', dark: '#6b7785', coord: '#9fb3c8' },
  emerald: { light: '#d6e5cc', dark: '#547a57', coord: '#9fc49e' },
  obsidian: { light: '#7b7485', dark: '#373242', coord: '#a79db8' },
  sandstone: { light: '#ecd8b1', dark: '#b37a45', coord: '#d4a66a' },
};

export const ChessBoardView: React.FC<ChessBoardViewProps> = ({
  rows,
  cols,
  tiles,
  grid,
  registry,
  theme = 'classic',
  selected,
  legalMoves = [],
  lastMove,
  flipped = false,
  heatmap = null,
  onSquareClick,
  interactive = true,
  compact = false,
}) => {
  const palette = THEME_COLORS[theme] ?? THEME_COLORS.classic;

  const rowOrder = Array.from({ length: rows }, (_, i) => (flipped ? rows - 1 - i : i));
  const colOrder = Array.from({ length: cols }, (_, i) => (flipped ? cols - 1 - i : i));

  const moveTargetMap = new Map<string, Move>();
  for (const m of legalMoves) {
    moveTargetMap.set(`${m.to.r},${m.to.c}`, m);
  }

  // Max dimension so large boards (up to 16x16) fit comfortably inside the viewport
  const maxBoardPx = compact ? 220 : Math.min(620, Math.max(420, cols * 64));

  return (
    <div
      className={`wood-frame rounded-xl ${compact ? 'p-1.5' : 'p-2.5 sm:p-3.5'} select-none mx-auto`}
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
            const targetMove = moveTargetMap.get(`${r},${c}`);
            const isLastFrom = lastMove?.from.r === r && lastMove?.from.c === c;
            const isLastTo =
              (lastMove?.to.r === r && lastMove?.to.c === c) ||
              (lastMove?.portalExit?.r === r && lastMove?.portalExit?.c === c);

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
                  title={interactive ? `Void tile (${String.fromCharCode(97 + c)}${rows - r})` : undefined}
                />
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
                {/* Tile rule visuals */}
                {tile.rule === 'sanctuary' && (
                  <div className="absolute inset-0.5 rounded-sm border-2 border-amber-300/85 bg-amber-400/20 pointer-events-none flex items-start justify-end p-0.5">
                    {!compact && (
                      <span className="text-[9px] leading-none font-bold text-amber-950 bg-amber-300/90 px-1 rounded">
                        🛡
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
                      <span className="text-[9px] leading-none font-mono font-bold text-white bg-black/60 px-1 rounded">
                        {tile.portalChannel ?? 'A'}
                      </span>
                    )}
                  </div>
                )}

                {tile.rule === 'promotion' && !compact && (
                  <div className="absolute inset-0 pointer-events-none flex items-start justify-start p-0.5">
                    <span
                      className={`text-[9px] leading-none font-bold px-1 rounded ${
                        tile.promotionFor === 'white'
                          ? 'bg-amber-100/80 text-amber-900'
                          : tile.promotionFor === 'black'
                            ? 'bg-stone-900/70 text-amber-300'
                            : 'bg-amber-500/80 text-stone-950'
                      }`}
                    >
                      ★
                    </span>
                  </div>
                )}

                {tile.rule === 'fallow' && (
                  <div className="absolute inset-0.5 border border-dashed border-orange-900/80 bg-orange-950/20 pointer-events-none flex items-end justify-end p-0.5">
                    {!compact && (
                      <span className="text-[9px] leading-none font-mono font-bold bg-orange-950/85 text-orange-200 px-1 rounded">
                        {tile.fallowUses ?? 0}
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
                  <div className="relative z-10 w-[84%] h-[84%] drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)] transition-transform duration-150">
                    <PieceIcon icon={pieceDef.icon} color={piece.color} rules={pieceDef.rules} />
                  </div>
                )}

                {/* Legal move target indicator */}
                {targetMove && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    {targetMove.isRangedCapture ? (
                      <div className="w-[88%] h-[88%] rounded-full border-[3px] border-amber-400 bg-red-600/30 animate-pulse" />
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
                {!compact && c === colOrder[0] && (
                  <span
                    className="absolute top-0.5 left-1 text-[9px] font-mono font-semibold opacity-70 pointer-events-none"
                    style={{ color: isLight ? '#5c3f22' : '#f3e5cc' }}
                  >
                    {rows - r}
                  </span>
                )}
                {!compact && r === rowOrder[rowOrder.length - 1] && (
                  <span
                    className="absolute bottom-0.5 right-1 text-[9px] font-mono font-semibold opacity-70 pointer-events-none"
                    style={{ color: isLight ? '#5c3f22' : '#f3e5cc' }}
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
