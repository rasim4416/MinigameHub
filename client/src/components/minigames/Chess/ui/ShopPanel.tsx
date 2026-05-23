import { useEffect, useRef } from "react";
import type { Color } from "../engine";
import type { Augment } from "../augments";
import {
  AUGMENT_POOL,
  augmentUnlockedForShop,
  getShopCost,
  MAX_STACK,
  NON_PURCHASABLE,
  RARITY_META,
} from "../augments";
import type { TierBought } from "../chessTypes";
import { GoldBadge } from "./GoldBadge";
import { ShopRow } from "./ShopRow";

export function ShopPanel({
  open,
  playerColor,
  gold,
  tierBought,
  playerAugments,
  onBuy,
  onClose,
  pawnShopNextPrice,
  onBuyPawn,
  pawnPlacePending,
}: {
  open: boolean;
  playerColor: Color;
  gold: number;
  tierBought: TierBought;
  playerAugments: Augment[];
  onBuy: (aug: Augment) => void;
  onClose: () => void;
  pawnShopNextPrice: number | null;
  onBuyPawn: (() => void) | null;
  pawnPlacePending: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 280);
    return () => window.clearTimeout(t);
  }, [open]);

  const RARITY_ORDER: Array<Augment["rarity"]> = [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
  ];
  const counts: Record<string, number> = {};
  for (const a of playerAugments) counts[a.id] = (counts[a.id] || 0) + 1;
  const ownedIds = Object.keys(counts);
  const atMax = (id: string) => (counts[id] ?? 0) >= (MAX_STACK[id] ?? 1);
  const grouped = RARITY_ORDER.map((r) => ({
    rarity: r,
    augments: AUGMENT_POOL.filter(
      (a) =>
        a.rarity === r &&
        !NON_PURCHASABLE.has(a.id) &&
        !atMax(a.id) &&
        augmentUnlockedForShop(a.id, ownedIds),
    ),
  })).filter((g) => g.augments.length > 0);

  return (
    <div
      ref={panelRef}
      className={`grid w-full transition-[grid-template-rows,opacity] duration-300 ease-out ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        <div className="flex w-full flex-col border-t border-slate-800 bg-slate-950/95 backdrop-blur-sm">
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-black tracking-wider text-slate-200">
                Shop
              </span>
              <span className="text-[11px] font-semibold tracking-wide text-slate-500">
                {playerColor.toUpperCase()}&apos;s turn
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <GoldBadge gold={gold} active={true} />
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-3 py-3 md:px-4">
            <div className="flex flex-col gap-6">
              {grouped.map(({ rarity, augments }) => {
                const m = RARITY_META[rarity];
                const bought = tierBought[rarity];
                const nextCost = getShopCost(rarity, bought);
                return (
                  <section key={rarity}>
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className="h-px flex-1"
                        style={{
                          background: `linear-gradient(90deg,${m.border}66,transparent)`,
                        }}
                      />
                      <span
                        className="rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                        style={{
                          color: m.text,
                          background: m.badge,
                          borderColor: `${m.border}44`,
                        }}
                      >
                        {m.label}
                      </span>
                      <span className="text-[9px] font-semibold text-slate-600">
                        next: {nextCost}g{bought > 0 ? ` (${bought} bought)` : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-1">
                      {augments.map((aug) => {
                        const cost = getShopCost(aug.rarity, bought);
                        const canAfford = gold >= cost;
                        const ownedCount = playerAugments.filter(
                          (a) => a.id === aug.id,
                        ).length;
                        const maxStack = MAX_STACK[aug.id] ?? 1;
                        const isMaxed = ownedCount >= maxStack;
                        return (
                          <ShopRow
                            key={aug.id}
                            augment={aug}
                            cost={cost}
                            canAfford={canAfford}
                            isMaxed={isMaxed}
                            onBuy={() => onBuy(aug)}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {pawnShopNextPrice != null &&
                onBuyPawn &&
                playerAugments.some((a) => a.id === "pawn-shop") &&
                !pawnPlacePending && (
                  <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="mb-2 text-[9px] font-extrabold tracking-widest text-slate-500">
                      PAWN SHOP
                    </div>
                    <ShopRow
                      augment={{
                        id: "pawn-shop-buy",
                        name: "Buy pawn",
                        description:
                          "Place on an empty original pawn square",
                        rarity: "rare",
                        icon: "♙",
                      }}
                      cost={pawnShopNextPrice}
                      canAfford={gold >= pawnShopNextPrice}
                      isMaxed={false}
                      onBuy={onBuyPawn}
                    />
                  </section>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
