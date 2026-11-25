import React, { useEffect, useState } from 'react';
import {
  Eraser,
  Grid,
  Play,
  Plus,
  Save,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  BoardDefinition,
  BoardRuleSettings,
  BoardTheme,
  Color,
  DEFAULT_BOARD_RULES,
  PieceDefinition,
  PiecePalette,
  PlacedPiece,
  PortalChannel,
  TileConfig,
  WinCondition,
} from '../engine/types';
import { makePiece } from '../engine/presets';
import { getBoardRules, PieceRegistry } from '../engine/rules';
import { BOARD_THEME_COLORS, ChessBoardView } from './ChessBoardView';
import { PieceIcon } from './PieceIcon';

interface BoardForgeViewProps {
  boards: BoardDefinition[];
  initialBoard?: BoardDefinition | null;
  pieces: PieceDefinition[];
  registry: PieceRegistry;
  piecePalette: PiecePalette;
  onSaveBoard: (board: BoardDefinition) => void;
  onDeleteBoard: (boardId: string) => void;
  onTestPlay: (board: BoardDefinition) => void;
}

type PaintTool =
  | { kind: 'piece'; pieceId: string; color: Color }
  | { kind: 'erasePiece' }
  | { kind: 'tile'; tile: TileConfig };

type SymmetryMode = 'none' | 'vertical' | 'horizontal' | 'quad';
type LeftTab = 'setup' | 'rules';

function cloneBoard(b: BoardDefinition): BoardDefinition {
  return {
    ...b,
    rules: b.rules ? { ...b.rules, promotionPool: b.rules.promotionPool ? [...b.rules.promotionPool] : undefined } : undefined,
    tiles: b.tiles.map((row) => row.map((t) => ({ ...t }))),
    initialPieces: b.initialPieces.map((row) => row.map((p) => (p ? { ...p } : null))),
  };
}

function createBlankBoard(rows = 8, cols = 8): BoardDefinition {
  const tiles: TileConfig[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ rule: 'normal' as const }))
  );
  for (let c = 0; c < cols; c++) {
    tiles[0][c] = { rule: 'promotion', promotionFor: 'white' };
    tiles[rows - 1][c] = { rule: 'promotion', promotionFor: 'black' };
  }
  const initialPieces: (PlacedPiece | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
  initialPieces[0][Math.floor(cols / 2)] = makePiece('king', 'black');
  initialPieces[rows - 1][Math.floor(cols / 2)] = makePiece('king', 'white');
  return {
    id: `board_${Date.now()}`,
    name: 'Custom Arena',
    description: 'Hand-crafted custom chess variant.',
    rows,
    cols,
    tiles,
    initialPieces,
    theme: 'classic',
    rules: { ...DEFAULT_BOARD_RULES },
    isBuiltin: false,
  };
}

export const BoardForgeView: React.FC<BoardForgeViewProps> = ({
  boards,
  initialBoard,
  pieces,
  registry,
  piecePalette,
  onSaveBoard,
  onDeleteBoard,
  onTestPlay,
}) => {
  const [draft, setDraft] = useState<BoardDefinition>(() =>
    initialBoard ? cloneBoard(initialBoard) : createBlankBoard(8, 8)
  );
  const [undoStack, setUndoStack] = useState<BoardDefinition[]>([]);
  const [leftTab, setLeftTab] = useState<LeftTab>('setup');
  const [tool, setTool] = useState<PaintTool>({
    kind: 'piece',
    pieceId: 'queen',
    color: 'white',
  });
  const [paintColor, setPaintColor] = useState<Color>('white');
  const [symmetry, setSymmetry] = useState<SymmetryMode>('vertical');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialBoard) {
      setDraft(cloneBoard(initialBoard));
      setUndoStack([]);
    }
  }, [initialBoard]);

  const activeRules: BoardRuleSettings = getBoardRules(draft);

  function pushDraft(next: BoardDefinition) {
    setUndoStack((prev) => [...prev.slice(-24), cloneBoard(draft)]);
    setDraft(next);
  }

  function handleUndoPaint() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setDraft(prev);
  }

  function updateRules(patch: Partial<BoardRuleSettings>) {
    pushDraft({
      ...cloneBoard(draft),
      rules: { ...activeRules, ...patch },
    });
  }

  function togglePromoPiece(pieceId: string) {
    const exists = activeRules.promotionPool.includes(pieceId);
    const nextPool = exists
      ? activeRules.promotionPool.filter((id) => id !== pieceId)
      : [...activeRules.promotionPool, pieceId];
    if (nextPool.length === 0) return; // keep at least 1 promotion choice
    updateRules({ promotionPool: nextPool });
  }

  function resizeBoard(newRows: number, newCols: number) {
    const rClamped = Math.max(4, Math.min(16, newRows));
    const cClamped = Math.max(4, Math.min(16, newCols));
    const nextTiles: TileConfig[][] = Array.from({ length: rClamped }, (_, r) =>
      Array.from({ length: cClamped }, (_, c) =>
        draft.tiles[r]?.[c] ? { ...draft.tiles[r][c] } : { rule: 'normal' as const }
      )
    );
    const nextPieces: (PlacedPiece | null)[][] = Array.from({ length: rClamped }, (_, r) =>
      Array.from({ length: cClamped }, (_, c) =>
        draft.initialPieces[r]?.[c] ? { ...draft.initialPieces[r][c]! } : null
      )
    );
    pushDraft({
      ...cloneBoard(draft),
      rows: rClamped,
      cols: cClamped,
      tiles: nextTiles,
      initialPieces: nextPieces,
    });
  }

  function applyPaint(r: number, c: number) {
    const next = cloneBoard(draft);
    const coords: { r: number; c: number; flipColor: boolean }[] = [{ r, c, flipColor: false }];

    if (symmetry === 'vertical' || symmetry === 'quad') {
      const mr = next.rows - 1 - r;
      if (mr !== r) coords.push({ r: mr, c, flipColor: true });
    }
    if (symmetry === 'horizontal' || symmetry === 'quad') {
      const mc = next.cols - 1 - c;
      if (mc !== c) coords.push({ r, c: mc, flipColor: false });
    }
    if (symmetry === 'quad') {
      const mr = next.rows - 1 - r;
      const mc = next.cols - 1 - c;
      if (mr !== r && mc !== c) coords.push({ r: mr, c: mc, flipColor: true });
    }

    for (const pt of coords) {
      if (tool.kind === 'erasePiece') {
        next.initialPieces[pt.r][pt.c] = null;
      } else if (tool.kind === 'piece') {
        if (next.tiles[pt.r][pt.c].rule === 'void') {
          next.tiles[pt.r][pt.c] = { rule: 'normal' };
        }
        const col: Color = pt.flipColor
          ? tool.color === 'white'
            ? 'black'
            : 'white'
          : tool.color;
        next.initialPieces[pt.r][pt.c] = makePiece(tool.pieceId, col);
      } else if (tool.kind === 'tile') {
        const tileCopy: TileConfig = { ...tool.tile };
        if (tileCopy.rule === 'promotion' && pt.flipColor && tileCopy.promotionFor !== 'both') {
          tileCopy.promotionFor = tileCopy.promotionFor === 'white' ? 'black' : 'white';
        }
        next.tiles[pt.r][pt.c] = tileCopy;
        if (tileCopy.rule === 'void') {
          next.initialPieces[pt.r][pt.c] = null;
        }
      }
    }

    pushDraft(next);
  }

  function handleSave(andPlay = false) {
    const clean: BoardDefinition = {
      ...cloneBoard(draft),
      id: draft.isBuiltin ? `board_${Date.now()}` : draft.id,
      name: draft.name.trim() || 'Custom Arena',
      isBuiltin: false,
    };
    onSaveBoard(clean);
    setDraft(clean);
    if (andPlay) {
      onTestPlay(clean);
    } else {
      setSavedNotice(`Saved "${clean.name}"!`);
      window.setTimeout(() => setSavedNotice(null), 2400);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left: Tabbed Blueprint Setup & Match Rules */}
      <div className="lg:col-span-3 space-y-4">
        <div className="parchment-panel rounded-2xl overflow-hidden">
          <div className="grid grid-cols-2 border-b border-amber-500/20 bg-[#17120d]">
            <button
              type="button"
              onClick={() => setLeftTab('setup')}
              className={`py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                leftTab === 'setup'
                  ? 'bg-amber-500/20 text-amber-200 border-b-2 border-amber-400'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Setup
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('rules')}
              className={`py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                leftTab === 'rules'
                  ? 'bg-amber-500/20 text-amber-200 border-b-2 border-amber-400'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Rules &amp; Promo
            </button>
          </div>

          <div className="p-4 space-y-3.5">
            {leftTab === 'setup' ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Board Blueprint
                  </span>
                  <button
                    type="button"
                    onClick={() => pushDraft(createBlankBoard(8, 8))}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600 text-stone-950 text-[11px] font-bold hover:bg-amber-500 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Blank
                  </button>
                </div>

                <div>
                  <label htmlFor="bf-name" className="text-[11px] uppercase text-stone-400">
                    Board Name
                  </label>
                  <input
                    id="bf-name"
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-3 py-1.5 text-sm text-amber-50"
                  />
                </div>

                <div>
                  <label htmlFor="bf-desc" className="text-[11px] uppercase text-stone-400">
                    Description
                  </label>
                  <textarea
                    id="bf-desc"
                    rows={2}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-3 py-1.5 text-xs text-stone-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="bf-rows" className="text-[11px] uppercase text-stone-400">
                      Rows (4–16)
                    </label>
                    <input
                      id="bf-rows"
                      type="number"
                      min={4}
                      max={16}
                      value={draft.rows}
                      onChange={(e) => resizeBoard(Number(e.target.value), draft.cols)}
                      className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-2.5 py-1.5 text-sm font-mono text-amber-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="bf-cols" className="text-[11px] uppercase text-stone-400">
                      Cols (4–16)
                    </label>
                    <input
                      id="bf-cols"
                      type="number"
                      min={4}
                      max={16}
                      value={draft.cols}
                      onChange={(e) => resizeBoard(draft.rows, Number(e.target.value))}
                      className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-2.5 py-1.5 text-sm font-mono text-amber-100"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] uppercase text-stone-400">Board Theme</span>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    {(Object.keys(BOARD_THEME_COLORS) as BoardTheme[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDraft({ ...draft, theme: t })}
                        className={`py-1 px-2 rounded text-[11px] text-left flex items-center gap-1.5 cursor-pointer ${
                          draft.theme === t
                            ? 'bg-amber-500/30 border border-amber-400 text-amber-100'
                            : 'bg-[#18120d] border border-amber-500/15 text-stone-400'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-sm shrink-0 border border-white/20"
                          style={{ backgroundColor: BOARD_THEME_COLORS[t].dark }}
                        />
                        <span className="truncate">{BOARD_THEME_COLORS[t].label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] uppercase text-stone-400">Symmetry Brush</span>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    {(
                      [
                        ['none', 'Off'],
                        ['vertical', 'Mirror Teams'],
                        ['horizontal', 'Mirror L/R'],
                        ['quad', '4-Way Mirror'],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSymmetry(mode)}
                        className={`py-1.5 px-2 rounded text-[11px] font-medium cursor-pointer ${
                          symmetry === mode
                            ? 'bg-amber-500/25 border border-amber-400 text-amber-100'
                            : 'bg-[#18120d] border border-amber-500/15 text-stone-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label htmlFor="bf-win" className="text-[11px] uppercase text-stone-400">
                    Win Condition
                  </label>
                  <select
                    id="bf-win"
                    value={activeRules.winCondition}
                    onChange={(e) => updateRules({ winCondition: e.target.value as WinCondition })}
                    className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-2.5 py-2 text-xs text-amber-50"
                  >
                    <option value="checkmate">Standard Checkmate</option>
                    <option value="king_of_the_hill">King of the Hill (Reach Center/Sanctuary)</option>
                    <option value="annihilation">Annihilation (Capture All Pieces)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] uppercase text-stone-400">Chess &amp; Draw Rules</span>
                  {(
                    [
                      ['castlingEnabled', 'Enable Castling'],
                      ['enPassantEnabled', 'Enable En Passant'],
                      ['drawByRepetition', 'Threefold Repetition Draw'],
                      ['drawByFiftyMove', '50-Move Rule Draw'],
                      ['drawByInsufficientMaterial', 'Insufficient Material Draw'],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#19130e] border border-amber-500/15 text-xs text-stone-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={activeRules[key]}
                        onChange={(e) => updateRules({ [key]: e.target.checked })}
                        className="accent-amber-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] uppercase text-stone-400">
                    Promotion Choices ({activeRules.promotionPool.length} selected)
                  </span>
                  <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto pr-1">
                    {pieces
                      .filter((p) => !p.rules.royal)
                      .map((p) => {
                        const checked = activeRules.promotionPool.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] border cursor-pointer ${
                              checked
                                ? 'bg-amber-500/20 border-amber-400/60 text-amber-100'
                                : 'bg-[#17120d] border-amber-500/10 text-stone-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePromoPiece(p.id)}
                              className="accent-amber-500"
                            />
                            <span className="truncate">{p.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-amber-500/15">
              <button
                type="button"
                onClick={() => handleSave(false)}
                className="flex-1 py-2 rounded-xl bg-[#221a13] border border-amber-500/40 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-amber-500/20 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 hover:from-amber-400 hover:to-amber-500 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Test vs AI
              </button>
            </div>
            {savedNotice && <p className="text-xs text-emerald-300">{savedNotice}</p>}
          </div>
        </div>

        {/* Load Existing Board */}
        <div className="parchment-panel rounded-2xl p-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Grid className="w-3.5 h-3.5" /> Load Template
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {boards.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#19130e] border border-amber-500/15 hover:border-amber-500/40"
              >
                <button
                  type="button"
                  onClick={() => pushDraft(cloneBoard(b))}
                  className="text-xs text-stone-200 hover:text-amber-200 truncate text-left flex-1 cursor-pointer"
                >
                  {b.name} <span className="text-stone-500 font-mono">({b.rows}×{b.cols})</span>
                </button>
                {!b.isBuiltin && (
                  <button
                    type="button"
                    onClick={() => onDeleteBoard(b.id)}
                    className="p-1 text-stone-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center: Interactive Canvas */}
      <div className="lg:col-span-6 space-y-3">
        <div className="parchment-panel rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-stone-300">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Click any square to paint with the selected brush.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndoPaint}
              disabled={undoStack.length === 0}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1d1712] border border-amber-500/25 text-amber-200 disabled:opacity-40 cursor-pointer"
            >
              <Undo2 className="w-3 h-3" /> Undo
            </button>
            <span className="font-mono text-amber-300">
              {draft.rows}×{draft.cols}
            </span>
          </div>
        </div>

        <ChessBoardView
          rows={draft.rows}
          cols={draft.cols}
          tiles={draft.tiles}
          grid={draft.initialPieces}
          registry={registry}
          theme={draft.theme}
          piecePalette={piecePalette}
          onSquareClick={applyPaint}
        />
      </div>

      {/* Right: Paint Palette */}
      <div className="lg:col-span-3 space-y-4">
        <div className="parchment-panel rounded-2xl p-4 space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Tile Rule Brushes
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ['Normal Tile', { rule: 'normal' }],
                ['Void Chasm', { rule: 'void' }],
                ['🧱 Stone Wall', { rule: 'wall' }],
                ['🛡 Sanctuary', { rule: 'sanctuary' }],
                ['❄ Ice Slide', { rule: 'ice' }],
                ['⚠ Spike Trap', { rule: 'trap' }],
                ['⚡ Power Boost', { rule: 'boost' }],
                ['♛ Crown Summit', { rule: 'summit' }],
                ['# Fallow (2x)', { rule: 'fallow', fallowUses: 2 }],
                ['# Fallow (3x)', { rule: 'fallow', fallowUses: 3 }],
                ['★ Promo (White)', { rule: 'promotion', promotionFor: 'white' }],
                ['★ Promo (Black)', { rule: 'promotion', promotionFor: 'black' }],
                ['★ Promo (Both)', { rule: 'promotion', promotionFor: 'both' }],
                ['◎ Portal A', { rule: 'portal', portalChannel: 'A' as PortalChannel }],
                ['◎ Portal B', { rule: 'portal', portalChannel: 'B' as PortalChannel }],
                ['◎ Portal C', { rule: 'portal', portalChannel: 'C' as PortalChannel }],
              ] as [string, TileConfig][]
            ).map(([label, tileCfg]) => {
              const active =
                tool.kind === 'tile' &&
                tool.tile.rule === tileCfg.rule &&
                tool.tile.portalChannel === tileCfg.portalChannel &&
                tool.tile.promotionFor === tileCfg.promotionFor &&
                tool.tile.fallowUses === tileCfg.fallowUses;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTool({ kind: 'tile', tile: tileCfg })}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border text-left transition cursor-pointer ${
                    active
                      ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                      : 'bg-[#19130e] border-amber-500/15 text-stone-300 hover:border-amber-500/40'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="parchment-panel rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Piece Brushes
            </h3>
            <button
              type="button"
              onClick={() => setTool({ kind: 'erasePiece' })}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border cursor-pointer ${
                tool.kind === 'erasePiece'
                  ? 'bg-rose-500/30 border-rose-400 text-rose-100'
                  : 'bg-[#19130e] border-amber-500/20 text-stone-300'
              }`}
            >
              <Eraser className="w-3 h-3" /> Erase
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {(['white', 'black'] as Color[]).map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => {
                  setPaintColor(col);
                  if (tool.kind === 'piece') {
                    setTool({ ...tool, color: col });
                  }
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold capitalize border cursor-pointer ${
                  paintColor === col
                    ? 'bg-amber-600 text-stone-950 border-amber-400'
                    : 'bg-[#19130e] text-stone-300 border-amber-500/20'
                }`}
              >
                {col} Side
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto pr-1">
            {pieces.map((p) => {
              const active =
                tool.kind === 'piece' && tool.pieceId === p.id && tool.color === paintColor;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTool({ kind: 'piece', pieceId: p.id, color: paintColor })}
                  className={`flex flex-col items-center p-1.5 rounded-lg border transition cursor-pointer ${
                    active
                      ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                      : 'bg-[#18120d] border-amber-500/15 text-stone-300 hover:border-amber-500/40'
                  }`}
                >
                  <span className="w-7 h-7">
                    <PieceIcon
                      icon={p.icon}
                      color={paintColor}
                      rules={p.rules}
                      palette={piecePalette}
                      customAppearance={p.customAppearance}
                    />
                  </span>
                  <span className="text-[10px] truncate w-full text-center mt-0.5">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
