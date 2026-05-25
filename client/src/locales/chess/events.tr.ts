import type { EventLocaleEntry } from "./types";

export const EVENTS_TR: Record<string, EventLocaleEntry> = {
  "golden-age": {
    "name": "Altın Çağ",
    "description": "Her oyuncu anında 10 altın kazanır.",
    "flavor": "Bolluk ülkeyi kaplar."
  },
  "peace-treaty": {
    "name": "Barış Antlaşması",
    "description": "Sonraki 5 tur boyunca taş alımlarından altın kazanılmaz.",
    "flavor": "Geçici bir ateşkes ilan edildi."
  },
  "blessed-waters": {
    "name": "Kutsal Sular",
    "description": "3–6. yataylar arasında rastgele bir kare kutsanır. Üzerindeki taş 3 tur alınamaz.",
    "flavor": "Sular seçileni korur."
  },
  "lost-mercenary": {
    "name": "Kayıp Paralı Asker",
    "description": "Turuncu bir paralı piyon sol kanatta belirir. Her tam hamleden sonra doğuya yürür veya görüşle alır (V>K>A>F>P). Şah alamaz. Son dosyaya ulaşınca bir sonraki tam hamlede gider.",
    "flavor": "Sancak yok, efendi yok — yalnızca sonraki kare."
  },
  "cold-winds": {
    "name": "Soğuk Rüzgarlar",
    "description": "Her oyuncudan 2 rastgele taş (şah hariç) donar; 1 tur hareket edemez.",
    "flavor": "Savaş alanı sessizleşir."
  },
  "stock-crash": {
    "name": "Borsa Çöküşü",
    "description": "Her iki oyuncu 10 altın kaybeder.",
    "flavor": "Piyasalar konuştu."
  },
  "great-wall-of-hatay": {
    "name": "Hatay'ın Büyük Duvarı",
    "description": "3 ardışık boş kare (yatay veya dikey) 2 tur duvarlanır; taş giremez veya geçemez. Geçerli aralık yoksa etkisiz.",
    "flavor": "Bir gece duvar yükselir."
  },
  "tactical-nuke": {
    "name": "Taktik Nükleer Saldırı",
    "description": "Rastgele 3×3 alan hedeflenir. İçindeki tüm taşlar 5 tur sonra yok edilir.",
    "flavor": "\"Geliyor!\""
  },
  "mercenary-patrol": {
    "name": "Paralı Asker Devriyesi",
    "description": "Sol ve sağ dosyalarda iki turuncu paralı at belirir. Her tam turda rastgele yasal at hamlesi yaparlar. Şah alamaz, monolithe basamaz.",
    "flavor": "Karanlıkta nal sesleri — sadakat yok, dinlenme yok."
  },
  "red-wedding": {
    "name": "Kızıl Düğün",
    "description": "Her oyuncudan 2 rastgele piyon öldürülür.",
    "flavor": "\"Lannisterlar selamlarını yollar.\""
  },
  "siege-patrol": {
    "name": "Kuşatma Devriyesi",
    "description": "Sol ve sağ kanatlarda turuncu paralı at ve kale belirir. Her tam turda diğer paralılar gibi rastgele yasal hamle yaparlar.",
    "flavor": "Savaş makineleri — sancak yok, efendi yok."
  },
  "just-chaos": {
    "name": "Sadece Kaos",
    "description": "Tahta olayları artık her 5 tam turda bir tetiklenir (rastgele 5–13 yerine), oyun sonuna kadar.",
    "flavor": "\"Dünya yansın.\""
  },
  "crusaders": {
    "name": "Haçlılar",
    "description": "Dört turuncu paralı — vezir, fil, at ve kale — iç karelerde belirir. Deus Vult.",
    "flavor": "Deus Vult."
  },
  "winter-has-come": {
    "name": "Kış Geldi",
    "description": "Rastgele boş bir kare sonsuza kadar donar; taş basamaz/geçemez; piyon dükkanı vb. engellenir.",
    "flavor": "Soğuk hatırlar."
  },
  "valar-morghulis": {
    "name": "Valar Morghulis",
    "description": "Normal beyaz ve siyah piyonlar tahtadan kaldırılır. Turuncu paralı piyonlar kalır. Piyon olan İlkkan temizlenir.",
    "flavor": "Hepimiz öleceğiz."
  }
} as Record<string, EventLocaleEntry>;
