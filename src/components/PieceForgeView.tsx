import React, { useMemo, useState } from 'react';
import { Copy, Eraser, Hammer, Paintbrush, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import {
  CustomPieceAppearance,
  Direction8,
  HopMode,
  HopOffset,
  PieceBaseStyle,
  PieceCrestStyle,
  PieceDefinition,
  PieceIconId,
  PiecePalette,
  SlideRanges,
} from '../engine/types';
import { estimatePieceValueOnStandardBoard } from '../engine/graphAi';
import { PIECE_ICON_LIST, PieceIcon } from './PieceIcon';

interface PieceForgeViewProps {
  pieces: PieceDefinition[];
  piecePalette: PiecePalette;
  onSavePiece: (piece: PieceDefinition) => void;
  onDeletePiece: (pieceId: string) => void;
}

const SLIDE_GRID: (Direction8 | 'CENTER')[] = [
  'NW', 'N', 'NE',
  'W', 'CENTER', 'E',
  'SW', 'S', 'SE',
];

const HOP_BRUSHES: { mode: HopMode | 'erase'; symbol: string; label: string; colorClass: string }[] = [
  { mode: 'both', symbol: 'M+C', label: 'Move+Cap', colorClass: 'bg-emerald-600/35 border-emerald-400 text-emerald-100' },
  { mode: 'move', symbol: 'MOV', label: 'Move Only', colorClass: 'bg-sky-600/35 border-sky-400 text-sky-100' },
  { mode: 'capture', symbol: 'CAP', label: 'Cap Only', colorClass: 'bg-rose-600/35 border-rose-400 text-rose-100' },
  { mode: 'first_move', symbol: '1ST', label: '1st Move', colorClass: 'bg-amber-600/35 border-amber-400 text-amber-100' },
  { mode: 'en_passant', symbol: 'EP', label: 'En Passant', colorClass: 'bg-purple-600/35 border-purple-400 text-purple-100' },
  { mode: 'ranged', symbol: 'RNG', label: 'Ranged', colorClass: 'bg-orange-600/35 border-orange-400 text-orange-100' },
  { mode: 'swap', symbol: 'SWP', label: 'Ally Swap', colorClass: 'bg-cyan-600/35 border-cyan-400 text-cyan-100' },
  { mode: 'erase', symbol: 'CLR', label: 'Erase', colorClass: 'bg-stone-800 border-stone-500 text-stone-200' },
];

const PIXEL_SWATCHES = [
  '#f59e0b', '#ef4444', '#10b981', '#38bdf8',
  '#a855f7', '#f8fafc', '#94a3b8', '#1e293b',
];

function createEmptyPixels(): string[][] {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ''));
}

function createBlankPiece(): PieceDefinition {
  return {
    id: `custom_${Date.now()}`,
    name: 'Valkyrie',
    shortCode: 'V',
    icon: 'gryphon',
    description: 'Custom forged chess piece.',
    hops: [
      { dr: -2, dc: -1, mode: 'both' },
      { dr: -2, dc: 1, mode: 'both' },
    ],
    slides: { NE: 4, NW: 4 },
    rules: { canPromote: false },
    isBuiltin: false,
  };
}

export const PieceForgeView: React.FC<PieceForgeViewProps> = ({
  pieces,
  piecePalette,
  onSavePiece,
  onDeletePiece,
}) => {
  const [draft, setDraft] = useState<PieceDefinition>(() => createBlankPiece());
  const [hopBrush, setHopBrush] = useState<HopMode | 'erase'>('both');
  const [mirrorHops, setMirrorHops] = useState(true);
  const [appearanceTab, setAppearanceTab] = useState<'preset' | 'layered' | 'pixel'>('preset');
  const [pixelColor, setPixelColor] = useState('#f59e0b');
  const [pixelMirror, setPixelMirror] = useState(true);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const liveEstimate = useMemo(() => estimatePieceValueOnStandardBoard(draft), [draft]);

  function getHopAt(dr: number, dc: number): HopOffset | undefined {
    return draft.hops.find((h) => h.dr === dr && h.dc === dc);
  }

  function paintHop(dr: number, dc: number) {
    if (dr === 0 && dc === 0) return;
    const existing = getHopAt(dr, dc);
    const targets: { dr: number; dc: number }[] = [{ dr, dc }];
    if (mirrorHops && dc !== 0) targets.push({ dr, dc: -dc });

    const filtered = draft.hops.filter(
      (h) => !targets.some((t) => t.dr === h.dr && t.dc === h.dc)
    );

    if (hopBrush !== 'erase' && existing?.mode !== hopBrush) {
      for (const t of targets) {
        filtered.push({ dr: t.dr, dc: t.dc, mode: hopBrush });
      }
    }
    setDraft({ ...draft, hops: filtered });
  }

  function cycleSlide(dir: Direction8) {
    const current = draft.slides[dir] ?? 0;
    const steps = [0, 16, 4, 2, 1];
    const next = steps[(steps.indexOf(current) + 1) % steps.length] ?? 16;
    const nextSlides: SlideRanges = { ...draft.slides };
    if (next === 0) delete nextSlides[dir];
    else nextSlides[dir] = next;
    setDraft({ ...draft, slides: nextSlides });
  }

  function applySlidePreset(preset: 'none' | 'rook' | 'bishop' | 'queen') {
    if (preset === 'none') setDraft({ ...draft, slides: {} });
    else if (preset === 'rook') setDraft({ ...draft, slides: { N: 16, E: 16, S: 16, W: 16 } });
    else if (preset === 'bishop') setDraft({ ...draft, slides: { NE: 16, SE: 16, SW: 16, NW: 16 } });
    else setDraft({ ...draft, slides: { N: 16, NE: 16, E: 16, SE: 16, S: 16, SW: 16, W: 16, NW: 16 } });
  }

  function applyHopPreset(preset: 'none' | 'knight' | 'pawn_ep' | 'archer') {
    if (preset === 'none') setDraft({ ...draft, hops: [] });
    else if (preset === 'knight') {
      setDraft({
        ...draft,
        hops: [
          { dr: -2, dc: -1, mode: 'both' }, { dr: -2, dc: 1, mode: 'both' },
          { dr: -1, dc: -2, mode: 'both' }, { dr: -1, dc: 2, mode: 'both' },
          { dr: 1, dc: -2, mode: 'both' }, { dr: 1, dc: 2, mode: 'both' },
          { dr: 2, dc: -1, mode: 'both' }, { dr: 2, dc: 1, mode: 'both' },
        ],
      });
    } else if (preset === 'pawn_ep') {
      setDraft({
        ...draft,
        hops: [
          { dr: -1, dc: 0, mode: 'move' },
          { dr: -2, dc: 0, mode: 'first_move' },
          { dr: -1, dc: -1, mode: 'capture' },
          { dr: -1, dc: 1, mode: 'capture' },
          { dr: -1, dc: -1, mode: 'en_passant' },
          { dr: -1, dc: 1, mode: 'en_passant' },
        ],
        rules: { ...draft.rules, enPassant: true, canPromote: true },
      });
    } else {
      setDraft({
        ...draft,
        hops: [
          { dr: -1, dc: 0, mode: 'move' }, { dr: 1, dc: 0, mode: 'move' },
          { dr: 0, dc: -1, mode: 'move' }, { dr: 0, dc: 1, mode: 'move' },
          { dr: -2, dc: 0, mode: 'ranged' }, { dr: -2, dc: -1, mode: 'ranged' },
          { dr: -2, dc: 1, mode: 'ranged' },
        ],
      });
    }
  }

  function ensureLayered(): CustomPieceAppearance {
    if (draft.customAppearance?.mode === 'layered') return draft.customAppearance;
    return {
      mode: 'layered',
      base: 'shield',
      bodyIcon: draft.icon,
      crest: 'crown',
      primaryColor: '#f8f1df',
      accentColor: '#f59e0b',
      glowColor: '#f59e0b',
    };
  }

  function ensurePixel(): CustomPieceAppearance {
    if (draft.customAppearance?.mode === 'pixel' && draft.customAppearance.pixels) {
      return draft.customAppearance;
    }
    return {
      mode: 'pixel',
      base: 'none',
      bodyIcon: draft.icon,
      crest: 'none',
      pixels: createEmptyPixels(),
    };
  }

  function switchAppearanceTab(next: 'preset' | 'layered' | 'pixel') {
    setAppearanceTab(next);
    if (next === 'preset') {
      setDraft({ ...draft, customAppearance: undefined });
    } else if (next === 'layered') {
      setDraft({ ...draft, customAppearance: ensureLayered() });
    } else {
      setDraft({ ...draft, customAppearance: ensurePixel() });
    }
  }

  function paintPixel(r: number, c: number) {
    const cur = ensurePixel();
    const grid = (cur.pixels ?? createEmptyPixels()).map((row) => [...row]);
    const val = grid[r][c] === pixelColor ? '' : pixelColor;
    grid[r][c] = val;
    if (pixelMirror) {
      grid[r][8 - c] = val;
    }
    setDraft({ ...draft, customAppearance: { ...cur, pixels: grid } });
  }

  function handleSave() {
    const clean: PieceDefinition = {
      ...draft,
      id: draft.isBuiltin ? `custom_${Date.now()}` : draft.id,
      name: draft.name.trim() || 'Custom Piece',
      shortCode: (draft.shortCode.trim() || draft.name.trim()[0] || 'C').slice(0, 2).toUpperCase(),
      isBuiltin: false,
    };
    onSavePiece(clean);
    setDraft(clean);
    setSavedNotice(`Saved "${clean.name}" — now ready in Board Forge & Promotion Pools!`);
    window.setTimeout(() => setSavedNotice(null), 3000);
  }

  function selectLibraryPiece(p: PieceDefinition) {
    setDraft({
      ...p,
      hops: [...p.hops],
      slides: { ...p.slides },
      rules: { ...p.rules },
      customAppearance: p.customAppearance
        ? {
            ...p.customAppearance,
            pixels: p.customAppearance.pixels?.map((row) => [...row]),
          }
        : undefined,
    });
    setAppearanceTab(p.customAppearance?.mode ?? 'preset');
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left: Piece Library */}
      <div className="lg:col-span-3 parchment-panel rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
              Piece Library
            </h3>
            <p className="text-[11px] text-stone-400">Pick a piece to edit or clone</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraft(createBlankPiece());
              setAppearanceTab('preset');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-stone-950 text-xs font-bold hover:bg-amber-500 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
        <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
          {pieces.map((p) => {
            const selected = draft.id === p.id;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between px-2.5 py-2 rounded-lg border transition ${
                  selected
                    ? 'bg-amber-500/20 border-amber-400/60'
                    : 'bg-[#19130e] border-amber-500/15 hover:border-amber-500/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectLibraryPiece(p)}
                  className="flex items-center gap-2.5 text-left flex-1 cursor-pointer"
                >
                  <span className="w-7 h-7 shrink-0">
                    <PieceIcon
                      icon={p.icon}
                      color="white"
                      rules={p.rules}
                      palette={piecePalette}
                      customAppearance={p.customAppearance}
                    />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-amber-100 truncate">
                      {p.name} {!p.isBuiltin && <span className="text-[10px] font-mono text-amber-400 ml-1">CUSTOM</span>}
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono">
                      {p.hops.length} hops · {Object.keys(p.slides).length} rays
                    </div>
                  </div>
                </button>
                {!p.isBuiltin && (
                  <button
                    type="button"
                    onClick={() => onDeletePiece(p.id)}
                    className="p-1 text-stone-500 hover:text-rose-400 cursor-pointer"
                    title="Delete custom piece"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Center: Movement Designer (7x7 Special Tile Grid + 8-Dir Compass) */}
      <div className="lg:col-span-5 space-y-5">
        <div className="parchment-panel rounded-2xl p-5 space-y-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Step 1 · Movement &amp; Special Action Tiles
              </div>
              <h3 className="font-display text-base font-bold text-amber-100">
                7×7 Relative Hop Grid
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Pick a tile brush below (including En Passant, 1st-Move Dash, Ranged Snipe, &amp; Ally Swap) and paint onto the grid.
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 text-xs text-amber-200 cursor-pointer bg-[#19130e] px-2.5 py-1 rounded-lg border border-amber-500/25">
              <input
                type="checkbox"
                checked={mirrorHops}
                onChange={(e) => setMirrorHops(e.target.checked)}
                className="accent-amber-500"
              />
              Mirror L/R
            </label>
          </div>

          {/* Movement Tile Brush Picker */}
          <div className="grid grid-cols-4 gap-1.5">
            {HOP_BRUSHES.map((b) => (
              <button
                key={b.mode}
                type="button"
                onClick={() => setHopBrush(b.mode)}
                className={`px-1.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                  hopBrush === b.mode
                    ? `${b.colorClass} ring-2 ring-amber-300/80`
                    : 'bg-[#19130e] border-amber-500/15 text-stone-300 hover:border-amber-500/40'
                }`}
              >
                <span>{b.symbol}</span>
                <span className="truncate">{b.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-stone-400">Quick Presets:</span>
            <div className="flex gap-1">
              {(
                [
                  ['knight', 'Knight'],
                  ['pawn_ep', 'Pawn + EP'],
                  ['archer', 'Archer'],
                  ['none', 'Clear'],
                ] as const
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyHopPreset(preset)}
                  className="px-2 py-0.5 rounded bg-[#1b1510] border border-amber-500/25 text-amber-200 hover:border-amber-400 cursor-pointer"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 7x7 Grid */}
          <div className="grid grid-cols-7 gap-1.5 max-w-[350px] mx-auto">
            {Array.from({ length: 7 }, (_, rIdx) => {
              const dr = rIdx - 3;
              return Array.from({ length: 7 }, (_, cIdx) => {
                const dc = cIdx - 3;
                const isCenter = dr === 0 && dc === 0;
                const hop = getHopAt(dr, dc);

                if (isCenter) {
                  return (
                    <div
                      key={`${dr},${dc}`}
                      className="aspect-square rounded-lg bg-amber-500/25 border-2 border-amber-400 flex items-center justify-center p-1"
                    >
                      <PieceIcon
                        icon={draft.icon}
                        color="white"
                        rules={draft.rules}
                        palette={piecePalette}
                        customAppearance={draft.customAppearance}
                      />
                    </div>
                  );
                }

                const brushMeta = hop ? HOP_BRUSHES.find((b) => b.mode === hop.mode) : null;
                const cellClass = brushMeta
                  ? brushMeta.colorClass
                  : 'bg-[#1a140f] border-amber-500/15 hover:border-amber-400/50 text-stone-500';

                return (
                  <button
                    key={`${dr},${dc}`}
                    type="button"
                    onClick={() => paintHop(dr, dc)}
                    className={`aspect-square rounded-lg border text-xs font-bold flex items-center justify-center transition cursor-pointer ${cellClass}`}
                    title={`Offset (${dr}, ${dc})${brushMeta ? ` — ${brushMeta.label}` : ''}`}
                  >
                    {brushMeta?.symbol ?? ''}
                  </button>
                );
              });
            })}
          </div>
        </div>

        {/* Step 2: 8-Direction Slide Compass */}
        <div className="parchment-panel rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Step 2 · Sliding Rays
              </div>
              <h3 className="font-display text-base font-bold text-amber-100">
                8-Direction Slide Compass
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Click any ray to cycle distance: Off → ∞ → 4 → 2 → 1.
              </p>
            </div>
            <div className="flex gap-1.5">
              {(['rook', 'bishop', 'queen', 'none'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applySlidePreset(preset)}
                  className="px-2 py-1 rounded bg-[#1b1510] border border-amber-500/25 text-[11px] capitalize text-amber-200 hover:border-amber-400 cursor-pointer"
                >
                  {preset === 'none' ? 'Clear' : preset}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 max-w-[230px] mx-auto">
            {SLIDE_GRID.map((dir) => {
              if (dir === 'CENTER') {
                return (
                  <div
                    key="center"
                    className="aspect-square rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center p-2"
                  >
                    <PieceIcon
                      icon={draft.icon}
                      color="white"
                      rules={draft.rules}
                      palette={piecePalette}
                      customAppearance={draft.customAppearance}
                    />
                  </div>
                );
              }
              const dist = draft.slides[dir] ?? 0;
              return (
                <button
                  key={dir}
                  type="button"
                  onClick={() => cycleSlide(dir)}
                  className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition cursor-pointer ${
                    dist > 0
                      ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                      : 'bg-[#1a140f] border-amber-500/15 text-stone-500 hover:border-amber-500/40'
                  }`}
                >
                  <span className="text-xs font-bold">{dir}</span>
                  <span className="text-[11px] font-mono">
                    {dist === 0 ? '—' : dist >= 16 ? '∞' : `${dist} sq`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Live Preview + Piece Appearance Creator + Identity & Rules */}
      <div className="lg:col-span-4 space-y-4">
        {/* Live Preview (White & Black) + Graph Valuation */}
        <div className="parchment-panel rounded-2xl p-4 flex items-center justify-between border-amber-400/40">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-xl bg-[#e8d5b5] border border-amber-500/40 p-1">
              <PieceIcon
                icon={draft.icon}
                color="white"
                rules={draft.rules}
                palette={piecePalette}
                customAppearance={draft.customAppearance}
              />
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#9e7248] border border-amber-500/40 p-1">
              <PieceIcon
                icon={draft.icon}
                color="black"
                rules={draft.rules}
                palette={piecePalette}
                customAppearance={draft.customAppearance}
              />
            </div>
            <div>
              <div className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Graph Value
              </div>
              <div className="text-lg font-mono font-bold text-amber-100">
                {draft.rules.royal ? 'ROYAL' : `${liveEstimate.points} pts`}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-stone-400">Avg Reach</div>
            <div className="font-mono text-sm font-bold text-sky-300">
              {liveEstimate.avgMobility} sq
            </div>
          </div>
        </div>

        {/* Piece Appearance Creator */}
        <div className="parchment-panel rounded-2xl overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Paintbrush className="w-3.5 h-3.5" /> Piece Appearance Creator
            </div>
          </div>
          <div className="grid grid-cols-3 border-y border-amber-500/20 bg-[#17120d]">
            {(
              [
                ['preset', 'Preset Icon'],
                ['layered', 'Layered Forge'],
                ['pixel', 'Pixel Painter'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => switchAppearanceTab(id)}
                className={`py-2 text-[11px] font-semibold cursor-pointer ${
                  appearanceTab === id
                    ? 'bg-amber-500/20 text-amber-200 border-b-2 border-amber-400'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">
            {appearanceTab === 'preset' && (
              <div className="grid grid-cols-5 gap-1.5">
                {PIECE_ICON_LIST.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, icon: item.id as PieceIconId })}
                    className={`aspect-square rounded-lg p-1.5 border transition cursor-pointer ${
                      draft.icon === item.id
                        ? 'bg-amber-500/25 border-amber-400'
                        : 'bg-[#17120e] border-amber-500/15 hover:border-amber-500/40'
                    }`}
                    title={item.label}
                  >
                    <PieceIcon icon={item.id} color="white" palette={piecePalette} />
                  </button>
                ))}
              </div>
            )}

            {appearanceTab === 'layered' && (() => {
              const app = ensureLayered();
              const updateLayered = (patch: Partial<CustomPieceAppearance>) =>
                setDraft({ ...draft, customAppearance: { ...app, ...patch } });
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="layer-base" className="text-[10px] uppercase text-stone-400">
                        Base / Frame
                      </label>
                      <select
                        id="layer-base"
                        value={app.base}
                        onChange={(e) => updateLayered({ base: e.target.value as PieceBaseStyle })}
                        className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-2 py-1.5 text-xs text-amber-50"
                      >
                        <option value="none">None</option>
                        <option value="classic">Classic Shadow</option>
                        <option value="pedestal">Stone Pedestal</option>
                        <option value="shield">Heraldic Shield</option>
                        <option value="rings">Arcane Ring</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="layer-crest" className="text-[10px] uppercase text-stone-400">
                        Top Crest
                      </label>
                      <select
                        id="layer-crest"
                        value={app.crest}
                        onChange={(e) => updateLayered({ crest: e.target.value as PieceCrestStyle })}
                        className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-2 py-1.5 text-xs text-amber-50"
                      >
                        <option value="none">None</option>
                        <option value="crown">Mini Crown</option>
                        <option value="halo">Radiant Halo</option>
                        <option value="horns">Dragon Horns</option>
                        <option value="flame">Flame Crest</option>
                        <option value="star">Star Emblem</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="layer-body" className="text-[10px] uppercase text-stone-400">
                      Core Emblem
                    </label>
                    <select
                      id="layer-body"
                      value={app.bodyIcon}
                      onChange={(e) => updateLayered({ bodyIcon: e.target.value as PieceIconId })}
                      className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-2 py-1.5 text-xs text-amber-50"
                    >
                      {PIECE_ICON_LIST.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[10px] uppercase text-stone-400 flex flex-col gap-1">
                      Primary
                      <input
                        type="color"
                        value={app.primaryColor ?? '#f8f1df'}
                        onChange={(e) => updateLayered({ primaryColor: e.target.value })}
                        className="w-full h-8 rounded bg-transparent cursor-pointer"
                      />
                    </label>
                    <label className="text-[10px] uppercase text-stone-400 flex flex-col gap-1">
                      Accent
                      <input
                        type="color"
                        value={app.accentColor ?? '#f59e0b'}
                        onChange={(e) => updateLayered({ accentColor: e.target.value })}
                        className="w-full h-8 rounded bg-transparent cursor-pointer"
                      />
                    </label>
                    <label className="text-[10px] uppercase text-stone-400 flex flex-col gap-1">
                      Aura Glow
                      <input
                        type="color"
                        value={app.glowColor ?? '#f59e0b'}
                        onChange={(e) => updateLayered({ glowColor: e.target.value })}
                        className="w-full h-8 rounded bg-transparent cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              );
            })()}

            {appearanceTab === 'pixel' && (() => {
              const app = ensurePixel();
              const grid = app.pixels ?? createEmptyPixels();
              return (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {PIXEL_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setPixelColor(hex)}
                          style={{ backgroundColor: hex }}
                          className={`w-5 h-5 rounded border cursor-pointer ${
                            pixelColor === hex ? 'border-white scale-110' : 'border-black/40'
                          }`}
                          title={hex}
                        />
                      ))}
                      <input
                        type="color"
                        value={pixelColor}
                        onChange={(e) => setPixelColor(e.target.value)}
                        className="w-6 h-5 rounded bg-transparent cursor-pointer"
                        title="Custom pixel color"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          customAppearance: { ...app, pixels: createEmptyPixels() },
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-rose-300 cursor-pointer"
                    >
                      <Eraser className="w-3 h-3" /> Clear
                    </button>
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-[11px] text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pixelMirror}
                      onChange={(e) => setPixelMirror(e.target.checked)}
                      className="accent-amber-500"
                    />
                    Mirror Left/Right while drawing
                  </label>

                  <div className="grid grid-cols-9 gap-0.5 max-w-[230px] mx-auto bg-[#120e0a] p-1.5 rounded-lg border border-amber-500/20">
                    {grid.map((row, r) =>
                      row.map((hex, c) => (
                        <button
                          key={`${r}-${c}`}
                          type="button"
                          onClick={() => paintPixel(r, c)}
                          style={{ backgroundColor: hex || '#1e1812' }}
                          className="aspect-square rounded-[2px] border border-white/5 hover:border-amber-300 cursor-pointer"
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Identity & Special Rules */}
        <div className="parchment-panel rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label htmlFor="piece-name" className="text-[11px] uppercase tracking-wider text-stone-400">
                Name
              </label>
              <input
                id="piece-name"
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-3 py-1.5 text-sm text-amber-50"
              />
            </div>
            <div>
              <label htmlFor="piece-code" className="text-[11px] uppercase tracking-wider text-stone-400">
                Code
              </label>
              <input
                id="piece-code"
                type="text"
                maxLength={2}
                value={draft.shortCode}
                onChange={(e) => setDraft({ ...draft, shortCode: e.target.value.toUpperCase() })}
                className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-3 py-1.5 text-sm font-mono text-amber-50"
              />
            </div>
          </div>

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {(
              [
                ['royal', 'Royal (Checkable)', 'Must be defended from checkmate.'],
                ['castleKing', 'Castling King', 'Can castle with an unmoved Castling Rook.'],
                ['castleRook', 'Castling Rook', 'Can partner with a Castling King.'],
                ['iron', 'Iron Armor', 'Uncapturable except by a Blacksmith.'],
                ['blacksmith', 'Blacksmith', 'Can shatter and capture Iron pieces.'],
                ['rangedAttack', 'Ranged Attack', 'All captures hit from afar without moving.'],
                ['explosive', 'Explosive Blast', 'Captures destroy adjacent non-Royal pieces in 3×3.'],
                ['phasing', 'Phasing Slider', 'Sliding rays pass through friendly pieces.'],
                ['pawnDoubleStep', 'First Double-Step', 'May step 2 squares forward on first move.'],
                ['enPassant', 'En Passant', 'Can perform and be captured by En Passant.'],
                ['canPromote', 'Can Promote', 'Promotes when reaching a Promotion tile (Pawns only by default).'],
              ] as const
            ).map(([key, label, hint]) => (
              <label
                key={key}
                className="flex items-start gap-2 p-1.5 rounded-lg bg-[#19130e] border border-amber-500/15 hover:border-amber-500/35 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={Boolean(draft.rules[key])}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rules: { ...draft.rules, [key]: e.target.checked },
                    })
                  }
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <div className="text-xs font-semibold text-amber-100">{label}</div>
                  <div className="text-[10px] text-stone-400">{hint}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 hover:from-amber-400 hover:to-amber-500 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {draft.isBuiltin ? 'Save as Custom Copy' : 'Save Piece'}
            </button>
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  id: `custom_${Date.now()}`,
                  name: `${draft.name} II`,
                  isBuiltin: false,
                })
              }
              className="px-3 py-2.5 rounded-xl bg-[#1c1610] border border-amber-500/25 text-amber-200 text-xs hover:border-amber-400 cursor-pointer"
              title="Duplicate as new custom piece"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {savedNotice && (
            <div className="text-xs text-emerald-300 font-medium flex items-center gap-1.5">
              <Hammer className="w-3.5 h-3.5 shrink-0" /> {savedNotice}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
