---
name: Tutorial lifecycle
description: Avoid replaying scripted tutorial actions when the React bridge changes.
---

Tutorial chapter entry must be idempotent, independently of game-bridge registration. Completion events can fire before React commits the move that caused them.

**Why:** Re-registering the bridge used to replay chapter effects. Inspecting the turn immediately after a completion event could also use the previous turn and leave the shop assigned to the wrong player.

**How to apply:** Observe the committed game state before scheduling a scripted reply, prevent duplicate replies, and use a valid position-specific reply for each chapter. Verify tutorials with real clicks through completion, not only static checks.