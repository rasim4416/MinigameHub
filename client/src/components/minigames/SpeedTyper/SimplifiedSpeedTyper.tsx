import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home, Trophy, Clock, PauseCircle, PlayCircle, AlertTriangle, Ban, Award, ArrowUp } from 'lucide-react';
import { useAudio } from '@/lib/stores/useAudio';
import { useLevelMode, levelThresholds } from '@/lib/stores/useLevelMode';

// Define a type for falling words
interface FallingWord {
  id: string;
  word: string;
  x: number;  // horizontal position (%)
  y: number;  // vertical position (%)
  speed: number; // falling speed
  color: string; // text color
}

// List of word colors with enhanced visual effects
const wordColors = [
  'text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.7)]',
  'text-green-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.7)]',
  'text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.7)]',
  'text-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]',
  'text-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.7)]',
  'text-indigo-500 drop-shadow-[0_0_10px_rgba(99,102,241,0.7)]',
  'text-teal-500 drop-shadow-[0_0_10px_rgba(20,184,166,0.7)]',
  'text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.7)]',
  'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.7)]',
];

// Word banks for different languages
const wordBanks = {
  english: [
    // Common 3-letter words
    "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", 
    "had", "her", "was", "one", "our", "out", "day", "get", "has", "him",
    "his", "how", "new", "now", "old", "see", "two", "way", "who", "eye",
    "act", "add", "age", "air", "arm", "art", "ask", "bad", "bag", "bar",
    "bed", "bet", "big", "bit", "box", "boy", "bus", "car", "cat", "cup",
    "cut", "dad", "dog", "dry", "due", "ear", "eat", "egg", "end", "far",
    "fat", "few", "fit", "fly", "fun", "gas", "gun", "guy", "hit", "hot",
    "ice", "job", "joy", "key", "kid", "lay", "leg", "let", "lie", "lip",
    "low", "map", "mom", "mud", "net", "odd", "oil", "pay", "pen", "pet",
    "pie", "pin", "pop", "put", "red", "rub", "run", "sad", "sea", "set",
    "sex", "shy", "sin", "sit", "six", "ski", "sky", "son", "sun", "tax",
    "tea", "ten", "tip", "toe", "top", "try", "use", "war", "win", "yes",
    "yet", "zoo",
    
    // Common 4-letter words
    "book", "game", "life", "time", "year", "work", "code", "play", "fast",
    "slow", "good", "last", "long", "make", "many", "more", "most", "only",
    "over", "very", "word", "love", "help", "find", "look", "hand", "part",
    "able", "acid", "aged", "also", "area", "army", "away", "baby", "back",
    "ball", "band", "bank", "base", "bath", "bear", "beat", "been", "beer",
    "bell", "belt", "best", "bill", "bird", "blow", "blue", "boat", "body",
    "bomb", "bond", "bone", "born", "both", "bowl", "bulk", "burn", "bush",
    "busy", "cake", "call", "calm", "came", "camp", "card", "care", "case",
    "cash", "cast", "cell", "chat", "chef", "chip", "city", "club", "coal",
    "coat", "cold", "come", "cook", "cool", "cope", "copy", "core", "cost",
    "crew", "crop", "dark", "data", "date", "dawn", "days", "dead", "deal",
    "dear", "debt", "deep", "deny", "desk", "dial", "diet", "dirt", "dish",
    "disk", "does", "done", "door", "dose", "down", "draw", "drop", "drug",
    "dual", "duke", "dust", "duty", "each", "earn", "ease", "east", "easy",
    "edge", "else", "even", "ever", "evil", "exit", "face", "fact", "fade",
    "fail", "fair", "fall", "farm", "fear", "feel", "feet", "fell", "felt",
    "file", "fill", "film", "fire", "firm", "fish", "five", "flag", "flat",
    "flow", "folk", "food", "foot", "form", "fort", "four", "free", "from",
    "fuel", "full", "fund", "gain", "gave", "gear", "gift", "girl", "give",
    "glad", "goal", "goes", "gold", "golf", "gone", "grew", "grey", "grow",
    "gulf", "hair", "half", "hall", "hang", "hard", "harm", "hate", "have",
    "head", "hear", "heat", "held", "hell", "here", "hero", "high", "hill",
    "hire", "hold", "hole", "holy", "home", "hope", "host", "hour", "huge",
    "hung", "hunt", "hurt", "idea", "inch", "into", "iron", "item", "java", 
    "join", "jump", "jury", "just", "keen", "keep", "kick", "kill", "kind", 
    "king", "knew", "know", "lack", "lady", "laid", "lake", "land", "lane", 
    "lead", "left", "less", "like", "line", "link", "list", "live", "load", 
    "loan", "lock", "logo", "went", "west", "what", "when", "whom", "wide", 
    "wife", "wild", "will", "wind", "wine", "wing", "wire", "wise", "wish", 
    "with", "wood", "wool", "wore", "work", "yard", "yeah", "year", "your", 
    "zero", "zone",
    
    // Common 5-letter words
    "after", "again", "about", "below", "could", "every", "first", "found",
    "great", "house", "large", "learn", "never", "other", "place", "plant",
    "point", "right", "small", "sound", "spell", "still", "study", "think",
    "water", "where", "which", "world", "would", "write", "happy", "peace",
    "black", "board", "brave", "break", "bring", "build", "built", "carry",
    "catch", "cause", "chain", "chair", "chart", "chase", "cheap", "check",
    "chest", "chief", "child", "chose", "civil", "claim", "class", "clean",
    "clear", "clock", "close", "coach", "coast", "color", "count", "court",
    "cover", "crash", "crazy", "cream", "crime", "cross", "crowd", "crown",
    "cycle", "daily", "dance", "dated", "dealt", "death", "dozen", "draft",
    "drama", "drawn", "dream", "dress", "drink", "drive", "dying", "eager",
    "early", "earth", "eight", "elite", "empty", "enemy", "enjoy", "enter",
    "entry", "equal", "error", "event", "exact", "exist", "extra", "power", 
    "press", "price", "pride", "prime", "print", "prior", "prize", "proof", 
    "proud", "prove", "queen", "quick", "quiet", "quite", "radio", "raise", 
    "range", "rapid", "ratio", "reach", "ready", "refer", "right", "rival", 
    "river", "robin", "robot", "rocky", "rough", "round", "route", "royal", 
    "rural", "scale", "scene", "scope", "score", "sense", "serve", "seven", 
    "shade", "shake", "shall", "shape", "share", "sharp", "sheep", "sheer", 
    "sheet", "shelf", "shell", "shift", "shirt", "shock", "shoot", "short", 
    "shown", "sight", "since", "sixty", "sized", "skill", "sleep", "slide", 
    "small", "smart", "smile", "smith", "smoke", "solid", "solve", "sorry", 
    "sound", "south", "space", "spare", "speak", "speed", "spend", "spent", 
    "split", "spoke", "sport", "staff", "stage", "stake", "stand", "women", 
    "woken", "worth", "wound", "woven", "yacht", "young", "youth", "zeros",
    
    // Longer words (6-8 letters)
    "around", "because", "between", "brought", "certain", "enough", "example",
    "explain", "message", "picture", "program", "quality", "receive", "science",
    "someone", "student", "success", "support", "through", "understand",
    "ability", "absence", "academy", "account", "accused", "achieve", "acquire",
    "address", "advance", "advised", "adviser", "against", "airline", "airport",
    "alcohol", "alleged", "already", "analyst", "ancient", "another", "anxiety",
    "anxious", "anybody", "applied", "arrange", "arrival", "article", "assault",
    "assumed", "assured", "attempt", "attract", "auction", "average", "backing",
    "balance", "banking", "barrier", "battery", "bearing", "beating", "because",
    "bedroom", "believe", "beneath", "benefit", "besides", "between", "biggest",
    "billion", "binding", "brother", "brought", "burning", "cabinet", "caliber",
    "calling", "capable", "capital", "captain", "caption", "capture", "careful",
    "carrier", "caution", "ceiling", "central", "centric", "century", "certain",
    "chamber", "channel", "chapter", "charity", "charlie", "charter", "checked",
    "chicken", "chronic", "circuit", "citizen", "clarity", "classic", "climate",
    "closely", "clothes", "cluster", "coastal", "comfort", "command", "comment",
    "compact", "company", "compare", "compete", "complex", "concept", "concern",
    "concert", "conduct", "confirm", "connect", "consent", "consist", "console",
    "contact", "contain", "content", "contest", "context", "control", "convert",
    "correct", "council", "counsel", "counter", "country", "crucial", "crystal",
    "culture", "current", "cutting", "dealing", "decided", "decline", "default",
    "defence", "deficit", "deliver", "density", "deposit", "desktop", "despite",
    "destroy", "develop", "devoted", "summary", "sunrise", "waiting", "welfare", 
    "windows", "without", "witness", "workers", "working", "writing", "written",
    
    // Tech-related words
    "coding", "browser", "computer", "software", "keyboard", "website", "internet",
    "network", "database", "function", "variable", "algorithm", "framework",
    "digital", "virtual", "amazing", "explore", "develop", "creative", "learning",
    "access", "analog", "anchor", "backup", "binary", "bitmap", "buffer", "bundle",
    "button", "bypass", "cached", "client", "column", "cookie", "cursor",
    "device", "dialog", "domain", "driver", "engine", "entity", "export", "filter",
    "folder", "format", "global", "header", "import", "inputs", "insert", "kernel",
    "linker", "logger", "memory", "method", "module", "object", "packet", "parser",
    "plugin", "portal", "prefix", "prompt", "python", "render", "router", "script",
    "sector", "server", "socket", "source", "static", "stream", "string", "struct",
    "syntax", "system", "tablet", "thread", "toggle", "upload", "vector", "widget"
  ],
  
  türkçe: [
    // Common 3-letter Turkish words
    "bir", "çok", "göz", "yol", "son", "gün", "bak", "iki", "ben", "sen", 
    "git", "gel", "yer", "sev", "ara", "bul", "yap", "sor", "ver", "dün",
    "acı", "adı", "ağa", "ana", "art", "aşk", "bal", "baş", "bay", "bez",
    "biz", "boş", "buz", "cam", "can", "cep", "çay", "çek", "dağ", "dal",
    "dam", "dil", "diş", "duş", "düz", "ebe", "ele", "erk", "ers", "evi",
    "eşi", "eli", "far", "fal", "fes", "göl", "güç", "güz", "hal", "ham",
    "has", "hat", "hep", "her", "his", "hoş", "hız", "içi", "iyi", "ile",
    "ilk", "iri", "işe", "kel", "kız", "kim", "kir", "köy", "kum", "kuş",
    "kül", "laf", "leke", "lüks", "mal", "maç", "mum", "net", "not", "oda",
    "oku", "onu", "oto", "ova", "öne", "öte", "pas", "pek", "pul", "raf",
    "rol", "sağ", "sal", "sat", "sel", "ses", "sık", "sır", "sol", "son",
    "süt", "şah", "şal", "şey", "taç", "tam", "tas", "taş", "tel", "tem",
    "ten", "tez", "top", "toz", "tüm", "tür", "tüy", "ucu", "uçak", "ulu",
    "unu", "uyan", "uyu", "uza", "uzak", "var", "vay", "vur", "yağ", "yak",
    "yan", "yaş", "yel", "yen", "yeşil", "yok", "yön", "yüz", "zam", "zar",
    "zil", "zor",
    
    // Common 4-letter Turkish words
    "daha", "hava", "çalı", "gece", "ayak", "balık", "anne", "baba", "kedi",
    "köpek", "masa", "kapı", "yemek", "ağaç", "deniz", "ayna", "boya", "kova",
    "toka", "okul", "renk", "sevgi", "güzel", "kitap", "kalem", "defter",
    "acele", "açık", "adam", "adım", "ağır", "ahır", "aile", "akıl", "aksi",
    "alan", "alçı", "alem", "algı", "alma", "altı", "amca", "anıt", "anma",
    "aptal", "araç", "arka", "artı", "arzu", "asal", "asıl", "asır", "atak",
    "ateş", "atıf", "atık", "avlu", "ayna", "ayva", "azim", "azot", "bahar",
    "bahçe", "bakım", "baki", "bala", "balkon", "bamya", "bant", "bardak",
    "barış", "basit", "baskı", "başak", "başkan", "batı", "batık", "bavul",
    "bayır", "bebek", "beden", "bekçi", "bela", "belge", "belki", "belli",
    "bellik", "benek", "bent", "bere", "bereket", "beri", "beton", "beyin",
    "beyaz", "beşik", "bilgi", "bilet", "bilim", "bilye", "bina", "birim",
    "bitki", "bitim", "bomba", "borç", "borsa", "boşluk", "boyun", "boyut",
    "bozkır", "bölge", "bölüm", "börek", "buçuk", "budak", "buğday", "buhar",
    "buhran", "burun", "butik", "buton", "bütçe", "bütün", "büyük", "cami",
    "canavar", "canlı", "caps", "ceket", "cesur", "cevap", "ceza", "cılız",
    "cihan", "cimri", "cinli", "cisim", "coşku", "cüzdan", "çaba", "çadır",
    "çakal", "çakmak", "çalar", "çalı", "çalım", "çanak", "çanta", "çapa",
    "çare", "çarşı", "çatal", "çatı", "çekim", "çekiç", "çelik", "çeşit",
    "çevre", "çeyiz", "çığır", "çıkar", "çıkış", "çiçek", "çifçi", "çiğli",
    "çizgi", "çizim", "çocuk", "çoğul", "çorap", "çöküş", "çözüm", "daire",
    "damat", "damla", "darbe", "dava", "davul", "delik", "denge", "dergi",
    
    // Common 5-letter Turkish words
    "bugün", "yarın", "sonra", "önce", "beyaz", "siyah", "elma", "armut",
    "üzüm", "kiraz", "kaşık", "çatal", "kenar", "fırın", "tarih", "müzik",
    "çiçek", "yaprak", "toprak", "tohum", "lamba", "ışık", "yıldız", "bulut",
    "abiye", "açgöz", "açlık", "adres", "afili", "afiş", "ahşap", "akran",
    "alarm", "albüm", "alçak", "alıcı", "alıntı", "alkış", "alman", "altın",
    "ambar", "amber", "amblem", "amele", "ampul", "anket", "anlam", "ansız",
    "antik", "apolet", "araba", "arama", "arazi", "ardıç", "arena", "argın",
    "arıza", "arife", "arşiv", "aseton", "asker", "aslında", "astım", "aşçı",
    "aşırı", "atlas", "atmak", "avize", "avukat", "ayran", "azade", "azami",
    "bağırma", "bahis", "bakır", "bakkal", "balans", "balkan", "bando", "banyo",
    "baraj", "baskül", "basınç", "başlık", "batarya", "batık", "battı", "bayat",
    "bayır", "bazen", "bebek", "bedel", "beğeni", "bekçi", "belge", "belki",
    "bemol", "benek", "benzin", "berber", "besin", "beste", "beşeri", "betim",
    "beyin", "bıçak", "biber", "bıyık", "bilim", "bilir", "binek", "birey",
    "birik", "birlik", "bitiş", "bitki", "boğaz", "boğum", "bomba", "boran",
    "borçlu", "borda", "borsa", "boşluk", "boyun", "bozkır", "bölge", "bölüm",
    "börek", "bronz", "bucak", "budak", "buğday", "buğulu", "bugün", "buhran",
    "bukle", "bulaşık", "bulma", "buluş", "bungun", "burak", "burjuva", "burun",
    "butik", "büyü", "büyük", "canan", "canlı", "cariye", "cazibe", "cedvel",
    "ceket", "cellat", "cennet", "cephe", "ceren", "cesur", "cevap", "cevher",
    "ceviz", "ceylan", "cıvata", "ciğer", "cimri", "cinsel", "cisim", "cömert",
    "curcuna", "cümle", "çabuk", "çadır", "çağrı", "çakal", "çakmak", "çalar",
    "çalgı", "çanak", "çanta", "çardak", "çarşı", "çatı", "çatış", "çaycı",
    "çekim", "çekiş", "çekül", "çelik", "çember", "çenber", "çenen", "çeper",
    
    // Longer words (6-8 letters)
    "telefon", "bilgisayar", "internet", "kütüphane", "hastane", "öğrenci",
    "öğretmen", "arkadaş", "kelebek", "böcek", "balina", "yunus", "ördek",
    "martı", "güneş", "gezegen", "başarı", "mutluluk", "sağlık", "yaşam",
    "abartı", "abartma", "abartmak", "abone", "abonelik", "acayip", "acele", 
    "aceleyle", "aceleci", "acemi", "acemilik", "acente", "acıklı", "acıkmak", 
    "aciliyet", "acilen", "acıma", "açıklama", "açılış", "açlık", "adalet", 
    "adaletli", "adaletsiz", "aday", "adımlama", "adlandırma", "affetmek", 
    "aforizma", "afsane", "ağırbaşlı", "ağırlamak", "ağırlık", "ağlamak", 
    "aheste", "ahlaki", "ahşap", "ailece", "akılcı", "akıllı", "akılsız", 
    "aklama", "akmak", "akraba", "aktarma", "aktüel", "aktüerya", "akustik", 
    "alacaklı", "alakalı", "alakasız", "alamet", "alansal", "alaturka", 
    "alaycı", "albeni", "albino", "aldanma", "aldatma", "aldırmaz", "algılama", 
    "alıcı", "alımlı", "alındı", "alıntı", "alışkanlık", "alıştırma", "alkış", 
    "almak", "almanca", "altyapı", "ambalaj", "anadolu", "analist", "analiz", 
    "analjezik", "anason", "anayasa", "ancemin", "andante", "angarya", 
    "anırmak", "anıtsal", "anlamak", "anlaşma", "anlaşmak", "anlatan", "anma", 
    "anormallik", "ansızın", "antika", "antikacı", "antrakt", "antrenman", 
    "anzarot", "apaçık", "apayrı", "apartman", "aplike", "apolet", "apolitik",
    
    // Tech-related Turkish words
    "ekran", "klavye", "fare", "yazılım", "uygulama", "veri", "bellek", 
    "bağlantı", "tarayıcı", "işlemci", "yüklemek", "indirmek", "çevrimiçi",
    "kablosuz", "dijital", "sanal", "dosya", "klasör", "şifre", "hesap",
    "adres", "adware", "ağgeçidi", "ağzembereği", "akışhızı", "algoritma", 
    "alfabetik", "anahat", "analiz", "anamenu", "anahtar", "android", "animasyon", 
    "antivirüs", "aradisim", "arakimliği", "aramaçubuğu", "aramba", "aramucu", 
    "arayüz", "arşivleme", "artalan", "ayarlar", "bakmak", "başlangıç", 
    "başlık", "belge", "benioku", "benizbankı", "biçimlemek", "bilgisayar", 
    "birleşim", "bulut", "bütünlük", "çalıştırmak", "çerezler", "derleyici",
    "dikte", "diskimdülleyici", "doğrulama", "doküman", "donanım", "dönüştürücü", 
    "dosya", "döşeme", "etiket", "evhayvanı", "fişleme", "forum", "genişletme", 
    "gezgin", "girdi", "görüntü", "gösterge", "gözatma", "grafik", "güncelleme", 
    "güvenlik", "hareketlidosya", "hatakodu", "havalı", "hesaplama", "ikon",
    "iletişim", "imleç", "işlemci", "işlevsel", "istisna", "iyiyazılım", 
    "izleme", "karakter", "karşıdan", "kaydedici", "kayıt", "kaynakça", 
    "kısayol", "klasör", "kodlama", "köprü", "kurabiye", "masaüstü", "metin", 
    "modem", "montaj", "motor", "mültimedya", "oturum", "oyun", "paket", 
    "paradizimi", "parola", "paylaşım", "program", "pusu", "sabitdisk", 
    "sayısaluçurum", "sekme", "senkronizasyon", "sertifika", "sıfırlama", 
    "sıkıştırılmış", "simge", "slayt", "sürücü", "sürüm", "tarayıcı", "tıklama", 
    "tutkalbellegi", "tuş", "ücretli", "üstveri", "varsayılan", "vektör", 
    "veri", "virüs", "yama", "yazdırma", "yazılım", "yedekleme", "yönlendirici"
  ]
};

// Generate a random word from the word bank based on selected language
const getRandomWord = (lang: Language): string => {
  const words = wordBanks[lang];
  return words[Math.floor(Math.random() * words.length)];
};

// Generate a unique ID for a word
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

// Word spawn rates as multipliers
type SpawnRateMultiplier = 0.25 | 0.5 | 1 | 1.25 | 1.5 | 2 | 2.5 | 3;
type Language = 'english' | 'türkçe';
type GameMode = 'falling' | 'linear' | 'level';

const SimplifiedSpeedTyper: React.FC = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wordSpawnerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  
  // Game state
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [fallingWords, setFallingWords] = useState<FallingWord[]>([]);
  const [spawnRate, setSpawnRate] = useState<SpawnRateMultiplier>(1);
  const [language, setLanguage] = useState<Language>('english');
  const [gameMode, setGameMode] = useState<GameMode>('falling');
  
  // Linear mode specific state
  const [linearQueue, setLinearQueue] = useState<string[]>([]);
  const [currentLinearWord, setCurrentLinearWord] = useState<string>('');
  
  // Level mode state
  const {
    currentLevel,
    targetScore,
    score: levelScore,
    isLevelCompleted,
    isLevelTransition,
    isPlaying: isLevelPlaying,
    setCurrentLevel,
    setScore: setLevelScore,
    incrementScore: incrementLevelScore,
    setLevelCompleted,
    setLevelTransition,
    setPlaying: setLevelPlaying,
    advanceToNextLevel,
    resetLevel,
    resetGame: resetLevelGame
  } = useLevelMode();
  
  // UI styles based on language
  const gameBackground = language === 'english' 
    ? 'bg-gradient-to-b from-blue-900/20 to-purple-900/20' 
    : 'bg-gradient-to-b from-red-900/20 to-orange-900/20';
  
  // Sound effects
  const { playHit, playSuccess } = useAudio();

  // Timer effect
  useEffect(() => {
    console.log("Timer effect running, isPlaying:", isPlaying, "isPaused:", isPaused);
    
    // Only run the timer when game is playing and not paused
    if (isPlaying && !isPaused) {
      console.log("Starting new unified game loop");
      
      // Start time for level tracking
      const startTime = Date.now();
      console.log("Starting countdown - initial timeLeft:", timeLeft);
      
      // Clear existing timer if any
      if (timerRef.current) {
        console.log("Clearing existing timer");
        clearInterval(timerRef.current);
      }
      
      console.log("Setting up new timer with startTime:", startTime, "initialTimeLeft:", timeLeft);
      
      timerRef.current = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        console.log("Timer tick - elapsed:", elapsedSeconds, "new time left:", timeLeft - elapsedSeconds);
        
        setTimeLeft((prevTime) => {
          const newTime = Math.max(0, timeLeft - elapsedSeconds);
          
          // When time runs out
          if (newTime <= 0) {
            if (gameMode === 'level') {
              // In level mode, check if we reached the target score
              if (score >= targetScore) {
                // Level completed - advance to next level
                setLevelCompleted(true);
                setLevelTransition(true);
                playSuccess();
                
                // Don't end the game yet, we'll handle this in a separate effect
                return 0;
              } else {
                // Failed to reach target - game over
                if (timerRef.current) clearInterval(timerRef.current);
                if (wordSpawnerRef.current) clearInterval(wordSpawnerRef.current);
                if (animationRef.current) clearInterval(animationRef.current);
                setIsGameOver(true);
                setIsPlaying(false);
                setLevelPlaying(false);
                playSuccess();
                return 0;
              }
            } else {
              // Regular game modes - game over
              if (timerRef.current) clearInterval(timerRef.current);
              if (wordSpawnerRef.current) clearInterval(wordSpawnerRef.current);
              if (animationRef.current) clearInterval(animationRef.current);
              setIsGameOver(true);
              setIsPlaying(false);
              playSuccess();
              return 0;
            }
          }
          
          return prevTime - 1;
        });
      }, 1000);
      
      // Clean up
      return () => {
        if (timerRef.current) {
          console.log("Cleaning up timer interval");
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [isPlaying, isPaused, gameMode, score, targetScore, timeLeft, playSuccess, setLevelCompleted, setLevelTransition, setLevelPlaying]);

  // Clean up function for all timers
  const cleanupTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (wordSpawnerRef.current) {
      clearInterval(wordSpawnerRef.current);
      wordSpawnerRef.current = null;
    }
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
  };
  
  // Initialize linear mode
  const initializeLinearMode = () => {
    // Generate a queue of words
    const wordQueue = Array.from({ length: 20 }, () => getRandomWord(language));
    
    // Set the initial queue and current word
    setLinearQueue(wordQueue);
    setCurrentLinearWord(wordQueue[0]);
    
    // Focus the input field
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };
  
  // Process the linear queue (move to next word)
  const processLinearQueue = () => {
    setLinearQueue(queue => {
      const newQueue = [...queue];
      newQueue.shift(); // Remove the first word
      
      // Check if we need to add more words
      if (newQueue.length < 10) {
        const additionalWords = Array.from(
          { length: 10 }, 
          () => getRandomWord(language)
        );
        newQueue.push(...additionalWords);
      }
      
      // Set the new current word
      setCurrentLinearWord(newQueue[0] || '');
      
      return newQueue;
    });
  };
  
  // Add more words to linear queue when needed
  const addToLinearQueue = () => {
    setLinearQueue(currentQueue => {
      // Only add more if queue is getting smaller
      if (currentQueue.length < 10) {
        // Add 10 more words
        const newWords = Array.from({ length: 10 }, () => getRandomWord(language));
        return [...currentQueue, ...newWords];
      }
      return currentQueue;
    });
  };
  
  // Effect to handle level transitions
  useEffect(() => {
    if (gameMode === 'level' && isLevelTransition) {
      // Show level completion screen for a few seconds, then start next level
      const transitionDelay = setTimeout(() => {
        // Advance to next level
        advanceToNextLevel();
        
        // Reset game state for next level
        setTimeLeft(60);
        setLinearQueue([]);
        setCurrentLinearWord('');
        setInputValue('');
        
        // Start the next level
        initializeLinearMode();
        setLevelTransition(false);
        
        // Focus input field
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }, 3000); // 3 second delay before starting next level
      
      return () => clearTimeout(transitionDelay);
    }
  }, [isLevelTransition, gameMode, advanceToNextLevel, setLevelTransition, initializeLinearMode]);
  
  // Start the game
  const handleStartGame = () => {
    console.log("Starting game with super simplified approach");
    
    // Reset standard game state
    setScore(0);
    setTimeLeft(60);
    setIsGameOver(false);
    setIsPaused(false);
    setFallingWords([]);
    setLinearQueue([]);
    setCurrentLinearWord('');
    setInputValue('');
    setIsPlaying(true);
    
    // Handle level mode specific setup
    if (gameMode === 'level') {
      // Reset level state
      resetLevelGame();
      setLevelPlaying(true);
      initializeLinearMode();
    } 
    // Standard modes
    else if (gameMode === 'falling') {
      // Start spawning words
      startWordSpawner();
      
      // Start falling animation
      startFallingAnimation();
    } else {
      // Initialize linear mode
      initializeLinearMode();
    }
    
    // Focus the input field
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };
  
  // Start the word spawner
  const startWordSpawner = () => {
    // Clear any existing spawner
    if (wordSpawnerRef.current) clearInterval(wordSpawnerRef.current);
    
    // Calculate spawn interval based on the multiplier (in milliseconds)
    // Base time is 1 second for 1x spawn rate
    const baseSpawnTime = 1000; // 1 second base time for 1x spawn rate
    const spawnInterval = Math.round(baseSpawnTime / spawnRate);
    
    // Start spawning words
    wordSpawnerRef.current = setInterval(() => {
      if (!isPaused) {
        // Create a new word using the current language
        const newWord: FallingWord = {
          id: generateId(),
          word: getRandomWord(language),
          x: Math.random() * 80 + 10, // Position between 10% and 90% horizontally
          y: 0, // Start at the top
          speed: 1 * spawnRate, // Speed scales with spawn rate
          color: wordColors[Math.floor(Math.random() * wordColors.length)]
        };
        
        // Add the word to the falling words array
        setFallingWords(words => [...words, newWord]);
      }
    }, spawnInterval);
    
    return () => {
      if (wordSpawnerRef.current) clearInterval(wordSpawnerRef.current);
    };
  };
  
  // Animate falling words
  const startFallingAnimation = () => {
    // Clear any existing animation
    if (animationRef.current) clearInterval(animationRef.current);
    
    // Set animation frame rate
    const frameRate = 50; // ms per frame
    
    // Start animation loop
    animationRef.current = setInterval(() => {
      if (!isPaused) {
        setFallingWords(words => {
          // Move each word down based on its speed
          const updatedWords = words.map(word => ({
            ...word,
            y: word.y + word.speed
          }));
          
          // Remove words that have fallen off the bottom
          const remainingWords = updatedWords.filter(word => word.y < 100);
          
          // If a word was removed (reached the bottom), reduce score slightly
          if (remainingWords.length < updatedWords.length) {
            setScore(s => Math.max(0, s - 5));
          }
          
          return remainingWords;
        });
      }
    }, frameRate);
    
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  };
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  // Handle form submission (when user presses enter)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (inputValue.trim()) {
      if (gameMode === 'falling') {
        // Falling words mode: check for any matching word
        const matchedWordIndex = fallingWords.findIndex(
          word => word.word.toLowerCase() === inputValue.toLowerCase()
        );
        
        if (matchedWordIndex !== -1) {
          // Found a match
          const matchedWord = fallingWords[matchedWordIndex];
          
          // Remove the matched word
          setFallingWords(words => words.filter(w => w.id !== matchedWord.id));
          
          // Add points based on word length and spawn rate
          const basePoints = matchedWord.word.length * 5;
          // Higher spawn rate gives more points
          const spawnRateMultiplier = Math.min(spawnRate * 1.2, 3);
          const pointsToAdd = Math.floor(basePoints * spawnRateMultiplier);
          
          setScore(s => s + pointsToAdd);
          
          // Play hit sound
          playHit();
        }
      } else {
        // Linear/Level modes: check against the current word
        if (inputValue.toLowerCase() === currentLinearWord.toLowerCase()) {
          // Correct word typed
          
          // Add points based on word length
          const basePoints = currentLinearWord.length * 5;
          
          // Add time bonus - add 1 second for each letter in the word
          const timeBonus = currentLinearWord.length;
          
          // Directly update the time remaining (to fix the time bonus issue)
          setTimeLeft(currentTime => {
            return currentTime + timeBonus;
          });
          
          // Update regular score
          const pointsToAdd = basePoints;
          setScore(s => s + pointsToAdd);
          
          // For level mode, also update the level score
          if (gameMode === 'level') {
            incrementLevelScore(pointsToAdd);
          }
          
          // Play hit sound
          playHit();
          
          // Process the queue (move to next word)
          processLinearQueue();
        } else if (inputValue.trim() !== '') {
          // Incorrect word typed (but not empty input) - skip to next word
          // Play a softer hit sound (or could add a miss sound later)
          playHit();
          
          // Process the queue (move to next word)
          processLinearQueue();
        }
      }
      
      // Clear input field
      setInputValue('');
    }
  };
  
  // Handle game mode change
  const handleGameModeChange = (mode: GameMode) => {
    if (!isPlaying || isPaused) {
      setGameMode(mode);
    }
  };
  
  // Toggle pause
  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    
    // Focus input when resuming
    if (isPaused) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };
  
  // Instantly end the game (give up)
  const handleGiveUp = () => {
    if (isPlaying) {
      // Clear any timers
      if (timerRef.current) clearInterval(timerRef.current);
      if (wordSpawnerRef.current) clearInterval(wordSpawnerRef.current);
      if (animationRef.current) clearInterval(animationRef.current);
      
      // Set game over state
      setIsGameOver(true);
      setIsPlaying(false);
      playSuccess(); // Play success sound as feedback
    }
  };
  
  // Handle spawn rate change
  const handleSpawnRateChange = (rate: SpawnRateMultiplier) => {
    if (!isPlaying || isPaused) {
      setSpawnRate(rate);
      
      // Restart word spawner if game is paused
      if (isPlaying && isPaused) {
        if (wordSpawnerRef.current) {
          clearInterval(wordSpawnerRef.current);
          wordSpawnerRef.current = null;
        }
        startWordSpawner();
      }
    }
  };
  
  // Handle language change
  const handleLanguageChange = (lang: Language) => {
    if (!isPlaying || isPaused) {
      setLanguage(lang);
    }
  };
  
  // Go back to menu
  const handleBackToMenu = () => {
    // Clean up any timers
    cleanupTimers();
    playSuccess();
    navigate('/minigames');
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine time color based on remaining time
  const getTimeColor = (seconds: number): string => {
    if (seconds <= 10) return 'text-red-500';
    if (seconds <= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top section with game stats */}
      <div className="p-4 flex justify-between items-center bg-card rounded-t-lg border-b border-border">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span className="font-semibold">Score:</span>
          <span className="text-lg font-bold text-primary">{score}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          <span className="font-semibold">Time:</span>
          <span className={`text-lg font-bold ${getTimeColor(timeLeft)}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>
      
      {/* Game area with language-specific background */}
      <div className={cn("relative flex-1 rounded-lg overflow-hidden", gameBackground)}>
        {isPlaying ? (
          <>
            {/* Game display based on mode */}
            {gameMode === 'falling' ? (
              // Falling words mode
              <div className="falling-words-container absolute inset-0">
                {fallingWords.map((word) => (
                  <div
                    key={word.id}
                    className={cn(
                      "absolute font-bold transform -translate-x-1/2 transition-opacity duration-300",
                      word.color,
                      isPaused ? "animate-none" : ""
                    )}
                    style={{
                      left: `${word.x}%`,
                      top: `${word.y}%`,
                      // Apply font size based on word length - shorter words are bigger
                      fontSize: `${Math.max(22, 30 - word.word.length * 2)}px`,
                      // Add a subtle glow effect
                      textShadow: '0 0 5px currentColor',
                      opacity: isPaused ? 0.7 : 1
                    }}
                  >
                    {word.word}
                  </div>
                ))}
              </div>
            ) : (
              // Linear mode - train of words
              <div className="linear-words-container absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  {/* Current word to type */}
                  <div 
                    className="text-5xl font-bold mb-8"
                    style={{
                      textShadow: '0 0 8px currentColor',
                      color: '#3b82f6'
                    }}
                  >
                    {currentLinearWord}
                  </div>
                  
                  {/* Upcoming words */}
                  <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                    {linearQueue.slice(1, 6).map((word, index) => (
                      <div 
                        key={index} 
                        className="px-3 py-1 rounded bg-background/40 text-foreground/80 text-lg"
                        style={{
                          opacity: 1 - (index * 0.15)
                        }}
                      >
                        {word}
                      </div>
                    ))}
                  </div>
                  
                  {/* Instructions */}
                  <div className="mt-8 text-sm opacity-75">
                    {language === 'english'
                      ? 'Type the word above and press Enter → Get more time → Keep going!'
                      : 'Yukarıdaki kelimeyi yazın ve Enter tuşuna basın → Daha fazla zaman kazanın → Devam edin!'
                    }
                  </div>
                </div>
              </div>
            )}
            
            {/* Input field for typing */}
            <form 
              onSubmit={handleSubmit} 
              className="absolute bottom-4 left-0 right-0 z-10 px-4"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                disabled={isPaused || isGameOver}
                className="w-full max-w-md mx-auto px-4 py-2 border-2 border-primary/50 rounded-md bg-background/90 text-foreground text-center text-lg font-medium focus:border-primary focus:outline-none"
                placeholder="Type words and press Enter..."
                autoComplete="off"
                spellCheck="false"
              />
            </form>
            
            {/* Pause overlay */}
            {isPaused && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
                <div className="text-center">
                  <h3 className="text-3xl font-bold mb-4">
                    {language === 'english' ? 'Game Paused' : 'Oyun Duraklatıldı'}
                  </h3>
                  <button
                    onClick={handleTogglePause}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
                  >
                    {language === 'english' ? 'Resume' : 'Devam Et'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Level completion overlay */}
            {isLevelCompleted && isLevelTransition && (
              <div className="absolute inset-0 bg-gradient-to-b from-green-900/90 to-emerald-800/90 flex items-center justify-center z-20">
                <div className="text-center bg-card/20 backdrop-blur-sm border-2 border-green-500/30 p-6 rounded-lg shadow-xl max-w-sm mx-auto">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <Award className="h-16 w-16 text-yellow-500 animate-pulse" />
                      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-card">
                        {currentLevel}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="text-3xl font-bold mb-2 text-white">
                    {language === 'english' ? 'Level Complete!' : 'Seviye Tamamlandı!'}
                  </h3>
                  
                  <div className="bg-green-500/20 border border-green-500/30 rounded-md py-2 px-4 mb-4">
                    <p className="text-lg font-medium text-white">
                      {language === 'english' 
                        ? `Score: ${score} / ${targetScore}` 
                        : `Puan: ${score} / ${targetScore}`}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <ArrowUp className="h-5 w-5 text-green-300" />
                    <p className="text-green-300 font-medium">
                      {language === 'english' 
                        ? `Advancing to Level ${currentLevel + 1}...` 
                        : `Seviye ${currentLevel + 1}'e yükseltiliyor...`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {isGameOver ? (
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-2">
                  {language === 'english' ? 'Game Over!' : 'Oyun Bitti!'}
                </h3>
                <p className="text-xl mb-6">
                  {language === 'english' ? 'Final Score: ' : 'Son Puan: '}{score}
                </p>
                <button
                  onClick={handleStartGame}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
                >
                  {language === 'english' ? 'Play Again' : 'Tekrar Oyna'}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-2">
                  {language === 'english' ? 'Speed Typer' : 'Hızlı Yazma'}
                </h3>
                <p className="text-lg mb-3">
                  {language === 'english' 
                    ? 'Type the falling words before they reach the bottom!' 
                    : 'Düşen kelimeleri aşağıya ulaşmadan önce yaz!'}
                </p>
                
                <div className={cn(
                  "px-4 py-3 rounded-lg mb-6 inline-block",
                  language === 'english' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                    : 'bg-red-100 text-red-800 border border-red-300'
                )}>
                  <p className="font-medium">
                    {language === 'english' 
                      ? 'Playing with English words' 
                      : 'Oynamak için Türkçe kelimeler'
                    }
                  </p>
                  <p className="text-sm mt-1 opacity-80">
                    {language === 'english'
                      ? 'Change language in settings below'
                      : 'Aşağıdaki ayarlardan dili değiştirin'
                    }
                  </p>
                </div>
                
                <button
                  onClick={handleStartGame}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
                >
                  {language === 'english' ? 'Start Game' : 'Oyunu Başlat'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Game controls */}
      <div className="p-4 flex flex-col gap-3 bg-card rounded-b-lg border-t border-border">
        {/* Top row with menu and pause buttons */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button 
              onClick={handleBackToMenu}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-transparent hover:bg-muted transition-colors"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">{language === 'english' ? 'Menu' : 'Menü'}</span>
            </button>
            
            {isPlaying && (
              <>
                <button
                  onClick={handleTogglePause}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-muted hover:bg-muted transition-colors"
                >
                  {isPaused ? (
                    <>
                      <PlayCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">{language === 'english' ? 'Resume' : 'Devam Et'}</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">{language === 'english' ? 'Pause' : 'Duraklat'}</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleGiveUp}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Ban className="h-4 w-4" />
                  <span className="hidden sm:inline">{language === 'english' ? 'Give Up' : 'Pes Et'}</span>
                </button>
              </>
            )}
          </div>
          
          {/* Language selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{language === 'english' ? 'Language:' : 'Dil:'}</span>
            <div className="flex items-center border rounded-md overflow-hidden h-8">
              {(['english', 'türkçe'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  disabled={isPlaying && !isPaused}
                  className={`px-3 py-1 text-sm ${
                    lang === language
                      ? lang === 'english' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-red-500 text-white'
                      : 'bg-card hover:bg-muted'
                  } ${
                    (isPlaying && !isPaused)
                      ? 'opacity-50 cursor-not-allowed' 
                      : ''
                  }`}
                >
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Game mode selector */}
        <div className="flex flex-col sm:flex-row justify-between gap-2 sm:items-center">
          <span className="text-sm text-muted-foreground">
            {language === 'english' ? 'Game Mode:' : 'Oyun Modu:'}
          </span>
          
          <div className="flex items-center justify-center border rounded-md overflow-hidden h-9">
            {(['falling', 'linear', 'level'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleGameModeChange(mode)}
                disabled={isPlaying && !isPaused}
                className={`px-3 py-1 text-sm transition-colors ${
                  mode === gameMode
                    ? mode === 'level'
                      ? 'bg-green-600 text-white font-semibold'
                      : 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-card hover:bg-muted'
                } ${
                  (isPlaying && !isPaused)
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                }`}
              >
                {language === 'english'
                  ? mode === 'falling' 
                    ? 'Falling Words' 
                    : mode === 'linear'
                      ? 'Linear Train'
                      : 'Level Mode'
                  : mode === 'falling' 
                    ? 'Düşen Kelimeler' 
                    : mode === 'linear'
                      ? 'Sıralı Kelimeler'
                      : 'Seviye Modu'
                }
              </button>
            ))}
          </div>
        </div>
        
        {/* Level progress display - only shown in level mode */}
        {gameMode === 'level' && (
          <div className="flex flex-col sm:flex-row justify-between gap-2 sm:items-center mt-2">
            <span className="text-sm text-muted-foreground flex items-center">
              {language === 'english' ? 'Current Level:' : 'Mevcut Seviye:'}
              <span className="ml-1 font-semibold">{currentLevel}</span>
            </span>
            
            <div className="flex items-center gap-2 bg-muted/30 border rounded-md px-3 py-1.5">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs font-medium">{language === 'english' ? 'Target:' : 'Hedef:'}</span>
                  <span className="text-xs font-bold">{targetScore}</span>
                </div>
                
                <div className="w-full bg-muted/40 rounded-full h-2 mt-0.5">
                  <div 
                    className="bg-green-500 rounded-full h-2 transition-all duration-300"
                    style={{ width: `${Math.min(100, (score / targetScore) * 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="flex items-center px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/30">
                <span className="text-xs font-medium text-green-600">
                  {language === 'english'
                    ? `${Math.floor((score / targetScore) * 100)}% Complete`
                    : `${Math.floor((score / targetScore) * 100)}% Tamamlandı`
                  }
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Bottom row with word spawn rate selector - only shown in falling mode */}
        {gameMode === 'falling' && (
          <div className="flex flex-col sm:flex-row justify-between gap-2 sm:items-center">
            <span className="text-sm text-muted-foreground">
              {language === 'english' ? 'Word Spawn Rate:' : 'Kelime Üretim Hızı:'}
              <span className="ml-1 font-semibold">{spawnRate}x</span>
            </span>
            <div className="flex flex-1 flex-col sm:flex-row items-end sm:items-center gap-3">
              <div className="flex w-full sm:w-auto items-center justify-center border rounded-md overflow-hidden h-9 bg-card/50 p-0.5 gap-0.5">
                {([0.25, 0.5, 1, 1.25, 1.5, 2, 2.5, 3] as const).map((rate) => (
                  <button
                    key={rate}
                    onClick={() => handleSpawnRateChange(rate)}
                    disabled={isPlaying && !isPaused}
                    className={`px-2 sm:px-3 py-1 text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                      rate === spawnRate
                        ? 'bg-primary text-primary-foreground font-bold scale-110 shadow-md border-2 border-primary relative z-10 drop-shadow-[0_0_3px_rgba(99,102,241,0.7)]' 
                        : 'bg-card hover:bg-muted hover:scale-105'
                    } ${
                      (isPlaying && !isPaused)
                        ? 'opacity-50 cursor-not-allowed' 
                        : ''
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
              
              {spawnRate >= 2 && (
                <div className="flex-1 text-center sm:text-left sm:flex items-center mt-2 sm:mt-0 py-1 px-2 sm:py-0 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1 inline-block" />
                  <span className="text-xs text-yellow-500">
                    {language === 'english' 
                      ? `${spawnRate >= 2.5 ? 'Very' : ''} fast spawn rate - challenge mode!` 
                      : `${spawnRate >= 2.5 ? 'Çok' : ''} hızlı kelime üretimi - meydan okuma modu!`}
                  </span>
                </div>
              )}
              {spawnRate <= 0.5 && (
                <div className="flex-1 text-center sm:text-left sm:flex items-center mt-2 sm:mt-0 py-1 px-2 sm:py-0 rounded-md bg-green-500/10 border border-green-500/20">
                  <span className="text-xs text-green-500">
                    {language === 'english' 
                      ? 'Relaxed mode - words spawn slowly' 
                      : 'Rahat mod - kelimeler yavaşça düşer'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimplifiedSpeedTyper;