import React, { useMemo, useState } from 'react';
import { Copy, Hammer, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import {
  Direction8,
  HopMode,
  HopOffset,
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
    rules: { canPromote: true },
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
  const [mirrorHops, setMirrorHops] = useState(true);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const liveEstimate = useMemo(() => estimatePieceValueOnStandardBoard(draft), [draft]);

  function getHopAt(dr: number, dc: number): HopOffset | undefined {
    return draft.hops.find((h) => h.dr === dr && h.dc === dc);
  }

  function cycleHop(dr: number, dc: number) {
    if (dr === 0 && dc === 0) return;
    const existing = getHopAt(dr, dc);
    const nextOrder: (HopMode | null)[] = ['both', 'move', 'capture', null];
    const nextMode = !existing
      ? 'both'
      : nextOrder[(nextOrder.indexOf(existing.mode) + 1) % nextOrder.length];

    const targets: { dr: number; dc: number }[] = [{ dr, dc }];
    if (mirrorHops && dc !== 0) {
      targets.push({ dr, dc: -dc });
    }

    const filtered = draft.hops.filter(
      (h) => !targets.some((t) => t.dr === h.dr && t.dc === h.dc)
    );
    if (nextMode) {
      for (const t of targets) {
        filtered.push({ dr: t.dr, dc: t.dc, mode: nextMode });
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

  function applyHopPreset(preset: 'none' | 'knight' | 'camel' | 'king') {
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
    } else if (preset === 'camel') {
      setDraft({
        ...draft,
        hops: [
          { dr: -3, dc: -1, mode: 'both' }, { dr: -3, dc: 1, mode: 'both' },
          { dr: -1, dc: -3, mode: 'both' }, { dr: -1, dc: 3, mode: 'both' },
          { dr: 1, dc: -3, mode: 'both' }, { dr: 1, dc: 3, mode: 'both' },
          { dr: 3, dc: -1, mode: 'both' }, { dr: 3, dc: 1, mode: 'both' },
        ],
      });
    } else {
      setDraft({
        ...draft,
        hops: [
          { dr: -1, dc: -1, mode: 'both' }, { dr: -1, dc: 0, mode: 'both' }, { dr: -1, dc: 1, mode: 'both' },
          { dr: 0, dc: -1, mode: 'both' }, { dr: 0, dc: 1, mode: 'both' },
          { dr: 1, dc: -1, mode: 'both' }, { dr: 1, dc: 0, mode: 'both' }, { dr: 1, dc: 1, mode: 'both' },
        ],
      });
    }
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
    setSavedNotice(`Saved "${clean.name}" — now available in Board Forge and Promotion Pools!`);
    window.setTimeout(() => setSavedNotice(null), 3000);
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
            onClick={() => setDraft(createBlankPiece())}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-stone-950 text-xs font-bold hover:bg-amber-500 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
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
                  onClick={() =>
                    setDraft({
                      ...p,
                      hops: [...p.hops],
                      slides: { ...p.slides },
                      rules: { ...p.rules },
                    })
                  }
                  className="flex items-center gap-2.5 text-left flex-1 cursor-pointer"
                >
                  <span className="w-7 h-7 shrink-0">
                    <PieceIcon icon={p.icon} color="white" rules={p.rules} palette={piecePalette} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-amber-100 truncate">
                      {p.name} {!p.isBuiltin && <span className="text-amber-400">★</span>}
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

      {/* Center: Movement Designer */}
      <div className="lg:col-span-5 space-y-5">
        {/* Step 1: 7x7 Hop Grid */}
        <div className="parchment-panel rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Step 1 · Leaping Moves
              </div>
              <h3 className="font-display text-base font-bold text-amber-100">
                7×7 Relative Hop Grid
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Hops jump over obstacles. Click any square to cycle its mode.
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

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex gap-2">
              <span className="text-emerald-300">● Move+Capture</span>
              <span className="text-sky-300">○ Move Only</span>
              <span className="text-rose-300">× Capture Only</span>
            </div>
            <div className="flex gap-1">
              {(['knight', 'camel', 'king', 'none'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyHopPreset(preset)}
                  className="px-2 py-0.5 rounded bg-[#1b1510] border border-amber-500/25 capitalize text-amber-200 hover:border-amber-400 cursor-pointer"
                >
                  {preset === 'none' ? 'Clear' : preset}
                </button>
              ))}
            </div>
          </div>

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
                      <PieceIcon icon={draft.icon} color="white" rules={draft.rules} palette={piecePalette} />
                    </div>
                  );
                }

                let cellClass = 'bg-[#1a140f] border-amber-500/15 hover:border-amber-400/50 text-stone-500';
                let label = '';
                if (hop?.mode === 'both') {
                  cellClass = 'bg-emerald-600/35 border-emerald-400 text-emerald-100';
                  label = '●';
                } else if (hop?.mode === 'move') {
                  cellClass = 'bg-sky-600/35 border-sky-400 text-sky-100';
                  label = '○';
                } else if (hop?.mode === 'capture') {
                  cellClass = 'bg-rose-600/35 border-rose-400 text-rose-100';
                  label = '×';
                }

                return (
                  <button
                    key={`${dr},${dc}`}
                    type="button"
                    onClick={() => cycleHop(dr, dc)}
                    className={`aspect-square rounded-lg border text-sm font-bold flex items-center justify-center transition cursor-pointer ${cellClass}`}
                    title={`Offset (${dr}, ${dc})`}
                  >
                    {label}
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

          <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
            {SLIDE_GRID.map((dir) => {
              if (dir === 'CENTER') {
                return (
                  <div
                    key="center"
                    className="aspect-square rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center p-2"
                  >
                    <PieceIcon icon={draft.icon} color="white" rules={draft.rules} palette={piecePalette} />
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

      {/* Right: Step 3 Metadata, Special Rules, Emblem & Save */}
      <div className="lg:col-span-4 space-y-4">
        {/* Live Graph Valuation */}
        <div className="parchment-panel rounded-2xl p-4 flex items-center justify-between border-amber-400/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#18120d] border border-amber-500/30 p-1.5">
              <PieceIcon icon={draft.icon} color="white" rules={draft.rules} palette={piecePalette} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Graph AI Valuation
              </div>
              <div className="text-xl font-mono font-bold text-amber-100">
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

        {/* Identity & Special Rules */}
        <div className="parchment-panel rounded-2xl p-4 space-y-3.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
            Step 3 · Identity &amp; Special Abilities
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label htmlFor="piece-name" className="text-[11px] uppercase tracking-wider text-stone-400">
                Name
              </label>
              <input
                id="piece-name"
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-3 py-2 text-sm text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
                className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-3 py-2 text-sm font-mono text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="piece-desc" className="text-[11px] uppercase tracking-wider text-stone-400">
              Description
            </label>
            <textarea
              id="piece-desc"
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="w-full mt-1 rounded-lg bg-[#16110d] border border-amber-500/25 px-3 py-2 text-xs text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {(
              [
                ['royal', 'Royal (Checkable)', 'Must be defended from check and checkmate.'],
                ['castleKing', 'Castling King', 'Can castle with an unmoved Castling Rook.'],
                ['castleRook', 'Castling Rook', 'Can partner with a Castling King to castle.'],
                ['iron', 'Iron Armor', 'Cannot be captured except by a Blacksmith piece.'],
                ['blacksmith', 'Blacksmith', 'Can shatter and capture Iron pieces.'],
                ['rangedAttack', 'Ranged Attack', 'Captures enemies without moving onto their square.'],
                ['explosive', 'Explosive Blast', 'Captures destroy adjacent non-Royal pieces in a 3×3 burst!'],
                ['phasing', 'Phasing Slider', 'Sliding rays pass right through friendly pieces.'],
                ['pawnDoubleStep', 'First Double-Step', 'May step 2 squares forward on its first move.'],
                ['enPassant', 'En Passant', 'Can perform and be captured by En Passant.'],
              ] as const
            ).map(([key, label, hint]) => (
              <label
                key={key}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-[#19130e] border border-amber-500/15 hover:border-amber-500/35 cursor-pointer"
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
                  <div className="text-[11px] text-stone-400">{hint}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Icon Picker */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] uppercase tracking-wider text-stone-400">Piece Emblem</div>
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
          </div>

          <div className="flex gap-2 pt-2">
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
