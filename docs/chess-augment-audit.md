# Chess Augmented audit

Audited: current `AUGMENT_POOL`, its shop improvement levels, bonus-roll
prerequisites, and `ChessGame` activation paths. This is an implementation
inspection, not a complete interactive test suite or a balance redesign:
stated values and stack limits were retained.

## Executed regression coverage

Run `npx tsx scripts/test-chess-augment-audit.ts`.

Additional behavioral checks:
- `npx tsx scripts/test-chess-revival-status.ts`: post-spell check, escape
  from check, checkmate, history, and 2v2 elimination/turn-slot advancement.
- `npx tsx scripts/test-chess-bot.mts`: spell targets, revival previews,
  augment choices, and shop budgets.
- `npx tsx scripts/test-chess-effects.ts`: identity-aware visual transitions.
- `node scripts/test-chess-ui.mjs [chromium-path]`: full guided tutorial,
  guide search, Turkish language, and mobile layout in a real browser.

The executable check verifies pool identity/stack/config integrity, all
improvement and prerequisite references, the Necromancer upgrade chain,
Contract Killer's base and improved multipliers, guaranteed-upgrade offer
replacement, and static regression guards
for the following `ChessGame` integrations:

- received online snapshots restore Frost duration and do not clear received
  upgrade or Jew-loss state;
- both Contract Killer resolution paths remove the single-use augment;
- Necromancer+ stores and uses an explicit bishop/knight choice;
- forced bot spell targeting recognizes each Necromancer spell;
- board VFX is passed the flipped display orientation.

These checks deliberately complement rather than replace interactive move
tests. They are executable without starting the application.

## Inspection results (manual source review)

“Pass” below means the listed path was inspected as wired in source. It does
**not** claim that every timing combination, event outcome, or multiplayer
interaction has been behaviorally tested; those require dedicated integration
tests.

| Augment | Outcome |
| --- | --- |
| Miner | Pass: turn interval and improve interval are applied per stack. |
| Alternative | Pass: rook-file first-move three-square route is injected with path checks. |
| Mastermind | Pass: weight preset selection is active. |
| Instant Cash | Pass: grants through the common gold-credit path and cannot be bought through the handler. |
| Prize Money | Pass: first eligible capture is globally gated and doubles that half-move's gain. |
| Investment | Pass: base per-turn and improved per-full-round paths are distinct and stack-aware. |
| Efficient | Pass: capture bonus uses stack count and upgrade value. |
| Thief | Pass: end-of-turn chance uses stack count and upgrade rate. |
| Blind Rage | Pass: early-knight-capture gate, once-per-side flag, and bonus offer are wired. |
| Anticipation | Pass: only Stock Crash's negative event loss is prevented. |
| King of the Hill | Pass: center-square income and improved per-piece value are applied. |
| Jew | Pass: pawn-loss payout and escalating second improvement are tracked. Snapshot reset bug fixed. |
| Alternative+ | Pass: prerequisite is enforced and all first-move pawn routes are injected. |
| Mastermind+ | Pass: prerequisite and combined weights are enforced; the guaranteed-upgrade slot does not replace an identical roll. |
| Contract Killer | Pass after audit: target follows piece identity, resolves if either side removes it, and removes the one-use augment at resolution. |
| Evade | Pass: charge blocks the opponent's next spell turn and clears after that turn. |
| Sacrifice | Pass: removes an owned rook and opens a rare-or-better offer. |
| Tax Man | Pass: opponent's positive half-move gold delta is taxed with upgrade divisors. |
| Free Passage | Pass: owned flag is synchronized into engine castling legality. |
| Augmented | Pass: bonus offer count changes from three to four. |
| Necromancer | Fixed: revive validates king safety and active 2v2 slot files, then enters the normal move half/full-round lifecycle. |
| Frost | Pass: target and duration are charge-gated; snapshot now restores remaining duration. |
| What? | Pass: one-use sideways empty-square pawn move uses normal move execution. |
| Oops | Pass: two-half-move history restore is charge-gated. |
| Impassable | Pass: placement is ownership/permanent-removal gated and spends a turn. |
| Blessed Water | Pass: square protection prevents normal and Bloodbending captures; duration/upgrade apply. |
| İlkkan | Pass: identity tracking survives moves and clears on transformation/capture. |
| Swap | Pass: frozen/cold-wind pieces are excluded and final king safety is checked. |
| Horde | Pass: acquisition immediately advances each eligible pawn once. |
| Tall Politician | Pass: positive credits deposit tax and full-round vault growth/collection are wired. |
| Pawn Shop | Pass: original-rank placement, pricing, improvement, and buy count are enforced. |
| Mastermind++ | Pass: prerequisite and all combined weight presets are enforced. |
| I Am the Danger | Pass: check detection awards stacks and improvement amount. |
| Double Gold | Pass: positive augment credits route through the double-gold helper for active rounds. |
| Necromancer+ | Fixed: user explicitly chooses bishop or knight when both are lost; revival validates king safety/slot files and consumes the chosen loss and charge through the normal lifecycle. |
| Bloodbending | Pass: only advanced enemy pawns are flippable; action spends a turn. |
| Bloodlust | Pass: capture thresholds, improved cadence, and extra-pick upgrade are wired. |
| Internal Combustion | Pass: first checking enemy piece is removed once without capture rewards. |
| Royal Education | Pass: knight king destinations are safety checked; extra charge improvement is applied. |
| Death Note | Pass: piece-id timer, target exclusions, improve timers, and no-reward removal path are wired. |
| Puppet | Pass: marks an eligible enemy and forces that piece when it has a legal move. |
| Şako Bosphorus | Pass: empty-square teleport is safety checked and consumes its one use/turn. |
| Emperor of the Hill | Pass: grants/improves King of the Hill and tracks pawn promotion on center squares. |
| Plot Armour | Pass: acquisition starts the engine-visible full-round immunity timer. |
| Royal Household | Pass: check-only rampage validates destinations, clears its path, and consumes use/turn. |
| Domain Expansion | Pass: one use per side, board-size cap, and coordinate migration are wired. |
| Little Big Man | Pass: selected pawn identity and four-full-round expiry are tracked. |
| Bloodbending+ | Pass: target class and blessing exclusions are enforced. |
| Necromancer++ | Fixed: queen revival validates king safety/slot files and enters the normal lifecycle before its charge is spent. |

## Bot integration note

Forced bot targeting recognizes `necromancer`, `necromancer-plus`, and
`necromancer-plus-plus` alongside the existing spell ids. Necromancer+ uses an
available lost minor type when invoked by a bot because bots do not operate the
player choice overlay. Bot spell-context/evaluation support is owned by
`chessBot/`; its resurrection context must provide black charges and lost-piece
state so it does not emit an unavailable spell.