import type { Color, PieceType } from "../engine";
import { PIECE_UNICODE, PIECE_VALUE, opp } from "../engine";
import type { Augment } from "../augments";
import type { GamePhase, SpellState } from "../chessTypes";
import { AugmentIconChip } from "./AugmentIconChip";
import { GoldBadge } from "./GoldBadge";
import { SpellButton } from "./SpellButton";
import { UndoButton } from "./UndoButton";

export function PlayerBar({
  color,
  isActive,
  isOver,
  phase,
  augments,
  gold,
  capturedPieces,
  advantage,
  spells,
  statusLabel,
  statusColor,
  statusBadge,
  tags = [],
}: {
  color: Color;
  isActive: boolean;
  isOver: boolean;
  phase: GamePhase;
  augments: Augment[];
  gold: number;
  capturedPieces: PieceType[];
  advantage: number;
  spells: SpellState;
  statusLabel?: string;
  statusColor?: string;
  statusBadge?: boolean;
  /** Small setup labels beside the name (bot difficulty, advantage). */
  tags?: { label: string; title?: string; tone: "gold" | "violet" }[];
}) {
  const captureColor = opp(color);
  const sorted = [...capturedPieces].sort(
    (a, b) => PIECE_VALUE[b] - PIECE_VALUE[a],
  );
  const canAct = isActive && !isOver && phase === "playing";

  const counts: Record<string, number> = {};
  const ordered: Augment[] = [];
  for (const a of augments) {
    if (!counts[a.id]) {
      ordered.push(a);
      counts[a.id] = 0;
    }
    counts[a.id]++;
  }

  const spellButtons = (
    <>
      {spells.canUndo && <UndoButton onUndo={spells.onUndo} />}
      {canAct && spells.freezeCharges > 0 && (
        <SpellButton icon="❄️" label="FREEZE" active={spells.freezeActive} count={spells.freezeCharges} onClick={spells.onFreeze} title="Freeze an enemy piece for 1 opponent turn" />
      )}
      {canAct && spells.necroCharges > 0 && spells.hasNecroTargets && (
        <SpellButton icon="💀" label="REVIVE" active={spells.necroActive} onClick={spells.onNecro} title="Resurrect a captured pawn at its home square" />
      )}
      {canAct && spells.necroPlusCharges > 0 && spells.hasNecroPlusTargets && (
        <SpellButton icon="💀✨" label="REVIVE+" active={spells.necroPlusActive} onClick={spells.onNecroPlus} title="Revive a captured knight or bishop to your home rank" />
      )}
      {canAct && spells.bloodbendingCharges > 0 && (
        <SpellButton icon="🩸" label="BLOOD" active={spells.bloodbendingActive} count={spells.bloodbendingCharges} onClick={spells.onBloodbending} title="Flip an enemy pawn to your color (spends your turn)" />
      )}
      {canAct && spells.bloodbendingPlusCharges > 0 && (
        <SpellButton icon="🩸✨" label="BLOOD+" active={spells.bloodbendingPlusActive} count={spells.bloodbendingPlusCharges} onClick={spells.onBloodbendingPlus} title="Flip an enemy knight, bishop, or rook to your color" />
      )}
      {canAct && spells.necroPPCharges > 0 && spells.hasNecroPPTargets && (
        <SpellButton icon="💀💫" label="REVIVE++" active={spells.necroPPActive} onClick={spells.onNecroPP} title="Place a revived queen on an empty square of your back rank" />
      )}
      {canAct && spells.littleBigManCharges > 0 && (
        <SpellButton icon="👶👑" label="LBM" active={spells.littleBigManActive} count={spells.littleBigManCharges} onClick={spells.onLittleBigMan} title="Choose any of your pawns — queen movement for 4 full rounds" />
      )}
      {canAct && spells.sacrificeAvailable && (
        <SpellButton icon="♜" label="SACR" active={spells.sacrificeActive} onClick={spells.onSacrifice} title="Sacrifice a rook — gain a rare+ augment pick" />
      )}
      {canAct && spells.ilkkanAvailable && (
        <SpellButton icon="🧑" label="ILKKAN" active={spells.ilkkanActive} onClick={spells.onIlkkan} title="Make a pawn İlkkan" />
      )}
      {canAct && spells.royalEdAvailable && (
        <SpellButton icon="♞" label="ROYAL" active={spells.royalEdActive} onClick={spells.onRoyalEd} title="Move your king like a knight — even while in check" />
      )}
      {canAct && spells.whatAvailable && (
        <SpellButton icon="↔️" label="WHAT?" active={spells.whatActive} onClick={spells.onWhat} tutorialId="spell-what" title="Move one pawn sideways one square (one time)" />
      )}
      {canAct && spells.sakoAvailable && (
        <SpellButton icon="⚓" label="SAKO" active={spells.sakoActive} onClick={spells.onSako} title="Teleport any of your pieces (spends your turn)" />
      )}
      {canAct && spells.swapAvailable && (
        <SpellButton icon="🔀" label="SWAP" active={spells.swapActive} onClick={spells.onSwap} title="Exchange two of your pieces (spends your turn)" />
      )}
      {canAct && spells.royalHouseholdAvailable && (
        <SpellButton icon="🏰" label="RAMPAGE" active={spells.royalHouseholdActive} onClick={spells.onRoyalHousehold} title="King rampages up to 4 squares" />
      )}
      {canAct && spells.deathNoteAvailable && (
        <SpellButton icon="☠️" label="DEATH" active={spells.deathNoteActive} onClick={spells.onDeathNote} title="Mark an enemy piece to die in 16 half-moves" />
      )}
      {canAct && spells.domainAvailable && (
        <SpellButton icon="♾️" label="DOMAIN" onClick={spells.onDomain} title="Expand the board to 10×10" />
      )}
      {canAct && spells.monolithPlaceAvailable && (
        <SpellButton icon="🗿" label="PLACE" active={spells.monolithPlaceActive} onClick={spells.onMonolithPlace} title="Place a monolith (spends a turn)" />
      )}
      {canAct && spells.monolithRemoveAvailable && (
        <SpellButton icon="🗑️" label="REMOVE" active={spells.monolithPlaceActive} onClick={spells.onMonolithRemove} title="Remove your monolith (free)" />
      )}
      {canAct && spells.contractAvailable && (
        <SpellButton icon="🎯" label="CONTRACT" active={spells.contractActive} onClick={spells.onContract} title="Mark an enemy piece for 3× gold on capture" />
      )}
      {spells.plotArmourRounds > 0 && (
        <span className="shrink-0 rounded border border-yellow-500/40 bg-yellow-950/40 px-1.5 py-0.5 text-[9px] font-bold text-yellow-200">
          🛡️ {spells.plotArmourRounds}r
        </span>
      )}
      {canAct && spells.blessedWaterCharges > 0 && (
        <SpellButton icon="💧" label="BLESS" count={spells.blessedWaterCharges} active={spells.blessedWaterActive} onClick={spells.onBlessedWater} title="Bless a square for 2 rounds" />
      )}
      {canAct && spells.puppetAvailable && (
        <SpellButton icon="🪆" label="PUPPET" active={spells.puppetActive} onClick={spells.onPuppet} title="Spend your turn to force opponent to move a piece (must have a legal move)" />
      )}
      {canAct && spells.heldAuctionPieces.length > 0 && (
        <SpellButton
          icon="🏷️"
          label="HIRE"
          count={spells.heldAuctionPieces.length}
          active={false}
          onClick={spells.onPlaceHeldAuction}
          title={`Place hired ${spells.heldAuctionPieces[0]} on an empty home square`}
        />
      )}
      {canAct && spells.evadeCharges > 0 && (
        <SpellButton icon="💨" label="EVADE" active={spells.evadeActive} count={spells.evadeCharges} onClick={spells.onEvade} title="Block opponent spells/shop next turn" />
      )}
      {canAct && (
        <SpellButton icon="🏪" label="SHOP" active={spells.shopOpen} onClick={spells.onToggleShop} tutorialId="shop-button" title="Open the augment shop" />
      )}
    </>
  );

  const turnLabel = isOver ? "" : canAct ? "To move" : phase === "playing" ? "Waiting" : "";

  return (
    <div
      className={`relative flex shrink-0 flex-col gap-1.5 px-3 py-2 transition-colors duration-300 md:min-h-[60px] md:flex-row md:items-center md:justify-between md:gap-3 md:py-1.5 ${
        color === "white" ? "border-t" : "border-b"
      } ${
        canAct
          ? "border-amber-400/25 bg-gradient-to-r from-amber-500/[0.09] via-[#0b1222] to-[#0a0f1a]"
          : "border-slate-800/80 bg-[#090e19]"
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] transition-opacity duration-300 ${
          canAct ? "bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 opacity-100" : "opacity-0"
        }`}
      />
      <div className="flex min-w-0 items-center justify-between gap-2 md:flex-1 md:justify-start">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[22px] leading-none transition-shadow duration-300 ${
              color === "white"
                ? "border-slate-300/40 bg-gradient-to-br from-slate-200 to-slate-400 text-white [text-shadow:0_0_2px_#000,0_1px_2px_#000]"
                : "border-violet-400/40 bg-gradient-to-br from-[#2a2140] to-[#120c1f] text-[#1a0f00] [text-shadow:0_0_2px_rgba(255,255,255,0.85)]"
            } ${canAct ? "shadow-[0_0_0_2px_rgba(251,191,36,0.7),0_0_18px_rgba(251,191,36,0.35)]" : ""}`}
          >
            {color === "white" ? "♔" : "♚"}
          </div>
          <div className="flex min-w-0 flex-col leading-none">
            <span
              className={`text-[13px] font-black uppercase tracking-[0.14em] ${
                canAct ? "text-slate-50" : "text-slate-400"
              }`}
            >
              {color}
            </span>
            {turnLabel && (
              <span
                className={`mt-1 text-[9px] font-extrabold uppercase tracking-[0.2em] ${
                  canAct ? "text-amber-300" : "text-slate-600"
                }`}
              >
                {canAct && (
                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 align-middle motion-reduce:animate-none" />
                )}
                {turnLabel}
              </span>
            )}
          </div>
          {tags.map((t) => (
            <span
              key={t.label}
              title={t.title}
              className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] ${
                t.tone === "gold"
                  ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                  : "border-violet-400/40 bg-violet-500/10 text-violet-200"
              }`}
            >
              {t.label}
            </span>
          ))}
          {ordered.length > 0 && (
            <div className="hidden items-center gap-1 sm:flex">
              {ordered.map((a) => (
                <AugmentIconChip
                  key={a.id}
                  augment={a}
                  stacked={counts[a.id] >= 2}
                />
              ))}
            </div>
          )}
          <GoldBadge gold={gold} active={canAct} />
          {(sorted.length > 0 || advantage > 0) && (
            <div className="flex min-h-7 items-center gap-0.5 rounded-lg border border-slate-800 bg-black/25 px-1.5 py-0.5">
              {sorted.map((t, i) => (
                <span
                  key={i}
                  className={`-mr-1 text-[15px] leading-none last:mr-0 ${
                    captureColor === "white"
                      ? "text-white drop-shadow-[0_0_2px_#000]"
                      : "text-[#1a0f00] drop-shadow-[0_0_2px_rgba(255,255,255,0.6)]"
                  }`}
                >
                  {PIECE_UNICODE[captureColor][t]}
                </span>
              ))}
              {advantage > 0 && (
                <span className="ml-1.5 text-[11px] font-extrabold text-emerald-300">
                  +{advantage}
                </span>
              )}
            </div>
          )}
          {spells.hasBloodlust && (
            <span className="shrink-0 rounded-full border border-red-500/30 bg-red-950/40 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-red-200">
              🩸 {spells.captureCount % 4}/4
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusLabel && (
            <div
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide ${
                statusBadge
                  ? "border border-red-500/40 bg-red-500/15 shadow-[0_0_14px_rgba(239,68,68,0.25)]"
                  : "border border-slate-700/60 bg-slate-900/60"
              }`}
              style={{ color: statusColor ?? "#e2e8f0" }}
            >
              {statusLabel}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto overflow-y-hidden pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] md:max-w-[55%] lg:max-w-[60%]">
        {ordered.length > 0 && (
          <div className="flex items-center gap-1 sm:hidden">
            {ordered.map((a) => (
              <AugmentIconChip
                key={a.id}
                augment={a}
                stacked={counts[a.id] >= 2}
              />
            ))}
          </div>
        )}
        {spellButtons}
      </div>
    </div>
  );
}
