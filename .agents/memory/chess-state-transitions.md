---
name: Chess transition invariants
description: Rules for augment turn costs and interpreting board changes for visual effects.
---

Turn-spending augment actions must use the same king-safety and half/full-round accounting as ordinary chess moves, including team turn slots. Resurrection spends a turn.

**Why:** Merely switching the active color allowed resurrection to bypass check and leave timed effects and round-based income behind.

**How to apply:** When adding or changing a spell, test its turn cost, check legality, timed effects, and team-slot restrictions together. Keep bot previews and execution consistent.

Board-effect classification must compare piece identities, not just occupied squares.

**Why:** Occupancy-only comparisons mislabeled normal moves as resurrection/removal and normal captures as color conversion. Board expansion also changes coordinates without changing piece identity.

**How to apply:** Separate movement/capture effects from actual spawning, conversion, and removal. Clear transient effects on timers even with reduced motion enabled.