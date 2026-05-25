import type { EventLocaleEntry } from "./types";

export const EVENTS_TR: Record<string, EventLocaleEntry> = {
  "golden-age": {
    "name": "Altın Çağ",
    "description": "Her oyuncu anında 10 altın kazanır.",
    "flavor": "Bolluk diyarı kapladı."
  },
  "peace-treaty": {
    "name": "Ateşkes Antlaşması",
    "description": "Sonraki 5 tur boyunca taş alımlarından altın kazanılmaz.",
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
    "description": "Tahta olayları artık her 5 tam turda bir tetiklenir",
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
  }
} as Record<string, EventLocaleEntry>;
