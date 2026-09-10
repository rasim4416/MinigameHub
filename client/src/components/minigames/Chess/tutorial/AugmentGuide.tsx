import { useMemo, useState } from "react";
import { getAugmentDescription, getAugmentName } from "../../../../locales/chess";
import { useChessLanguage } from "../ChessLanguageContext";
import { AUGMENT_POOL, BASE_COST, RARITY_META, type Rarity } from "../augments";

const rarityOrder: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export function AugmentGuide() {
  const language = useChessLanguage();
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const visible = useMemo(() => AUGMENT_POOL.filter((augment) => {
    const haystack = `${getAugmentName(augment.id, language)} ${getAugmentDescription(augment.id, language)}`.toLocaleLowerCase();
    return (rarity === "all" || augment.rarity === rarity) && haystack.includes(query.toLocaleLowerCase());
  }), [language, query, rarity]);
  const tr = language === "türkçe";
  return <section className="max-h-[60dvh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/70 p-3">
    <div className="mb-3 flex flex-col gap-2 sm:flex-row">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr ? "Augment ara" : "Search augments"} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400" />
      <select value={rarity} onChange={(event) => setRarity(event.target.value as Rarity | "all")} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-200">
        <option value="all">{tr ? "Tüm nadirlikler" : "All rarities"}</option>
        {rarityOrder.map((tier) => <option key={tier} value={tier}>{RARITY_META[tier].label} · {BASE_COST[tier]}g</option>)}
      </select>
    </div>
    <p className="mb-3 text-[11px] leading-relaxed text-slate-400">{tr ? "Mağaza maliyeti, aynı nadirlikteki her satın alımla artar. Bazı augmentler yalnızca ödül seçimlerinde görünür." : "Shop cost increases with every purchase from the same rarity tier. Some augments appear only in reward picks."}</p>
    <div className="space-y-1.5">
      {visible.map((augment) => <article key={augment.id} className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${RARITY_META[augment.rarity].border}66` }}>
        <div className="flex items-center justify-between gap-2"><strong className="text-xs" style={{ color: RARITY_META[augment.rarity].text }}>{getAugmentName(augment.id, language)}</strong><span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{RARITY_META[augment.rarity].label}</span></div>
        <p className="mt-1 text-[11px] leading-snug text-slate-300">{getAugmentDescription(augment.id, language)}</p>
      </article>)}
    </div>
  </section>;
}