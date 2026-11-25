# Clean-Room Specification: ChessForge

Inspired by the public gameplay concepts of ChessCraft (Steam App 1635790), rebuilt from scratch using the Craft Anything clean-room Study -> Build -> Check -> Ready workflow.

## Core Pillars
1. **Custom Piece Forge**
   - 7x7 relative hop grid (move-only, capture-only, or move+capture).
   - 8-direction sliding rays with configurable max range (1..15 or unlimited).
   - Special piece modifiers: Royal (checkable), Iron (uncapturable except by Blacksmith), Blacksmith (captures Iron), Ranged Attack (captures without moving).
   - Real-time graph-based point value estimation.
   - Custom SVG iconography & local persistence.

2. **Custom Board Forge (up to 16x16)**
   - Resizable grid (4x4 to 16x16) with toggleable Void/Disabled tiles.
   - Tile rules: Sanctuary (safe from capture), Linked Portals (A/B/C teleporters), Promotion Zones (White/Black/Both), Fallow Tiles (limited visits before collapsing to Void).
   - Symmetry painting helpers, piece placement, instant Test Play, and JSON/code sharing.

3. **Graph-Aware Adaptive AI**
   - Converts any arbitrary board topology and custom piece ruleset into directed movement graphs.
   - Dynamically computes piece material values from graph out-degree, leap capability, and special modifiers.
   - Dynamically generates Piece-Square Tables (PSTs) using tile centrality, BFS distance to promotion zones, and sanctuary/portal bonuses.
   - Alpha-beta minimax with move ordering, quiescence search, and configurable difficulty levels.
   - Live AI Heatmap Overlay so players can inspect the graph evaluation visually.

4. **Adventure Campaign**
   - Multi-island overworld map with 12 progressive handcrafted chess variants introducing custom pieces, irregular boards, sanctuaries, portals, iron pieces, archers, and crumbling fallow tiles.
   - Persistent progression (stars, XP, gems, unlocked boards) saved in localStorage.
