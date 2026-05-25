/**
 * One-off generator for Turkish chess locale files.
 * Run: npx tsx scripts/generate-chess-tr-locales.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import type { AugmentLocaleEntry, EventLocaleEntry } from "../src/locales/chess/types";

const AUGMENTS_TR: Record<string, AugmentLocaleEntry> = {
  miner: {
    name: "Madenci",
    description: "Her 3 turda bir 2 altın kazan. Sonsuz yığılabilir.",
  },
  alternative: {
    name: "Alternatif",
    description: "Kale sütunundaki piyonların (a ve h) ilk hamlede 3 kare ilerleyebilir.",
  },
  mastermind: {
    name: "Dahi",
    description:
      "Artırıcı çekiliş şanslarını iyileştirir (Sıradan↓ Nadir↑ Destansı↑). Dükkandan alınamaz.",
  },
  "instant-cash": {
    name: "Anında Nakit",
    description: "Anında 10 altın verir. Dükkandan alınamaz.",
  },
  "prize-money": {
    name: "Ödül Parası",
    description:
      "Oyundaki ilk taş alımında, Ödül Parası olan oyuncunun o yarım turdaki altını ikiye katlanır (oyunda bir kez, herkes için). Dükkandan alınamaz.",
  },
  investment: {
    name: "Yatırım",
    description: "20 altından fazla altının varken her tur sonunda +1 altın kazan.",
  },
  efficient: {
    name: "Verimli",
    description:
      "Taş aldığında +1 ekstra altın kazan (normal alım ödülüyle birleşir).",
  },
  thief: {
    name: "Hırsız",
    description:
      "Her tur sonunda, Hırsız yığını başına %1 şansla anında 50 altın kazan.",
  },
  "blind-rage": {
    name: "Kör Öfke",
    description:
      "Her iki taraf da dört tam tur tamamlamadan önce at alırsan bir bonus artırıcı seçimi kazan (oyunda bir kez).",
  },
  anticipation: {
    name: "Öngörü",
    description:
      "Yalnızca olumsuz rastgele tahta olaylarından altın kaybetmezsin (ör. Borsa Çöküşü).",
  },
  "king-of-the-hill": {
    name: "Tepe Kralı",
    description: "d4/d5/e4/e5 üzerindeki her taşın tur başına 1 altın kazandırır.",
  },
  jew: {
    name: "Jew",
    description: "Rakip piyonlarını aldığında, alınan piyon başına 2 altın kazan.",
  },
  "alternative-plus": {
    name: "Alternatif+",
    description:
      "Tüm piyonların ilk hamlede 3 kareye kadar ilerleyebilir (Alternatif gerekir).",
  },
  "mastermind-plus": {
    name: "Dahi+",
    description:
      "Çekiliş şanslarını daha da artırır (Nadir↑↑ Destansı↑↑ Efsanevi↑). Dükkandan alınamaz.",
  },
  "contract-killer": {
    name: "Kontrat Katili",
    description:
      "Bir rakip taşı işaretle (şah/piyon değil). Alırsan taban değerinin 4 katı altın kazan. Sözleşme bitince artırıcı tükenir.",
  },
  evade: {
    name: "Kaçınma",
    description:
      "Bir yük harca: rakibin sonraki turunda artırıcı büyüleri kullanamaz (dükkan açık).",
  },
  "tax-man": {
    name: "Vergi Memuru",
    description:
      "Yarım tur bitince, rakibin o yarım turda kazandığı her 10 altın için 1 altın al (yığın başına).",
  },
  "free-passage": {
    name: "Serbest Geçit",
    description: "Şahın şah çekiliyken bile rok atabilir (diğer rok kuralları geçerli).",
  },
  augmented: {
    name: "Geliştirilmiş",
    description: "Bonus seçimlerinde 3 yerine 4 artırıcı seçeneği sunulur.",
  },
  frost: {
    name: "Don",
    description:
      "1 dondurma büyüsü kazan. Bir rakip taşı dondur — 1 tur hareket edemez.",
  },
  what: {
    name: "Ne?",
    description: "Bir kez, bir piyonun yana bir boş kareye gidebilir.",
  },
  oops: {
    name: "Ups",
    description: "1 geri alma kazan. Oyunda bir kez son 2 yarım turu geri al.",
  },
  impassable: {
    name: "Geçilmez",
    description:
      "Boş bir kareye hareket etmeyen, yok edilemeyen monolit yerleştir (tur harcar). Kaldırılınca kalıcı olarak gider.",
  },
  necromancer: {
    name: "Nekromancer",
    description: "Kaybedilen bir piyonu başlangıç sırasındaki ev karesine geri getir.",
  },
  "blessed-water-spell": {
    name: "Kutsal Su",
    description:
      "Herhangi bir kareyi kutsala (anında, ücretsiz). Üzerindeki taş 2 tur alınamaz.",
  },
  ilkkan: {
    name: "İlkkan",
    description:
      "Kişiliği yoktur ilkkan. Bir piyonun İlkkan olur. Kale, fil veya at alırsa o taşa dönüşür.",
  },
  swap: {
    name: "Takas",
    description:
      "Oyunda bir kez iki kendi taşının yerini değiştir (ücretsiz). Donmuş taşlar taşınamaz.",
  },
  "pawn-shop": {
    name: "Piyon Dükkanı",
    description:
      "Dükkandan piyon al; orijinal piyon sırasındaki boş karelere yerleştir (10×10 dahil). Yerleştirme tur harcamaz. Fiyat 10g'den başlar, her alımda +10g, üst sınır yok.",
  },
  "mastermind-plus-plus": {
    name: "Dahi++",
    description: "Artırıcı çekiliş nadirliğini daha da iyileştirir. Dükkandan alınamaz.",
  },
  "i-am-danger": {
    name: "Tehlike benim",
    description: "Rakip şaha her şah çektiğinde 4 altın kazan (yığın başına).",
  },
  "double-gold": {
    name: "Çift Altın",
    description:
      "Sonraki 5 tam tur boyunca kazandığın tüm altın ikiye katlanır. Dükkandan alınamaz.",
  },
  "necromancer-plus": {
    name: "Nekromancer+",
    description:
      "En son kaybedilen at veya filini ev sırasındaki boş bir kareye dirilt.",
  },
  horde: {
    name: "Sürü",
    description:
      "Alındığında her piyonun boş ön kareye bir adım atmayı dener (alım yok).",
  },
  bloodbending: {
    name: "Kangbükme",
    description:
      "Büyü: bir rakip piyonunu kendi rengine çevir (kutsal/don kurallarına uyar).",
  },
  bloodlust: {
    name: "Kan susuzluğu",
    description: "Her 4 rakip taş alımında 1 bonus artırıcı seçimi.",
  },
  "internal-combustion": {
    name: "İç Yanma",
    description:
      "Şahına ilk şah çeken rakip taş patlar — kaldırılır, altın vermez.",
  },
  "royal-education": {
    name: "Kraliyet Eğitimi",
    description: "Bir kez şahın at gibi hareket edebilir.",
  },
  "death-note": {
    name: "Ölüm Defteri",
    description:
      "Bir rakip taş seç (şah/vezir değil). 16 tur sonra ölür; lanet taş kimliğini takip eder. Bu şekilde ölenler altın/artırıcı/alım sayılmaz.",
  },
  puppet: {
    name: "Kukla",
    description:
      "Oyunda bir kez bir rakip taşı işaretle (şah değil). Sonraki turda rakip O taşı oynamak zorunda.",
  },
  "sako-bosphorus": {
    name: "Şako Bosphorus",
    description:
      "Deneyimi Satın Al — bir kez herhangi bir taşını boş bir kareye ışınla.",
  },
  "royal-household": {
    name: "Kraliyet Hanesi",
    description:
      "Bir kez şahın şah çekiliyken düz çizgide 4 kareye kadar öfkeyle ilerler; yolundaki her taşı yok eder.",
  },
  "domain-expansion": {
    name: "ALAN GENİŞLEMESİ",
    description:
      "Bu artırıcıya sahip her takım bir kez genişleyebilir (oyunda en fazla iki). 1v1 ve 2v2 kuralları geçerli; taşlar merkeze göre aynı göreli karelerde kalır.",
  },
  "little-big-man": {
    name: "Küçük Büyük Adam",
    description:
      "Büyü: bir piyon seç. 4 tam tur vezir gibi oynar, sonra eski haline döner.",
  },
  "bloodbending-plus": {
    name: "Kangbükme+",
    description:
      "Büyü: bir rakip at, fil veya kaleyi kendi rengine çevir (Kangbükme gerekir).",
  },
  "necromancer-plus-plus": {
    name: "Nekromancer++",
    description:
      "Büyü: dirilmiş bir veziri ev sırasındaki boş kareye koy (Nekromancer+ gerekir).",
  },
};

const IMPROVEMENTS_TR: Record<string, string[]> = {
  miner: ["Her 2 turda bir 2 altın kazan (önceden 3). Sonsuz yığılabilir."],
  alternative: [
    "Her piyon ilk hamlede yol açıksa 3 kareye kadar ilerleyebilir.",
  ],
  investment: [
    "Her tam tur sonunda sahip olduğun her 10 altın için 1 altın kazan (20g → 2g, 40g → 4g, vb.).",
  ],
  efficient: [
    "Taş aldığında +2 ekstra altın (normal ödülle birleşir).",
    "Taş aldığında +3 ekstra altın (normal ödülle birleşir).",
  ],
  thief: [
    "Tur sonunda Hırsız yığını başına %2 şansla 50 altın.",
    "Tur sonunda Hırsız yığını başına %5 şansla 50 altın.",
    "Tur sonunda Hırsız yığını başına %10 şansla 50 altın.",
  ],
  "king-of-the-hill": [
    "d4/d5/e4/e5 üzerindeki her taş tur başına 2 altın kazandırır.",
  ],
  jew: [
    "Rakip piyonlarını aldığında alınan piyon başına 3 altın.",
    "Rakip piyon alımlarında: ilki 3g, ikincisi 6g, üçüncüsü 9g… ölçeklenir.",
  ],
  "contract-killer": [
    "Bir rakip taş işaretle (şah/piyon değil). Alırsan taban değerinin 5 katı altın.",
  ],
  "tax-man": [
    "Yarım tur bitince rakibin o turda kazandığı her 8 altın için 3 altın (yığın başına).",
    "Yarım tur bitince rakibin o turda kazandığı her 5 altın için 3 altın (yığın başına).",
  ],
  frost: ["Bir rakip taşı dondur — 2 tur hareket edemez."],
  "blessed-water-spell": [
    "Herhangi bir kareyi kutsala. Üzerindeki taş 3 tur alınamaz.",
  ],
  "pawn-shop": [
    "Dükkandan piyon al; fiyat 5g'den başlar, her alımda +5g.",
    "Dükkandan piyon al; sabit 10g (fiyat artmaz).",
  ],
  "i-am-danger": [
    "Rakip şaha her şah çektiğinde 5 altın (yığın başına).",
  ],
  bloodlust: [
    "Her 3 rakip taş alımında 1 bonus artırıcı seçimi.",
    "Her 3 rakip taş alımında 2 bonus artırıcı seçimi.",
  ],
  "royal-education": [
    "Şahın iki kez at gibi hareket edebilir (büyünün 2 yükü).",
  ],
  "death-note": [
    "Lanetli taş 12 yarım tur sonra ölür (zamanlayıcı taş kimliğini izler).",
    "Lanetli taş 4 yarım tur sonra ölür (zamanlayıcı taş kimliğini izler).",
    "Lanetli taş seçildiğinde anında ölür (zamanlayıcı yok).",
  ],
};

const EVENTS_TR: Record<string, EventLocaleEntry> = {
  "golden-age": {
    name: "Altın Çağ",
    description: "Her oyuncu anında 10 altın kazanır.",
    flavor: "Bolluk ülkeyi kaplar.",
  },
  "peace-treaty": {
    name: "Barış Antlaşması",
    description: "Sonraki 5 tur boyunca taş alımlarından altın kazanılmaz.",
    flavor: "Geçici bir ateşkes ilan edildi.",
  },
  "blessed-waters": {
    name: "Kutsal Sular",
    description:
      "3–6. yataylar arasında rastgele bir kare kutsanır. Üzerindeki taş 3 tur alınamaz.",
    flavor: "Sular seçileni korur.",
  },
  "lost-mercenary": {
    name: "Kayıp Paralı Asker",
    description:
      "Turuncu bir paralı piyon sol kanatta belirir. Her tam hamleden sonra doğuya yürür veya görüşle alır (V>K>A>F>P). Şah alamaz. Son dosyaya ulaşınca bir sonraki tam hamlede gider.",
    flavor: "Sancak yok, efendi yok — yalnızca sonraki kare.",
  },
  "cold-winds": {
    name: "Soğuk Rüzgarlar",
    description:
      "Her oyuncudan 2 rastgele taş (şah hariç) donar; 1 tur hareket edemez.",
    flavor: "Savaş alanı sessizleşir.",
  },
  "stock-crash": {
    name: "Borsa Çöküşü",
    description: "Her iki oyuncu 10 altın kaybeder.",
    flavor: "Piyasalar konuştu.",
  },
  "great-wall-of-hatay": {
    name: "Hatay'ın Büyük Duvarı",
    description:
      "3 ardışık boş kare (yatay veya dikey) 2 tur duvarlanır; taş giremez veya geçemez. Geçerli aralık yoksa etkisiz.",
    flavor: "Bir gece duvar yükselir.",
  },
  "tactical-nuke": {
    name: "Taktik Nükleer Saldırı",
    description:
      "Rastgele 3×3 alan hedeflenir. İçindeki tüm taşlar 5 tur sonra yok edilir.",
    flavor: "\"Geliyor!\"",
  },
  "mercenary-patrol": {
    name: "Paralı Asker Devriyesi",
    description:
      "Sol ve sağ dosyalarda iki turuncu paralı at belirir. Her tam turda rastgele yasal at hamlesi yaparlar. Şah alamaz, monolithe basamaz.",
    flavor: "Karanlıkta nal sesleri — sadakat yok, dinlenme yok.",
  },
  "red-wedding": {
    name: "Kızıl Düğün",
    description: "Her oyuncudan 2 rastgele piyon öldürülür.",
    flavor: "\"Lannisterlar selamlarını yollar.\"",
  },
  "siege-patrol": {
    name: "Kuşatma Devriyesi",
    description:
      "Sol ve sağ kanatlarda turuncu paralı at ve kale belirir. Her tam turda diğer paralılar gibi rastgele yasal hamle yaparlar.",
    flavor: "Savaş makineleri — sancak yok, efendi yok.",
  },
  "just-chaos": {
    name: "Sadece Kaos",
    description:
      "Tahta olayları artık her 5 tam turda bir tetiklenir (rastgele 5–13 yerine), oyun sonuna kadar.",
    flavor: "\"Dünya yansın.\"",
  },
  crusaders: {
    name: "Haçlılar",
    description:
      "Dört turuncu paralı — vezir, fil, at ve kale — iç karelerde belirir. Deus Vult.",
    flavor: "Deus Vult.",
  },
  "winter-has-come": {
    name: "Kış Geldi",
    description:
      "Rastgele boş bir kare sonsuza kadar donar; taş basamaz/geçemez; piyon dükkanı vb. engellenir.",
    flavor: "Soğuk hatırlar.",
  },
  "valar-morghulis": {
    name: "Valar Morghulis",
    description:
      "Normal beyaz ve siyah piyonlar tahtadan kaldırılır. Turuncu paralı piyonlar kalır. Piyon olan İlkkan temizlenir.",
    flavor: "Hepimiz öleceğiz.",
  },
};

const dir = join(import.meta.dirname ?? ".", "../src/locales/chess");

const fmtAug = (data: Record<string, AugmentLocaleEntry>) =>
  `import type { AugmentLocaleEntry } from "./types";\n\nexport const AUGMENTS_TR: Record<string, AugmentLocaleEntry> = ${JSON.stringify(data, null, 2)} as Record<string, AugmentLocaleEntry>;\n`;

const fmtImp = (data: Record<string, string[]>) =>
  `export const IMPROVEMENTS_TR: Record<string, string[]> = ${JSON.stringify(data, null, 2)};\n`;

const fmtEv = (data: Record<string, EventLocaleEntry>) =>
  `import type { EventLocaleEntry } from "./types";\n\nexport const EVENTS_TR: Record<string, EventLocaleEntry> = ${JSON.stringify(data, null, 2)} as Record<string, EventLocaleEntry>;\n`;

writeFileSync(join(dir, "augments.tr.ts"), fmtAug(AUGMENTS_TR));
writeFileSync(join(dir, "improvements.tr.ts"), fmtImp(IMPROVEMENTS_TR));
writeFileSync(join(dir, "events.tr.ts"), fmtEv(EVENTS_TR));
console.log("Wrote Turkish locale files");
