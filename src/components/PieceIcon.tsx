import React from 'react';
import {
  Color,
  CustomPieceAppearance,
  PieceIconId,
  PiecePalette,
  PieceRules,
} from '../engine/types';

interface PieceIconProps {
  icon: PieceIconId;
  color: Color;
  rules?: PieceRules;
  palette?: PiecePalette;
  customAppearance?: CustomPieceAppearance;
  className?: string;
}

const PALETTES: Record<
  PiecePalette,
  {
    white: { fill: string; stroke: string; accent: string };
    black: { fill: string; stroke: string; accent: string };
  }
> = {
  ivory: {
    white: { fill: '#f8f1df', stroke: '#3a2a19', accent: '#d49a35' },
    black: { fill: '#262120', stroke: '#e6c580', accent: '#b8862e' },
  },
  royal_gold: {
    white: { fill: '#fff7d6', stroke: '#713f12', accent: '#f59e0b' },
    black: { fill: '#1e1b2e', stroke: '#c084fc', accent: '#a855f7' },
  },
  jade_ruby: {
    white: { fill: '#d1fae5', stroke: '#064e3b', accent: '#10b981' },
    black: { fill: '#4c0519', stroke: '#fda4af', accent: '#f43f5e' },
  },
  blueprint: {
    white: { fill: '#e0f2fe', stroke: '#0c4a6e', accent: '#38bdf8' },
    black: { fill: '#0f172a', stroke: '#93c5fd', accent: '#60a5fa' },
  },
};

export const PIECE_ICON_LIST: { id: PieceIconId; label: string }[] = [
  { id: 'king', label: 'King' },
  { id: 'queen', label: 'Queen' },
  { id: 'rook', label: 'Rook' },
  { id: 'bishop', label: 'Bishop' },
  { id: 'knight', label: 'Knight' },
  { id: 'pawn', label: 'Pawn' },
  { id: 'archer', label: 'Archer' },
  { id: 'golem', label: 'Golem' },
  { id: 'blacksmith', label: 'Blacksmith' },
  { id: 'dragon', label: 'Dragon' },
  { id: 'wizard', label: 'Wizard' },
  { id: 'gryphon', label: 'Gryphon' },
  { id: 'spear', label: 'Spearman' },
  { id: 'shield', label: 'Shield' },
  { id: 'crown', label: 'Crown' },
  { id: 'hammer', label: 'Hammer' },
  { id: 'tower', label: 'Tower' },
  { id: 'cannon', label: 'Cannon' },
  { id: 'ghost', label: 'Phantom' },
  { id: 'star', label: 'Star' },
];

export const PieceIcon: React.FC<PieceIconProps> = ({
  icon,
  color,
  rules,
  palette = 'ivory',
  customAppearance,
  className = 'w-full h-full',
}) => {
  const isWhite = color === 'white';
  const scheme = (PALETTES[palette] ?? PALETTES.ivory)[color];
  const fill =
    customAppearance?.mode === 'layered' && customAppearance.primaryColor && isWhite
      ? customAppearance.primaryColor
      : scheme.fill;
  const stroke =
    customAppearance?.mode === 'layered' && customAppearance.primaryColor && !isWhite
      ? customAppearance.primaryColor
      : scheme.stroke;
  const accent =
    customAppearance?.mode === 'layered' && customAppearance.accentColor
      ? customAppearance.accentColor
      : scheme.accent;
  const activeIcon =
    customAppearance?.mode === 'layered' ? customAppearance.bodyIcon : icon;

  if (customAppearance?.mode === 'pixel' && customAppearance.pixels) {
    const px = customAppearance.pixels;
    return (
      <svg viewBox="0 0 44 44" className={className} aria-hidden="true">
        {/* Team badge backing so White vs Black is always crystal clear */}
        <rect
          x="3"
          y="3"
          width="38"
          height="38"
          rx="8"
          fill={isWhite ? '#f8f1df' : '#1e1a18'}
          stroke={isWhite ? '#3a2a19' : '#e6c580'}
          strokeWidth="2.4"
        />
        {px.map((row, r) =>
          row.map((hex, c) =>
            hex ? (
              <rect
                key={`${r}-${c}`}
                x={6.5 + c * 3.45}
                y={6.5 + r * 3.45}
                width="3.6"
                height="3.6"
                rx="0.5"
                fill={hex}
              />
            ) : null
          )
        )}
      </svg>
    );
  }

  const renderShape = () => {
    switch (activeIcon) {
      case 'king':
        return (
          <>
            <path d="M22 6v7M18.5 9.5h7" stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M13 33h18l2-13-6 4-5-8-5 8-6-4 2 13z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <rect x="11" y="34" width="22" height="4.5" rx="1.8" fill={fill} stroke={stroke} strokeWidth="2" />
          </>
        );
      case 'queen':
        return (
          <>
            <circle cx="9" cy="14" r="2.2" fill={accent} stroke={stroke} strokeWidth="1.4" />
            <circle cx="15.5" cy="10" r="2.2" fill={accent} stroke={stroke} strokeWidth="1.4" />
            <circle cx="22" cy="8.5" r="2.4" fill={accent} stroke={stroke} strokeWidth="1.4" />
            <circle cx="28.5" cy="10" r="2.2" fill={accent} stroke={stroke} strokeWidth="1.4" />
            <circle cx="35" cy="14" r="2.2" fill={accent} stroke={stroke} strokeWidth="1.4" />
            <path d="M12 33h20l3-17-6.5 6-6.5-11-6.5 11L9 16l3 17z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <rect x="10.5" y="34" width="23" height="4.5" rx="1.8" fill={fill} stroke={stroke} strokeWidth="2" />
          </>
        );
      case 'rook':
        return (
          <>
            <path d="M12 10h4v4h4v-4h4v4h4v-4h4v8l-3 2v13H15V20l-3-2v-8z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <rect x="11" y="34" width="22" height="4.5" rx="1.5" fill={fill} stroke={stroke} strokeWidth="2" />
          </>
        );
      case 'bishop':
        return (
          <>
            <circle cx="22" cy="8.5" r="2.6" fill={accent} stroke={stroke} strokeWidth="1.8" />
            <path d="M22 12c-6 4-8.5 10-6.5 16h13c2-6-.5-12-6.5-16z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <path d="M18.5 19.5l7-4" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M14 29h16l1.5 4.5h-19L14 29z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <rect x="11" y="34.5" width="22" height="4" rx="1.5" fill={fill} stroke={stroke} strokeWidth="2" />
          </>
        );
      case 'knight':
        return (
          <>
            <path
              d="M15 34c.5-7 4-10 4-13-2.5 1-5 1.5-7 .5-1.5-.8-1.5-3 0-4.5l4-4 1-4.5 3.5 2.5c5.5-1 10.5 2.5 11.5 9 .8 5-1 10-3 14H15z"
              fill={fill}
              stroke={stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="19" cy="15.5" r="1.4" fill={accent} />
            <rect x="11" y="34.5" width="22" height="4" rx="1.5" fill={fill} stroke={stroke} strokeWidth="2" />
          </>
        );
      case 'pawn':
        return (
          <>
            <circle cx="22" cy="14" r="5.5" fill={fill} stroke={stroke} strokeWidth="2" />
            <path d="M17 21h10l3.5 12.5h-17L17 21z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <rect x="11.5" y="34" width="21" height="4.5" rx="1.8" fill={fill} stroke={stroke} strokeWidth="2" />
          </>
        );
      case 'archer':
        return (
          <>
            <path d="M14 9c10 4 10 22 0 26" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
            <path d="M14 9v26" stroke={accent} strokeWidth="1.6" strokeDasharray="2 2" />
            <path d="M11 22h22M28 16l6 6-6 6" fill="none" stroke={fill} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 22h22M28 16l6 6-6 6" fill="none" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      case 'golem':
        return (
          <>
            <path d="M14 11h16l4 7-3 15H13l-3-15 4-7z" fill={isWhite ? '#cbd5e1' : '#334155'} stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
            <rect x="16" y="16" width="4" height="3" rx="0.8" fill={accent} />
            <rect x="24" y="16" width="4" height="3" rx="0.8" fill={accent} />
            <path d="M16 25h12M19 25v7M25 25v7" stroke={stroke} strokeWidth="2" />
            <rect x="11" y="34" width="22" height="4.5" rx="1.4" fill={isWhite ? '#94a3b8' : '#1e293b'} stroke={stroke} strokeWidth="2" />
          </>
        );
      case 'blacksmith':
        return (
          <>
            <path d="M11 12h16v8H11z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <path d="M27 14h6l-2 4h-4" fill={accent} stroke={stroke} strokeWidth="1.8" />
            <path d="M18 20v14" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
            <path d="M18 20v14" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M10 34h24l-3 4.5H13L10 34z" fill={fill} stroke={stroke} strokeWidth="2" />
          </>
        );
      case 'dragon':
        return (
          <>
            <path
              d="M9 17c4-6 10-8 16-6l5-4-1 7c4 2 6 6 5 11-4-3-7-3-10-1l4 10H15l3-10c-4 1-7 0-9-7z"
              fill={fill}
              stroke={stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="24" cy="14.5" r="1.5" fill={accent} />
            <rect x="11" y="34.5" width="22" height="4" rx="1.5" fill={fill} stroke={stroke} strokeWidth="2" />
          </>
        );
      case 'wizard':
        return (
          <>
            <path d="M22 6l9 22H13L22 6z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <ellipse cx="22" cy="29" rx="13" ry="3.5" fill={fill} stroke={stroke} strokeWidth="2" />
            <path d="M22 14l1.2 2.8 3 .3-2.3 2 .7 3-2.6-1.6-2.6 1.6.7-3-2.3-2 3-.3L22 14z" fill={accent} />
          </>
        );
      case 'gryphon':
        return (
          <>
            <path d="M8 14l9 4 5-9 5 9 9-4-5 12-9 8-9-8-5-12z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <path d="M22 15v12" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
            <rect x="12" y="34.5" width="20" height="4" rx="1.5" fill={fill} stroke={stroke} strokeWidth="2" />
          </>
        );
      case 'spear':
        return (
          <>
            <path d="M22 6l6 10h-4v18h-4V16h-4l6-10z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <path d="M13 34.5h18" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
          </>
        );
      case 'shield':
        return (
          <path d="M22 7l12 4v10c0 8-5.5 13-12 16-6.5-3-12-8-12-16V11l12-4z" fill={fill} stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
        );
      case 'crown':
        return (
          <path d="M8 31l3-17 6 7 5-11 5 11 6-7 3 17H8z" fill={fill} stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
        );
      case 'hammer':
        return (
          <>
            <rect x="10" y="9" width="24" height="10" rx="2" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="19.5" y="19" width="5" height="18" rx="1.5" fill={accent} stroke={stroke} strokeWidth="1.8" />
          </>
        );
      case 'tower':
        return (
          <path d="M14 8h16v6l-2 2v18h4v4H12v-4h4V16l-2-2V8z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
        );
      case 'cannon':
        return (
          <>
            <path d="M12 22l18-10 4 7-18 10z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <circle cx="18" cy="30" r="6" fill={accent} stroke={stroke} strokeWidth="2" />
          </>
        );
      case 'ghost':
        return (
          <>
            <path d="M12 35V20a10 10 0 0 1 20 0v15l-4-3-3 3-3-3-3 3-3-3-4 3z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <circle cx="18.5" cy="19" r="1.8" fill={accent} />
            <circle cx="25.5" cy="19" r="1.8" fill={accent} />
          </>
        );
      case 'star':
      default:
        return (
          <path
            d="M22 6l4.6 10.2 11.1 1.2-8.2 7.5 2.2 11L22 30.2 12.3 35.9l2.2-11-8.2-7.5 11.1-1.2L22 6z"
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        );
    }
  };

  const renderLayeredBase = () => {
    if (customAppearance?.mode !== 'layered') return null;
    switch (customAppearance.base) {
      case 'pedestal':
        return (
          <path d="M8 36h28l-3 5H11l-3-5z" fill={accent} stroke={stroke} strokeWidth="1.6" />
        );
      case 'shield':
        return (
          <path
            d="M22 4l15 5v11c0 9-6.5 15-15 19C13.5 35 7 29 7 20V9l15-5z"
            fill={isWhite ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.35)'}
            stroke={accent}
            strokeWidth="1.8"
          />
        );
      case 'rings':
        return (
          <circle
            cx="22"
            cy="22"
            r="19"
            fill="none"
            stroke={accent}
            strokeWidth="2"
            opacity="0.8"
          />
        );
      case 'classic':
        return (
          <ellipse cx="22" cy="38.5" rx="13" ry="2.6" fill={accent} opacity="0.65" />
        );
      default:
        return null;
    }
  };

  const renderLayeredCrest = () => {
    if (customAppearance?.mode !== 'layered') return null;
    switch (customAppearance.crest) {
      case 'halo':
        return (
          <ellipse cx="22" cy="5.5" rx="8.5" ry="2.2" fill="none" stroke={accent} strokeWidth="2" />
        );
      case 'crown':
        return (
          <path d="M15 9l2-5 5 3 5-3 2 5H15z" fill={accent} stroke={stroke} strokeWidth="1.2" />
        );
      case 'horns':
        return (
          <>
            <path d="M13 11c-3-4-2-7 1-8-1 3 0 5 2 7" fill={accent} stroke={stroke} strokeWidth="1.2" />
            <path d="M31 11c3-4 2-7-1-8 1 3 0 5-2 7" fill={accent} stroke={stroke} strokeWidth="1.2" />
          </>
        );
      case 'flame':
        return (
          <path d="M22 2c3 3 5 5.5 3.5 8.5-1 1.5-6 1.5-7 0C17 7.5 19 5 22 2z" fill={accent} stroke={stroke} strokeWidth="1.2" />
        );
      case 'star':
        return (
          <path d="M22 2l1.4 3.2 3.4.3-2.6 2.2.8 3.3-3-1.8-3 1.8.8-3.3-2.6-2.2 3.4-.3L22 2z" fill={accent} />
        );
      default:
        return null;
    }
  };

  return (
    <svg viewBox="0 0 44 44" className={className} aria-hidden="true">
      {customAppearance?.mode === 'layered' && customAppearance.glowColor && (
        <circle cx="22" cy="22" r="19" fill={customAppearance.glowColor} opacity="0.22" />
      )}
      {rules?.iron && (
        <circle
          cx="22"
          cy="22"
          r="20"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2.2"
          strokeDasharray="4 2"
          opacity="0.85"
        />
      )}
      {renderLayeredBase()}
      {renderShape()}
      {renderLayeredCrest()}
    </svg>
  );
};
