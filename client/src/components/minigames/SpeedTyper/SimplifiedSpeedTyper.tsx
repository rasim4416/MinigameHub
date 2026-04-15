import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Clock, PauseCircle, PlayCircle, Ban, Award, ChevronLeft, AlertTriangle, ArrowUp } from 'lucide-react';
import { useAudio } from '@/lib/stores/useAudio';
import { useLevelMode } from '@/lib/stores/useLevelMode';
import {
  Language,
  getRandomWord,
  getWordOfLength,
  getWordInRange,
  getLetterCountForLevel,
} from './wordBanks';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FallingWord {
  id: string;
  word: string;
  x: number;
  y: number;
  speed: number;
  color: string;
}

type SpawnRateMultiplier = 0.25 | 0.5 | 1 | 1.25 | 1.5 | 2 | 2.5 | 3;
type GameMode = 'falling' | 'linear' | 'letter-level' | 'score-level';

// ─── (Word banks moved to wordBanks.ts) ──────────────────────────────────────

const _unused_wordBanks = {
  english: [
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
    "shy", "sin", "sit", "six", "ski", "sky", "son", "sun", "tax", "tea",
    "ten", "tip", "toe", "top", "try", "use", "war", "win", "yes", "yet",
    "book", "game", "life", "time", "year", "work", "code", "play", "fast",
    "slow", "good", "last", "long", "make", "many", "more", "most", "only",
    "over", "very", "word", "love", "help", "find", "look", "hand", "part",
    "able", "area", "army", "away", "baby", "back", "ball", "band", "bank",
    "base", "bath", "bear", "beat", "beer", "bell", "belt", "best", "bill",
    "bird", "blow", "blue", "boat", "body", "bomb", "bond", "bone", "born",
    "both", "bowl", "burn", "bush", "busy", "cake", "call", "calm", "came",
    "camp", "card", "care", "case", "cash", "cast", "cell", "chat", "chip",
    "city", "club", "coal", "coat", "cold", "come", "cook", "cool", "copy",
    "core", "cost", "crew", "crop", "dark", "data", "date", "dawn", "dead",
    "deal", "dear", "debt", "deep", "deny", "desk", "diet", "dirt", "dish",
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
    "after", "again", "about", "below", "could", "every", "first", "found",
    "great", "house", "large", "learn", "never", "other", "place", "plant",
    "point", "right", "small", "sound", "spell", "still", "study", "think",
    "water", "where", "which", "world", "would", "write", "happy", "peace",
    "black", "board", "brave", "break", "bring", "build", "built", "carry",
    "catch", "cause", "chain", "chair", "chart", "chase", "cheap", "check",
    "chest", "chief", "child", "chose", "civil", "claim", "class", "clean",
    "clear", "clock", "close", "coach", "coast", "color", "count", "court",
    "cover", "crash", "crazy", "cream", "crime", "cross", "crowd", "crown",
    "cycle", "daily", "dance", "death", "dozen", "draft", "drama", "drawn",
    "dream", "dress", "drink", "drive", "dying", "eager", "early", "earth",
    "eight", "elite", "empty", "enemy", "enjoy", "enter", "entry", "equal",
    "error", "event", "exact", "exist", "extra", "power", "press", "price",
    "pride", "prime", "print", "prior", "prize", "proof", "proud", "prove",
    "queen", "quick", "quiet", "quite", "radio", "raise", "range", "rapid",
    "ratio", "reach", "ready", "refer", "rival", "river", "robot", "rough",
    "round", "route", "royal", "rural", "scale", "scene", "scope", "score",
    "sense", "serve", "seven", "shade", "shake", "shall", "shape", "share",
    "sharp", "sheep", "shelf", "shell", "shift", "shirt", "shock", "shoot",
    "short", "shown", "sight", "since", "sixty", "skill", "sleep", "slide",
    "smart", "smile", "smoke", "solid", "solve", "sorry", "south", "space",
    "spare", "speak", "speed", "spend", "spent", "split", "spoke", "sport",
    "staff", "stage", "stake", "stand", "worth", "wound", "yacht", "young",
    "around", "enough", "coding", "access", "analog", "anchor", "backup",
    "binary", "bitmap", "buffer", "bundle", "button", "bypass", "client",
    "column", "cookie", "cursor", "device", "dialog", "domain", "driver",
    "engine", "entity", "export", "filter", "folder", "format", "global",
    "header", "import", "insert", "kernel", "linker", "logger", "memory",
    "method", "module", "object", "packet", "parser", "plugin", "portal",
    "prefix", "prompt", "python", "render", "router", "script", "sector",
    "server", "socket", "source", "static", "stream", "string", "struct",
    "syntax", "system", "tablet", "thread", "toggle", "upload", "vector",
    "widget", "digital", "amazing", "explore", "develop", "creative",
    "because", "between", "brought", "certain", "example", "explain",
    "message", "picture", "program", "quality", "receive", "science",
    "someone", "student", "success", "support", "through", "ability",
    "absence", "academy", "account", "accused", "achieve", "acquire",
    "address", "advance", "advised", "against", "airline", "airport",
    "alcohol", "already", "analyst", "ancient", "another", "anxiety",
    "applied", "arrange", "arrival", "article", "assault", "assumed",
    "attempt", "attract", "average", "balance", "banking", "barrier",
    "battery", "because", "bedroom", "believe", "beneath", "benefit",
    "billion", "brother", "burning", "cabinet", "capital", "captain",
    "capture", "careful", "carrier", "ceiling", "central", "century",
    "chamber", "channel", "chapter", "charity", "checked", "chicken",
    "circuit", "citizen", "clarity", "classic", "climate", "closely",
    "cluster", "comfort", "command", "comment", "company", "compare",
    "compete", "complex", "concept", "concern", "conduct", "confirm",
    "connect", "consist", "contact", "contain", "content", "context",
    "control", "convert", "correct", "council", "country", "crystal",
    "culture", "current", "dealing", "decided", "decline", "deliver",
    "density", "deposit", "desktop", "despite", "destroy", "develop",
    "browser", "computer", "software", "keyboard", "website", "internet",
    "network", "database", "function", "variable", "algorithm", "framework",
    "virtual", "learning",
  ],
  türkçe: [
    "bir", "çok", "göz", "yol", "son", "gün", "bak", "iki", "ben", "sen",
    "git", "gel", "yer", "sev", "ara", "bul", "yap", "sor", "ver", "dün",
    "acı", "adı", "ana", "art", "aşk", "bal", "baş", "bay", "bez", "biz",
    "boş", "buz", "cam", "can", "cep", "çay", "çek", "dağ", "dal", "dam",
    "dil", "diş", "duş", "düz", "ebe", "erk", "far", "fal", "fes", "göl",
    "güç", "güz", "hal", "ham", "has", "hat", "hep", "her", "his", "hoş",
    "hız", "iyi", "ile", "ilk", "iri", "kel", "kız", "kim", "kir", "köy",
    "kum", "kuş", "kül", "laf", "mal", "maç", "mum", "net", "not", "oda",
    "oku", "onu", "oto", "ova", "öne", "öte", "pas", "pek", "pul", "raf",
    "rol", "sağ", "sal", "sat", "sel", "ses", "sık", "sır", "sol", "son",
    "süt", "şah", "şal", "şey", "taç", "tam", "tas", "taş", "tel", "tem",
    "ten", "tez", "top", "toz", "tüm", "tür", "tüy", "var", "vay", "vur",
    "yağ", "yak", "yan", "yaş", "yel", "yen", "yok", "yön", "yüz", "zam",
    "zar", "zil", "zor",
    "daha", "hava", "gece", "ayak", "anne", "baba", "kedi", "masa", "kapı",
    "ayna", "boya", "kova", "toka", "okul", "renk", "adam", "adım", "ağır",
    "aile", "akıl", "aksi", "alan", "alma", "altı", "amca", "anma", "araç",
    "arka", "artı", "arzu", "asal", "asıl", "asır", "atak", "ateş", "avlu",
    "ayna", "ayva", "azim", "azot", "bant", "barış", "basit", "baskı",
    "batı", "bavul", "bayır", "bebek", "beden", "bela", "belge", "belki",
    "belli", "beyin", "beyaz", "bilgi", "bilet", "bilim", "bina", "birim",
    "bitki", "bomba", "borç", "boyun", "boyut", "bölge", "bölüm", "börek",
    "budak", "burun", "butik", "bütün", "büyük", "cami", "canlı", "ceket",
    "cesur", "cevap", "ceza", "coşku", "çaba", "çadır", "çanta", "çare",
    "çatal", "çatı", "çelik", "çeşit", "çevre", "çiçek", "çizgi", "çocuk",
    "çözüm", "daire", "damat", "damla", "darbe", "dava", "davul", "dergi",
    "bugün", "yarın", "sonra", "önce", "beyaz", "siyah", "elma", "armut",
    "kaşık", "kenar", "fırın", "tarih", "müzik", "yaprak", "toprak", "tohum",
    "lamba", "ışık", "açlık", "adres", "ahşap", "akran", "alarm", "albüm",
    "alçak", "alıcı", "alkış", "altın", "ambar", "amber", "ampul", "anket",
    "anlam", "antik", "araba", "arama", "arazi", "arena", "arıza", "arşiv",
    "asker", "aşçı", "aşırı", "atlas", "avize", "ayran", "bahis", "bakır",
    "balkan", "banyo", "baraj", "bayat", "bedel", "benzin", "berber", "besin",
    "beste", "bıçak", "biber", "bıyık", "bilim", "binek", "birey", "birlik",
    "bitki", "boğaz", "bomba", "borsa", "bozkır", "bronz", "bucak", "bugün",
    "bukle", "buluş", "burak", "burun", "büyü", "büyük", "canan", "canlı",
    "cazibe", "ceket", "cennet", "cephe", "cesur", "cevap", "ceviz", "ceylan",
    "ciğer", "cimri", "cömert", "çabuk", "çağrı", "çakal", "çalgı", "çanak",
    "çardak", "çatış", "çekim", "çelik", "çember", "çeper",
    "ekran", "klavye", "fare", "yazılım", "uygulama", "veri", "bellek",
    "tarayıcı", "işlemci", "çevrimiçi", "kablosuz", "dijital", "sanal",
    "dosya", "klasör", "şifre", "hesap", "adres", "android", "animasyon",
    "arayüz", "arşivleme", "ayarlar", "başlangıç", "bilgisayar", "bulut",
    "derleyici", "donanım", "dosya", "etiket", "forum", "gezgin", "grafik",
    "güncelleme", "güvenlik", "hesaplama", "iletişim", "imleç", "izleme",
    "karakter", "kayıt", "kısayol", "kodlama", "masaüstü", "metin",
    "modem", "motor", "oturum", "oyun", "paket", "parola", "paylaşım",
    "program", "sekme", "sertifika", "simge", "slayt", "sürücü", "sürüm",
    "tıklama", "tuş", "vektör", "virüs", "yama", "yazılım", "yedekleme",
    "telefon", "bilgisayar", "internet", "kütüphane", "hastane", "öğrenci",
    "öğretmen", "arkadaş", "kelebek", "balina", "yunus", "güneş", "gezegen",
    "başarı", "mutluluk", "sağlık", "yaşam", "abartı", "abone", "acayip",
    "acemi", "acente", "adalet", "algoritma", "analiz", "anahtar",
  ]
};

// ─── Word Helpers ──────────────────────────────────────────────────────────────

const getRandomWord = (lang: Language): string => {
  const words = wordBanks[lang];
  return words[Math.floor(Math.random() * words.length)];
};

const getWordOfLength = (lang: Language, length: number): string => {
  const words = wordBanks[lang].filter(w => w.length === length);
  if (words.length === 0) {
    // nearest available length
    const sorted = [...wordBanks[lang]].sort(
      (a, b) => Math.abs(a.length - length) - Math.abs(b.length - length)
    );
    return sorted[Math.floor(Math.random() * Math.min(10, sorted.length))];
  }
  return words[Math.floor(Math.random() * words.length)];
};

const getWordInRange = (lang: Language, min: number, max: number): string => {
  const words = wordBanks[lang].filter(w => w.length >= min && w.length <= max);
  if (words.length === 0) return getRandomWord(lang);
  return words[Math.floor(Math.random() * words.length)];
};

const getLetterCountForLevel = (level: number): number => Math.min(level + 2, 9);

const generateId = (): string => Math.random().toString(36).substring(2, 9);

const wordColors = [
  'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]',
  'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]',
  'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]',
  'text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]',
  'text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]',
  'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]',
  'text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]',
  'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]',
  'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]',
];

// ─── Mode label helpers ────────────────────────────────────────────────────────

const modeName = (mode: GameMode, lang: Language): string => {
  if (lang === 'english') {
    if (mode === 'falling')      return 'Classic';
    if (mode === 'linear')       return 'Linear Train';
    if (mode === 'letter-level') return 'Letter Levels';
    return 'Score Levels';
  } else {
    if (mode === 'falling')      return 'Klasik';
    if (mode === 'linear')       return 'Sıralı Kelimeler';
    if (mode === 'letter-level') return 'Harf Seviyeleri';
    return 'Puan Seviyeleri';
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

const SimplifiedSpeedTyper: React.FC = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wordSpawnerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  const [score, setScore]           = useState(0);
  const [timeLeft, setTimeLeft]     = useState(60);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [isPaused, setIsPaused]     = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [fallingWords, setFallingWords] = useState<FallingWord[]>([]);
  const [spawnRate, setSpawnRate]   = useState<SpawnRateMultiplier>(1);
  const [language, setLanguage]     = useState<Language>('english');
  const [gameMode, setGameMode]     = useState<GameMode>('falling');
  const [flashMsg, setFlashMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  const [linearQueue, setLinearQueue]             = useState<string[]>([]);
  const [currentLinearWord, setCurrentLinearWord] = useState<string>('');

  const {
    currentLevel, targetScore,
    score: levelScore,
    isLevelCompleted, isLevelTransition,
    setScore: setLevelScore,
    incrementScore: incrementLevelScore,
    setLevelCompleted, setLevelTransition,
    setPlaying: setLevelPlaying,
    advanceToNextLevel, resetGame: resetLevelGame,
  } = useLevelMode();

  const { playHit, playSuccess } = useAudio();

  const isLevelMode = gameMode === 'letter-level' || gameMode === 'score-level';

  // ── Refs to avoid stale closures ──
  const gameModeRef        = useRef(gameMode);
  const isLevelTransRef    = useRef(isLevelTransition);
  const isLevelCompletedRef = useRef(isLevelCompleted);
  gameModeRef.current         = gameMode;
  isLevelTransRef.current     = isLevelTransition;
  isLevelCompletedRef.current = isLevelCompleted;

  // ── Flash feedback helper ──
  const flash = useCallback((text: string, ok: boolean) => {
    setFlashMsg({ text, ok });
    setTimeout(() => setFlashMsg(null), 800);
  }, []);

  // ── Word generator for current mode/level ──
  const makeWord = useCallback((): string => {
    if (gameMode === 'letter-level') return getWordOfLength(language, getLetterCountForLevel(currentLevel));
    if (gameMode === 'score-level')  return getWordInRange(language, 3, 9);
    return getRandomWord(language);
  }, [gameMode, language, currentLevel]);

  const makeWordRef = useRef(makeWord);
  makeWordRef.current = makeWord;

  // ── Initialize linear / level queue ──
  const initQueue = useCallback((gen?: () => string) => {
    const g = gen ?? (() => makeWordRef.current());
    const words = Array.from({ length: 20 }, g);
    setLinearQueue(words);
    setCurrentLinearWord(words[0]);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // ── Process next word in queue ──
  const processQueue = useCallback(() => {
    setLinearQueue(q => {
      const next = q.slice(1);
      if (next.length < 10) {
        next.push(...Array.from({ length: 10 }, () => makeWordRef.current()));
      }
      setCurrentLinearWord(next[0] ?? '');
      return next;
    });
  }, []);

  // ── Falling mode helpers ──
  const startWordSpawner = useCallback(() => {
    if (wordSpawnerRef.current) clearInterval(wordSpawnerRef.current);
    const interval = Math.round(1000 / spawnRate);
    wordSpawnerRef.current = setInterval(() => {
      if (!isPaused) {
        const newWord: FallingWord = {
          id: generateId(),
          word: getRandomWord(language),
          x: Math.random() * 80 + 10,
          y: 0,
          speed: 1 * spawnRate,
          color: wordColors[Math.floor(Math.random() * wordColors.length)],
        };
        setFallingWords(ws => [...ws, newWord]);
      }
    }, interval);
  }, [spawnRate, language, isPaused]);

  const startFallingAnimation = useCallback(() => {
    if (animationRef.current) clearInterval(animationRef.current);
    animationRef.current = setInterval(() => {
      if (!isPaused) {
        setFallingWords(ws => {
          const moved = ws.map(w => ({ ...w, y: w.y + w.speed }));
          const kept  = moved.filter(w => w.y < 100);
          if (kept.length < moved.length) setScore(s => Math.max(0, s - 5));
          return kept;
        });
      }
    }, 50);
  }, [isPaused]);

  const cleanupTimers = useCallback(() => {
    if (wordSpawnerRef.current) { clearInterval(wordSpawnerRef.current); wordSpawnerRef.current = null; }
    if (animationRef.current)   { clearInterval(animationRef.current);   animationRef.current   = null; }
  }, []);

  // ── Simple countdown timer ──
  useEffect(() => {
    if (!isPlaying || isPaused) return;
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [isPlaying, isPaused]);

  // ── Time = 0 → game over ──
  useEffect(() => {
    if (timeLeft === 0 && isPlaying && !isLevelTransRef.current) {
      cleanupTimers();
      setIsGameOver(true);
      setIsPlaying(false);
      setLevelPlaying(false);
      playSuccess();
    }
  }, [timeLeft, isPlaying, cleanupTimers, setLevelPlaying, playSuccess]);

  // ── Level transition: delay then start next level ──
  useEffect(() => {
    if (!isLevelMode || !isLevelTransition) return;
    const delay = setTimeout(() => {
      advanceToNextLevel();
      setTimeLeft(60);
      setInputValue('');
      setLevelTransition(false);
      // Queue will be rebuilt by the next effect after advanceToNextLevel updates currentLevel
    }, 3000);
    return () => clearTimeout(delay);
  }, [isLevelTransition, isLevelMode, advanceToNextLevel, setLevelTransition]);

  // ── After level advances, rebuild word queue ──
  useEffect(() => {
    if (isPlaying && isLevelMode && !isLevelTransition && !isLevelCompleted) {
      // Re-init queue whenever level changes (currentLevel changes after advanceToNextLevel)
      initQueue();
    }
  }, [currentLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start game ──
  const handleStartGame = useCallback(() => {
    cleanupTimers();
    setScore(0);
    setTimeLeft(60);
    setIsGameOver(false);
    setIsPaused(false);
    setFallingWords([]);
    setLinearQueue([]);
    setCurrentLinearWord('');
    setInputValue('');
    setFlashMsg(null);
    setIsPlaying(true);

    if (isLevelMode) {
      resetLevelGame();
      setLevelPlaying(true);
      initQueue();
    } else if (gameMode === 'falling') {
      startWordSpawner();
      startFallingAnimation();
    } else {
      initQueue();
    }

    setTimeout(() => inputRef.current?.focus(), 0);
  }, [
    cleanupTimers, isLevelMode, gameMode,
    resetLevelGame, setLevelPlaying, initQueue,
    startWordSpawner, startFallingAnimation,
  ]);

  // ── Trigger level complete ──
  const triggerLevelComplete = useCallback(() => {
    if (isLevelCompletedRef.current) return;
    setLevelCompleted(true);
    setLevelTransition(true);
    playSuccess();
  }, [setLevelCompleted, setLevelTransition, playSuccess]);

  // ── Handle submit ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (gameMode === 'falling') {
      const idx = fallingWords.findIndex(
        w => w.word.toLowerCase() === inputValue.toLowerCase()
      );
      if (idx !== -1) {
        const matched = fallingWords[idx];
        setFallingWords(ws => ws.filter(w => w.id !== matched.id));
        const pts = Math.floor(matched.word.length * 5 * Math.min(spawnRate * 1.2, 3));
        setScore(s => s + pts);
        playHit();
        flash(`+${pts}`, true);
      }
      setInputValue('');
      return;
    }

    // Linear / Level modes
    const correct = inputValue.toLowerCase() === currentLinearWord.toLowerCase();

    if (correct) {
      const pts = currentLinearWord.length * 5;
      setScore(s => s + pts);
      flash(`+${pts}`, true);
      playHit();

      if (isLevelMode) {
        const newLevelScore = levelScore + pts;
        incrementLevelScore(pts);
        // +1 sec for correct answer in level modes
        setTimeLeft(t => t + 1);
        // Instant level complete
        if (newLevelScore >= targetScore) {
          triggerLevelComplete();
          setInputValue('');
          return;
        }
      }
      // Linear: no time bonus — just move on
      processQueue();
    } else {
      playHit();

      if (isLevelMode) {
        // -2 sec for wrong input in level modes
        flash('-2s', false);
        setTimeLeft(t => Math.max(0, t - 2));
      } else {
        flash('✗', false);
      }
      processQueue();
    }

    setInputValue('');
  };

  const handleTogglePause = () => {
    setIsPaused(p => !p);
    if (isPaused) setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleGiveUp = () => {
    cleanupTimers();
    setIsGameOver(true);
    setIsPlaying(false);
    setLevelPlaying(false);
    playSuccess();
  };

  const handleGameModeChange = (mode: GameMode) => {
    if (!isPlaying || isPaused) setGameMode(mode);
  };

  const handleSpawnRateChange = (rate: SpawnRateMultiplier) => {
    if (!isPlaying || isPaused) setSpawnRate(rate);
  };

  const handleLanguageChange = (lang: Language) => {
    if (!isPlaying || isPaused) setLanguage(lang);
  };

  const handleBackToMenu = () => {
    cleanupTimers();
    playSuccess();
    navigate('/minigames');
  };

  const formatTime = (s: number): string => {
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const timeColor = timeLeft <= 10 ? 'text-red-400' : timeLeft <= 30 ? 'text-yellow-400' : 'text-green-400';

  // Level progress %
  const levelProgress = isLevelMode ? Math.min(100, Math.floor((levelScore / targetScore) * 100)) : 0;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-white select-none">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
        <button
          onClick={handleBackToMenu}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800 transition-all"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>{language === 'english' ? 'Menu' : 'Menü'}</span>
        </button>

        {/* Score */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-gray-900 border border-gray-700">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="text-xs text-gray-400">{language === 'english' ? 'Score' : 'Puan'}:</span>
          <span className="font-bold text-yellow-300">{score}</span>
          {isLevelMode && (
            <span className="text-xs text-gray-500 ml-1">/ {targetScore}</span>
          )}
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md bg-gray-900 border ${
          timeLeft <= 10 ? 'border-red-700' : 'border-gray-700'
        }`}>
          <Clock className={`h-4 w-4 ${timeColor}`} />
          <span className={`font-bold font-mono ${timeColor}`}>{formatTime(timeLeft)}</span>
        </div>

        {/* Level badge (level modes only) */}
        {isLevelMode && isPlaying && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-900/50 border border-indigo-700">
            <span className="text-xs text-indigo-300">{language === 'english' ? 'Level' : 'Seviye'}</span>
            <span className="font-bold text-indigo-200">{currentLevel}</span>
            {gameMode === 'letter-level' && (
              <span className="text-[10px] text-indigo-400 ml-0.5">
                ({getLetterCountForLevel(currentLevel)}{language === 'english' ? 'L' : 'H'})
              </span>
            )}
          </div>
        )}

        {/* Pause / Give up (in-game) */}
        {isPlaying && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleTogglePause}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-700 bg-gray-900 hover:border-gray-500 transition-all"
            >
              {isPaused
                ? <><PlayCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">{language === 'english' ? 'Resume' : 'Devam'}</span></>
                : <><PauseCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">{language === 'english' ? 'Pause' : 'Duraklat'}</span></>
              }
            </button>
            <button
              onClick={handleGiveUp}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-800 text-red-400 hover:bg-red-900/30 transition-all"
            >
              <Ban className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{language === 'english' ? 'Give Up' : 'Pes Et'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Level progress bar (level modes, while playing) ── */}
      {isLevelMode && isPlaying && !isLevelTransition && (
        <div className="w-full h-1.5 bg-gray-800 shrink-0">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${levelProgress}%` }}
          />
        </div>
      )}

      {/* ── Game area ── */}
      <div className="flex-1 relative overflow-hidden min-h-0 bg-gray-900/30">
        {isPlaying ? (
          <>
            {/* Falling mode */}
            {gameMode === 'falling' && (
              <div className="absolute inset-0">
                {fallingWords.map(w => (
                  <div
                    key={w.id}
                    className={`absolute font-bold transform -translate-x-1/2 ${w.color}`}
                    style={{
                      left: `${w.x}%`,
                      top: `${w.y}%`,
                      fontSize: `${Math.max(18, 28 - w.word.length * 2)}px`,
                      textShadow: '0 0 6px currentColor',
                      opacity: isPaused ? 0.6 : 1,
                    }}
                  >
                    {w.word}
                  </div>
                ))}
              </div>
            )}

            {/* Linear / Level mode */}
            {gameMode !== 'falling' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                {/* Flash feedback */}
                {flashMsg && (
                  <div className={`absolute top-3 right-4 text-sm font-bold px-2 py-0.5 rounded ${
                    flashMsg.ok ? 'text-green-400' : 'text-red-400'
                  } animate-pulse`}>
                    {flashMsg.text}
                  </div>
                )}

                {/* Letter-level hint */}
                {gameMode === 'letter-level' && (
                  <div className="text-xs text-gray-500 tracking-widest uppercase">
                    {language === 'english'
                      ? `Level ${currentLevel} — ${getLetterCountForLevel(currentLevel)}-letter words`
                      : `Seviye ${currentLevel} — ${getLetterCountForLevel(currentLevel)} harfli kelimeler`}
                  </div>
                )}

                {/* Current word */}
                <div
                  className="text-5xl font-bold tracking-wide"
                  style={{ textShadow: '0 0 20px rgba(99,102,241,0.6)', color: '#818cf8' }}
                >
                  {currentLinearWord}
                </div>

                {/* Upcoming words */}
                <div className="flex flex-wrap justify-center gap-2 max-w-lg px-4">
                  {linearQueue.slice(1, 6).map((word, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-gray-800/60 text-gray-400 text-sm"
                      style={{ opacity: 1 - i * 0.18 }}
                    >
                      {word}
                    </span>
                  ))}
                </div>

                {/* Hint line */}
                <div className="text-xs text-gray-600 mt-2">
                  {isLevelMode
                    ? (language === 'english'
                        ? '+1s correct · -2s wrong · reach target to advance'
                        : 'Doğru +1s · Yanlış -2s · Hedefe ulaş')
                    : (language === 'english'
                        ? 'Type and press Enter to continue'
                        : 'Yaz ve Enter\'a bas')
                  }
                </div>
              </div>
            )}

            {/* Pause overlay */}
            {isPaused && (
              <div className="absolute inset-0 bg-gray-950/85 flex items-center justify-center z-20">
                <div className="text-center bg-gray-900 border border-gray-700 p-6 rounded-lg shadow-xl">
                  <h3 className="text-2xl font-bold mb-4 text-white">
                    {language === 'english' ? 'Paused' : 'Duraklatıldı'}
                  </h3>
                  <button
                    onClick={handleTogglePause}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-all"
                  >
                    {language === 'english' ? 'Resume' : 'Devam Et'}
                  </button>
                </div>
              </div>
            )}

            {/* Level complete overlay */}
            {isLevelCompleted && isLevelTransition && (
              <div className="absolute inset-0 bg-gray-950/90 flex items-center justify-center z-20">
                <div className="text-center bg-gray-900 border border-indigo-700 p-6 rounded-xl shadow-2xl max-w-sm mx-auto">
                  <div className="flex justify-center mb-3">
                    <div className="relative">
                      <Award className="h-14 w-14 text-yellow-400 animate-pulse" />
                      <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-gray-900">
                        {currentLevel}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-white">
                    {language === 'english' ? 'Level Complete!' : 'Seviye Tamamlandı!'}
                  </h3>
                  <p className="text-gray-400 text-sm mb-3">
                    {language === 'english'
                      ? `Score: ${levelScore} / ${targetScore}`
                      : `Puan: ${levelScore} / ${targetScore}`}
                  </p>
                  <div className="flex items-center justify-center gap-1 text-indigo-300 text-sm">
                    <ArrowUp className="h-4 w-4" />
                    <span>
                      {language === 'english'
                        ? `Advancing to Level ${currentLevel + 1}…`
                        : `Seviye ${currentLevel + 1}'e yükseltiliyor…`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            {!isPaused && !isLevelTransition && (
              <form
                onSubmit={handleSubmit}
                className="absolute bottom-4 left-0 right-0 z-10 px-4"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  disabled={isGameOver}
                  className="block w-full max-w-md mx-auto px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 text-white text-center text-base font-medium focus:border-indigo-500 focus:outline-none placeholder:text-gray-600"
                  placeholder={language === 'english' ? 'Type and press Enter…' : 'Yaz ve Enter\'a bas…'}
                  autoComplete="off"
                  spellCheck="false"
                />
              </form>
            )}
          </>
        ) : (
          /* ── Idle / Game Over screen ── */
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-4">
              {isGameOver ? (
                <>
                  <h3 className="text-3xl font-bold mb-1 text-white">
                    {language === 'english' ? 'Game Over' : 'Oyun Bitti'}
                  </h3>
                  <p className="text-gray-400 mb-1">
                    {language === 'english' ? 'Final Score' : 'Son Puan'}: <span className="text-yellow-300 font-bold">{score}</span>
                  </p>
                  {isLevelMode && (
                    <p className="text-gray-500 text-sm mb-4">
                      {language === 'english'
                        ? `Reached Level ${currentLevel}`
                        : `${currentLevel}. Seviyeye Ulaştınız`}
                    </p>
                  )}
                  <button
                    onClick={handleStartGame}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-all shadow"
                  >
                    {language === 'english' ? 'Play Again' : 'Tekrar Oyna'}
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-3xl font-bold mb-2 text-white">
                    {language === 'english' ? 'Speed Typer' : 'Hızlı Yazma'}
                  </h3>
                  <p className="text-gray-500 text-sm mb-5">
                    {language === 'english'
                      ? 'Choose a mode and start typing!'
                      : 'Bir mod seç ve yazmaya başla!'}
                  </p>
                  <button
                    onClick={handleStartGame}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-all shadow"
                  >
                    {language === 'english' ? 'Start Game' : 'Oyunu Başlat'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom controls ── */}
      <div className="shrink-0 flex flex-col gap-2 px-4 py-2.5 border-t border-gray-800 bg-gray-950">
        {/* Row 1: Language + Mode selector */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Language */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">{language === 'english' ? 'Language:' : 'Dil:'}</span>
            <div className="flex rounded border border-gray-700 overflow-hidden h-7">
              {(['english', 'türkçe'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  disabled={isPlaying && !isPaused}
                  className={`px-2 text-xs transition-all ${
                    lang === language
                      ? lang === 'english' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
                      : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                  } ${isPlaying && !isPaused ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {lang === 'english' ? 'EN' : 'TR'}
                </button>
              ))}
            </div>
          </div>

          {/* Game mode */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">{language === 'english' ? 'Mode:' : 'Mod:'}</span>
            <div className="flex rounded border border-gray-700 overflow-hidden h-7">
              {(['falling', 'linear', 'letter-level', 'score-level'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleGameModeChange(mode)}
                  disabled={isPlaying && !isPaused}
                  title={modeName(mode, language)}
                  className={`px-2 text-xs whitespace-nowrap transition-all ${
                    mode === gameMode
                      ? mode === 'letter-level' ? 'bg-purple-600 text-white font-semibold'
                        : mode === 'score-level' ? 'bg-green-700 text-white font-semibold'
                        : 'bg-indigo-600 text-white font-semibold'
                      : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                  } ${isPlaying && !isPaused ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {mode === 'falling'
                    ? (language === 'english' ? 'Classic' : 'Klasik')
                    : mode === 'linear'
                    ? (language === 'english' ? 'Linear' : 'Sıralı')
                    : mode === 'letter-level'
                    ? (language === 'english' ? 'Letters' : 'Harfler')
                    : (language === 'english' ? 'Scores' : 'Puanlar')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: spawn rate (falling only) */}
        {gameMode === 'falling' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">
              {language === 'english' ? 'Spawn Rate:' : 'Hız:'}
              <span className="ml-1 font-semibold text-gray-300">{spawnRate}x</span>
            </span>
            <div className="flex rounded border border-gray-700 overflow-hidden h-7 bg-gray-900">
              {([0.25, 0.5, 1, 1.25, 1.5, 2, 2.5, 3] as const).map(rate => (
                <button
                  key={rate}
                  onClick={() => handleSpawnRateChange(rate)}
                  disabled={isPlaying && !isPaused}
                  className={`px-1.5 text-xs transition-all ${
                    rate === spawnRate
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-gray-400 hover:bg-gray-800'
                  } ${isPlaying && !isPaused ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {rate}x
                </button>
              ))}
            </div>
            {spawnRate >= 2 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                <span className="text-xs text-yellow-500">
                  {spawnRate >= 2.5
                    ? (language === 'english' ? 'Very fast!' : 'Çok hızlı!')
                    : (language === 'english' ? 'Fast!' : 'Hızlı!')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Row 2: Level progress (level modes, not playing) */}
        {isLevelMode && !isPlaying && (
          <p className="text-xs text-gray-600 text-center">
            {gameMode === 'letter-level'
              ? (language === 'english'
                  ? 'Each level uses longer words. Same score targets, increasing word length.'
                  : 'Her seviyede daha uzun kelimeler. Aynı puan hedefleri, artan kelime uzunluğu.')
              : (language === 'english'
                  ? 'Random 3-9 letter words. Score targets increase each level.'
                  : 'Rastgele 3-9 harfli kelimeler. Her seviyede hedef puan artar.')}
          </p>
        )}
      </div>
    </div>
  );
};

export default SimplifiedSpeedTyper;
