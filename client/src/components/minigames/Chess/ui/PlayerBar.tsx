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
        <SpellButton icon="🩸" label="BLOOD" active={spells.bloodbendingActive} count={spells.bloodbendingCharges} onClick={spells.onBloodbending} title="Flip an enemy pawn to your color" />
      )}
      {canAct && spells.bloodbendingPlusCharges > 0 && (
        <SpellButton icon="🩸✨" label="BLOOD+" active={spells.bloodbendingPlusActive} count={spells.bloodbendingPlusCharges} onClick={spells.onBloodbendingPlus} title="Flip an enemy knight, bishop, or rook to your color" />
      )}
      {canAct && spells.necroPPCharges > 0 && spells.hasNecroPPTargets && (
        <SpellButton icon="💀💫" label="REVIVE++" active={spells.necroPPActive} onClick={spells.onNecroPP} title="Place a revived queen on an empty square of your back rank" />
      )}
      {canAct && spells.littleBigManCharges > 0 && (
        <SpellButton icon="👶👑" label="LBM" active={spells.littleBigManActive} count={spells.littleBigManCharges} onClick={spells.onLittleBigMan} title="Choose a rook-file pawn (a/h) — queen movement for 4 full rounds" />
      )}
      {canAct && spells.ilkkanAvailable && (
        <SpellButton icon="🧑" label="ILKKAN" active={spells.ilkkanActive} onClick={spells.onIlkkan} title="Make a pawn İlkkan" />
      )}
      {canAct && spells.royalEdAvailable && (
        <SpellButton icon="♞" label="ROYAL" active={spells.royalEdActive} onClick={spells.onRoyalEd} title="Move your king like a knight (one time)" />
      )}
      {canAct && spells.whatAvailable && (
        <SpellButton icon="↔️" label="WHAT?" active={spells.whatActive} onClick={spells.onWhat} title="Move one pawn sideways one square (one time)" />
      )}
      {canAct && spells.sakoAvailable && (
        <SpellButton icon="⚓" label="SAKO" active={spells.sakoActive} onClick={spells.onSako} title="Teleport a piece on your half (free action)" />
      )}
      {canAct && spells.swapAvailable && (
        <SpellButton icon="🔀" label="SWAP" active={spells.swapActive} onClick={spells.onSwap} title="Exchange two of your pieces (once per game)" />
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
        <SpellButton icon="🎯" label="CONTRACT" active={spells.contractActive} onClick={spells.onContract} title="Mark an enemy piece for 4× gold on capture" />
      )}
      {canAct && spells.blessedWaterCharges > 0 && (
        <SpellButton icon="💧" label="BLESS" count={spells.blessedWaterCharges} active={spells.blessedWaterActive} onClick={spells.onBlessedWater} title="Bless a square for 2 rounds" />
      )}
      {canAct && spells.puppetAvailable && (
        <SpellButton icon="🪆" label="PUPPET" active={spells.puppetActive} onClick={spells.onPuppet} title="Force opponent to move a piece next turn" />
      )}
      {canAct && spells.evadeCharges > 0 && (
        <SpellButton icon="💨" label="EVADE" active={spells.evadeActive} count={spells.evadeCharges} onClick={spells.onEvade} title="Block opponent spells/shop next turn" />
      )}
      {canAct && (
        <SpellButton icon="🏪" label="SHOP" active={spells.shopOpen} onClick={spells.onToggleShop} title="Open the augment shop" />
      )}
    </>
  );

  return (
    <div
      className={`flex shrink-0 flex-col gap-1 border-slate-800 bg-[#0a0f1a] px-3 py-1.5 md:min-h-14 md:flex-row md:items-center md:justify-between md:gap-2 md:py-0 ${
        color === "white" ? "border-t" : "border-b"
      }`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2 md:flex-1 md:justify-start">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${
              color === "white"
                ? "border-slate-400 bg-white"
                : "border-slate-500 bg-[#1a0f00]"
            } ${canAct ? "ring-2 ring-indigo-500 ring-offset-1 ring-offset-[#0a0f1a]" : ""}`}
          />
          <span
            className={`shrink-0 text-[13px] font-bold tracking-wide ${
              canAct ? "text-slate-200" : "text-slate-500"
            }`}
          >
            {color.toUpperCase()}
          </span>
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
          <div className="flex items-center gap-1">
            {sorted.map((t, i) => (
              <span
                key={i}
                className={`text-base leading-none ${
                  captureColor === "white"
                    ? "text-white drop-shadow-[0_0_2px_#000]"
                    : "text-[#1a0f00] drop-shadow-[0_0_2px_rgba(255,255,255,0.6)]"
                }`}
              >
                {PIECE_UNICODE[captureColor][t]}
              </span>
            ))}
            {advantage > 0 && (
              <span className="ml-0.5 text-xs font-semibold text-slate-400">
                +{advantage}
              </span>
            )}
          </div>
          {spells.hasBloodlust && (
            <span className="shrink-0 text-[9px] tracking-wide text-slate-500">
              🩸 {spells.captureCount % 4}/4
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusLabel && (
            <div
              className={`text-[11px] font-bold tracking-wide ${
                statusBadge
                  ? "rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5"
                  : ""
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
