import { AUGMENT_POOL } from "../augments";
import type { TutorialStep } from "./types";

export const D2: [number, number] = [6, 3];
export const D3: [number, number] = [5, 3];

export const WHAT_AUGMENT = AUGMENT_POOL.find((a) => a.id === "what")!;
export const MINER_AUGMENT = AUGMENT_POOL.find((a) => a.id === "miner")!;

/** Harmless black reply so white can act again */
export const BLACK_PASS_FROM: [number, number] = [1, 0];
export const BLACK_PASS_TO: [number, number] = [2, 0];
export const BLACK_SECOND_PASS_FROM: [number, number] = [1, 1];
export const BLACK_SECOND_PASS_TO: [number, number] = [2, 1];

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "intro",
    title: { english: "Welcome", türkçe: "Hoş geldin" },
    dialogue: {
      english: ["Welcome to Chess Augmented. The board obeys chess rules; augments create the exceptions.", "You will make one move, choose an augment, target a spell, and buy an economic tool."],
      türkçe: ["Chess Augmented'a hoş geldin. Tahta satranç kurallarına uyar; istisnaları augmentler yaratır.", "Bir hamle yapacak, augment seçecek, büyüyü hedefleyecek ve ekonomik bir araç alacaksın."],
    },
    advanceOn: "next",
    restrictions: {
      blockAllBoardInput: true,
      blockAllSpells: true,
      blockShopToggle: true,
    },
    completion: { type: "next" },
  },
  {
    id: "first-move",
    title: { english: "The board", türkçe: "Tahta" },
    dialogue: { english: "Start with the highlighted pawn. Only d2 to d3 is available in this lesson.", türkçe: "Vurgulanan piyonla başla. Bu derste sadece d2'den d3'e izin verilir." },
    advanceOn: "complete",
    restrictions: {
      allowedMoves: [{ from: D2, to: D3 }],
      highlightSquares: [D2],
      blockAllSpells: true,
      blockShopToggle: true,
    },
    completion: { type: "move" },
  },
  {
    id: "augment-intro",
    title: { english: "Augments", türkçe: "Augmentler" },
    dialogue: { english: ["Augments are your rule-bending toolkit. Some are passive; others add a spell button to your player bar.", "Reward picks happen when you capture milestone pieces, capture a queen, promote, or when an event awards one."], türkçe: ["Augmentler kural değiştiren araç kutundur. Bazıları pasiftir; bazıları oyuncu çubuğuna büyü düğmesi ekler.", "Ödül seçimleri dönüm noktası taşlarını veya veziri aldığında, terfi ettiğinde ya da bir etkinlik ödül verdiğinde gelir."] },
    advanceOn: "next",
    restrictions: {
      blockAllBoardInput: true,
      blockAllSpells: true,
      blockShopToggle: true,
    },
    completion: { type: "next" },
    onEnter: (bridge) => {
      bridge.setOfferedToWhite([WHAT_AUGMENT]);
    },
  },
  {
    id: "augment-pick",
    title: { english: "Your first pick", türkçe: "İlk seçimin" },
    dialogue: { english: 'Choose "What?" to continue.', türkçe: 'Devam etmek için "What?" seç.' },
    advanceOn: "complete",
    restrictions: {
      blockAllBoardInput: true,
      blockAllSpells: true,
      blockShopToggle: true,
      allowedAugmentIds: ["what"],
    },
    completion: { type: "augment" },
    onEnter: (bridge) => {
      bridge.setPhase("white-augment");
    },
  },
  {
    id: "use-what",
    title: { english: "Targeting", türkçe: "Hedefleme" },
    dialogue: { english: ['Select WHAT?, then select the highlighted pawn. The spell lets that pawn move sideways one square once.', 'Targeting spells wait for a valid board target. Select the active spell again to cancel before targeting.'], türkçe: ['WHAT? düğmesine, ardından vurgulanan piyona bas. Büyü piyonu bir kez yatayda bir kare ilerletir.', 'Hedefli büyüler geçerli bir tahta hedefi bekler. Hedeflemeden önce iptal etmek için etkin büyüye tekrar bas.'] },
    advanceOn: "complete",
    ensureWhiteTurn: true,
    restrictions: {
      blockAllBoardInput: false,
      allowSpellIds: ["what"],
      blockShopToggle: true,
      highlightUi: ["spell-what"],
    },
    completion: { type: "spell" },
    onEnter: () => {},
  },
  {
    id: "market",
    title: { english: "The market", türkçe: "Mağaza" },
    dialogue: { english: ["The shop lets you buy augments with gold. This lesson gives you five gold for Miner.", "Costs scale by rarity purchases. Improve owned augments when an Improve button appears; it changes the listed effect."], türkçe: ["Mağaza, altınla augment satın almanı sağlar. Bu ders Miner için sana beş altın verir.", "Maliyetler aynı nadirlikteki satın alımlarla artar. Improve düğmesi görünen augmentleri geliştir; listelenen etkileri değişir."] },
    advanceOn: "complete",
    ensureWhiteTurn: true,
    restrictions: {
      blockAllBoardInput: true,
      blockShopToggle: false,
      blockShopClose: true,
      allowedShopIds: ["miner"],
      highlightUi: ["shop-button", "shop-buy-miner"],
    },
    completion: { type: "shop-buy" },
    onEnter: (bridge) => {
      bridge.setGoldWhite(5);
      bridge.setShopOpen(true);
    },
  },
  {
    id: "rarity",
    title: { english: "Rarity tiers", türkçe: "Nadirlik katmanları" },
    dialogue: { english: ["Augments span five tiers: Common, Uncommon, Rare, Epic, and Legendary.", "Higher tiers cost more in the shop and tend to create bigger positional exceptions. Use the guide to search every augment by name, effect, or rarity."], türkçe: ["Augmentler beş katmana ayrılır: Common, Uncommon, Rare, Epic ve Legendary.", "Yüksek katmanlar mağazada daha pahalıdır ve daha büyük konumsal istisnalar yaratır. Rehberde her augmenti ada, etkiye veya nadirliğe göre ara."] },
    advanceOn: "next",
    restrictions: {
      blockAllBoardInput: true,
      blockAllSpells: true,
      blockShopToggle: true,
    },
    completion: { type: "next" },
    onEnter: (bridge) => {
      bridge.setShopOpen(false);
    },
  },
  {
    id: "improvements",
    title: { english: "Improving augments", türkçe: "Augment geliştirme" },
    dialogue: { english: ["Some owned augments reveal an Improve option in the shop. Improvements spend gold and replace the displayed effect with a stronger listed version.", "Think of gold as tempo: buy a new tool when it changes the position now, or improve an engine that compounds over later turns."], türkçe: ["Bazı sahip olduğun augmentler mağazada Improve seçeneği gösterir. Geliştirmeler altın harcar ve görünen etkiyi daha güçlü sürümüyle değiştirir.", "Altını tempo gibi düşün: şimdi konumu değiştiren yeni bir araç al ya da sonraki turlarda büyüyen motoru geliştir."] },
    advanceOn: "next",
    restrictions: { blockAllBoardInput: true, blockAllSpells: true, blockShopToggle: true },
    completion: { type: "next" },
  },
  {
    id: "rules",
    title: { english: "Rules still matter", türkçe: "Kurallar hâlâ geçerli" },
    dialogue: { english: ["King safety, check, checkmate, castling, en passant, and promotion still work normally unless an augment explicitly says otherwise.", "Read every spell before committing. A spell may be free, consume a charge, or spend your turn; targeting is only accepted on valid pieces or squares."], türkçe: ["Şah güvenliği, şah, mat, rok, geçerken alma ve terfi, bir augment açıkça değiştirmedikçe normal çalışır.", "Her büyüyü kullanmadan önce oku. Büyü ücretsiz olabilir, yük harcayabilir veya turunu tüketebilir; yalnızca geçerli taşlar ya da kareler hedeflenir."] },
    advanceOn: "next",
    restrictions: { blockAllBoardInput: true, blockAllSpells: true, blockShopToggle: true },
    completion: { type: "next" },
  },
  {
    id: "events-modes",
    title: { english: "Events and opponents", türkçe: "Etkinlikler ve rakipler" },
    dialogue: { english: ["Random board events can benefit or punish both sides, so leave room in your plan for a changing board.", "Bots value tactics, spells, and economy. Online games use the same shared turn state and rules: wait for your opponent's move before acting."], türkçe: ["Rastgele tahta etkinlikleri iki tarafı da ödüllendirebilir veya cezalandırabilir; planında değişen tahtaya yer bırak.", "Botlar taktikleri, büyüleri ve ekonomiyi değerlendirir. Çevrimiçi oyunlar aynı ortak sıra durumunu ve kuralları kullanır: hareket etmeden önce rakibinin hamlesini bekle."] },
    advanceOn: "next",
    restrictions: { blockAllBoardInput: true, blockAllSpells: true, blockShopToggle: true },
    completion: { type: "next" },
  },
  {
    id: "finish",
    title: { english: "Ready", türkçe: "Hazır" },
    dialogue: { english: "Tutorial complete. Returning to menu…", türkçe: "Eğitim tamamlandı. Menüye dönülüyor…" },
    advanceOn: "complete",
    restrictions: {
      blockAllBoardInput: true,
      blockAllSpells: true,
      blockShopToggle: true,
    },
    completion: { type: "auto" },
  },
];
