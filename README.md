# ChessForge

**A clean-room custom chess variant sandbox, Piece & Board Forge, Graph-Theory Adaptive AI, and multi-island Adventure campaign** — built using the [Craft Anything](https://github.com/storytold/craft-anything) clean-room **Study → Build → Check → Ready** methodology, inspired by [ChessCraft](https://store.steampowered.com/app/1635790/ChessCraft/).

## Features

- **Adventure Campaign (4 Islands, 12 Stages)**: Progress across *Academy Isle*, *Iron Citadel*, *Portal Archipelago*, and *Grandmaster Spire*, unlocking variants, earning XP & Gems, and mastering new mechanics step by step.
- **Graph-Theory Adaptive AI**: Converts any custom board topology (chasm voids, sanctuaries, portals, promotion zones) and any custom piece ruleset into directed movement graphs $G=(V,E)$ to dynamically compute:
  - **Piece point values** from average graph out-degree, leaping capability, and special modifiers.
  - **Dynamic Piece-Square Tables (PSTs)** using tile centrality, BFS shortest-path distance to promotion zones, and Sanctuary/Portal bonuses.
  - **Alpha-Beta Minimax Search** across 3 difficulty tiers (*Novice*, *Tactician*, *Grandmaster*), plus a live **AI Heatmap Overlay** so you can inspect the AI's graph evaluation right on the board.
- **Piece Forge**: Design custom chess pieces with:
  - A **7×7 Relative Hop Grid** (Move+Capture, Move Only, or Capture Only — leaps over pieces and chasms).
  - An **8-Direction Sliding Ray Compass** (configurable step range from 1 to Unlimited).
  - Special Piece Rules: **Royal (Checkable)**, **Iron Armor** (uncapturable except by Blacksmith), **Blacksmith** (shatters Iron), **Ranged Attack** (captures without moving), and **First Double-Step**.
  - 20 handcrafted SVG emblems and a live Graph-Theory point estimator.
- **Board Forge (4×4 to 16×16)**: Sculpt irregular boards with Void chasms, **Sanctuary** safe tiles, linked **Portal A/B/C** teleporters, **Promotion Zones**, **Fallow** crumbling tiles, 5 board themes, symmetry painting, instant **Test vs AI**, and **Share/Import Codes**.

## Getting Started

```bash
npm install
npm run dev
```

## Testing & Build

```bash
npm test
npm run build
```

## Tech Stack

- **React 19** + **TypeScript** + **Vite** + **Tailwind CSS v4**
- **Vitest** for unit testing the variant chess rules and Graph-Theory AI
- **Web Audio API** for zero-dependency synthesized wooden board & fantasy sound effects
