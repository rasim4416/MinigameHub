import type { EventLocaleEntry } from "./types";

export const EVENTS_TR: Record<string, EventLocaleEntry> = {
  "golden-age": {
    "name": "Altın Çağ",
    "description": "Her oyuncu anında 10 altın kazanır.",
    "flavor": "Bolluk diyarı kapladı."
  },
  "peace-treaty": {
    "name": "Ateşkes Antlaşması",
    "description": "Sonraki 3 tur boyunca taş alımlarından altın kazanılmaz.",
    "flavor": "Geçici bir ateşkes ilan edildi."
  },
  "blessed-waters": {
    "name": "Kutsal Sular",
    "description": "Rastgele bir kare kutsandı. Üzerindeki taş 3 tur alınamaz.",
    "flavor": "Sular seçileni korur."
  },
  "lost-mercenary": {
    "name": "Kayıp Paralı Asker",
    "description": "Turuncu bir tarafsız piyon sol kanatta belirir. Her tam hamleden sonra doğuya yürür ve yolundaki taşları alır.",
    "flavor": "Sancak yok, efendi yok — yalnızca sonraki kare."
  },
  "cold-winds": {
    "name": "Soğuk Rüzgarlar",
    "description": "Her oyuncudan 2 rastgele taş donar; 1 tur hareket edemez.",
    "flavor": "Winter is coming."
  },
  "stock-crash": {
    "name": "Borsa Çöküşü",
    "description": "Her iki oyuncu 10 altın kaybeder.",
    "flavor": "Piyasalar konuştu."
  },
  "great-wall-of-hatay": {
    "name": "Büyük Hatay Seddi",
    "description": "3 ardışık boş kare 2 tur duvarla kapanır; Taş giremez veya geçemez. ",
    "flavor": "Çinliler yaptı biz niye yapamayalım."
  },
  "tactical-nuke": {
    "name": "Taktik Nükleer Saldırı",
    "description": "Rastgele 3×3 alan hedeflenir. İçindeki tüm taşlar 5 tur sonra yok edilir.",
    "flavor": "\"Geliyor!\""
  },
  "mercenary-patrol": {
    "name": "Paralı Asker Devriyesi",
    "description": "İki turuncu paralı at belirir. Her tam turda rastgele yasal at hamlesi yaparlar eğer taş varsa alırlar.",
    "flavor": "Karanlıkta nal sesleri — sadakat yok, dinlenme yok."
  },
  "red-wedding": {
    "name": "Kızıl Düğün",
    "description": "Her oyuncudan 2 rastgele piyon öldürülür.",
    "flavor": "\"Lannisters send their regards...\""
  },
  "siege-patrol": {
    "name": "Kuşatma ordusu",
    "description": "Turuncu paralı at ve kale belirir. Her tam turda diğer paralılar gibi rastgele yasal hamle yaparlar.",
    "flavor": "Bu sefer kuşatmaya geldiler"
  },
  "just-chaos": {
    "name": "Sadece Kaos",
    "description": "Olay havuzunu sıfırlar. Sıradan ve az yaygın olaylar kalıcı olarak kaldırılır. Olaylar artık her 2 tam turda bir gelir.",
    "flavor": "\"Chaos is a ladder.\""
  },
  "crusaders": {
    "name": "Haçlı Seferi",
    "description": "Dört turuncu paralı vezir, fil, at ve kale belirir.",
    "flavor": "Deus Vult."
  },
  "winter-has-come": {
    "name": "Kış Geldi",
    "description": "Rastgele boş bir kare sonsuza kadar donar.",
    "flavor": "Winter has come."
  },
  "valar-morghulis": {
    "name": "Valar Morghulis",
    "description": "Bütün piyonlar katledildi. ",
    "flavor": "Valar Dohaeris."
  },
  "more-more-moreeee": {
    "name": "Açım",
    "description": "İki oyuncu da fazladan bir augment seçimi kazanır. Garanti nadir veya üstü.",
    "flavor": "İki oyuncu da fazladan bir augment kazanır."
  },
  "tea-party": {
    "name": "Çay Partisi",
    "description": "Tepenin kralı augmenti ve 2 piyon kazanırsın. Zaten sahipsen geliştirilir.",
    "flavor": "Tepenin kralı augmenti ve 2 piyon kazanırsın."
  },
  "capitulations": {
    "name": "Kapitülasyon",
    "description": "Market fiyatları sıfırlandı. Geliştirmeler geri alınmaz.",
    "flavor": "Market fiyatları sıfırlandı."
  },
  "common-knowledge": {
    "name": "Genel Kültür",
    "description": "Fazladan bir augment seçimi kazan. Garanti nadir veya altı.",
    "flavor": "Fazladan bir augment seçimi kazan."
  },
  "apocalypse": {
    "name": "Kıyamet",
    "description": "Kenar sütun ve sıralar işaretlendi. 10 tam tur sonra o bölgelerdeki taşlar yok edilir.",
    "flavor": "Zaman daralıyor."
  },
  "all-in": {
    "name": "All-in (Hodri Meydan)",
    "description": "Şahlar hariç tüm taşlar kaldırılır. Her iki oyuncu 200 altın ve tam geliştirilmiş Piyon Dükkanı kazanır.",
    "flavor": "Herkes all-in girdi."
  },
  "capitalism": {
    "name": "Kapitalizm",
    "description": "Daha fazla altını olan oyuncu 20 altın kazanır.",
    "flavor": "Trump onayladı."
  },
  "pride-month": {
    "name": "Onur Ayı (Homofobi)",
    "description": "Krallar açığa çıktı. Vezirler tahtadan ayrılıyor.",
    "flavor": "We support the US, US, US thats the way we like it, like it, LOVE IT!!!!!"
  },
  "so-what": {
    "name": "Ee?",
    "description": "Filin ateist olduğunu öğrendin. Bu kadar.",
    "flavor": "Yani?"
  },
  "imposters": {
    "name": "Sahtekarlar (Amonkus)",
    "description": "Her oyuncudan iki piyon takım değiştirir.",
    "flavor": "Şüpheli."
  }
} as Record<string, EventLocaleEntry>;
