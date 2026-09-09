// «Начни или продолжи аят»: приложение называет суру либо произносит один аят,
// а пользователь читает первый либо следующий аят. Ответ проверяется без огласовок.
const CONTINUE_SURAHS = JUZ30_SURAHS
  .filter((surah) => surah.number >= 102 && surah.number <= 114)
  .sort((a, b) => b.number - a.number);
const AYMAN_SOWAID_AUDIO_BASE = "audio/ayman-suwaid/";
const CONTINUE_SESSION_KEY = "kalimat-continue-session-v4";
const CONTINUE_CYCLE_KEY = "kalimat-continue-cycle-v2";

function shuffleContinueItems(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function continueItemId(item) {
  return `${item.surahNumber}:${item.nextNumber}`;
}

function loadContinueCycle() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONTINUE_CYCLE_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved : []);
  } catch (error) {
    return new Set();
  }
}

function saveContinueCycle(completedIds) {
  try { localStorage.setItem(CONTINUE_CYCLE_KEY, JSON.stringify([...completedIds])); } catch (error) { /* хранилище может быть недоступно */ }
}

function buildContinueDeck(excludedIds = new Set()) {
  // Каждая сура — отдельная «дорожка». Первый аят тоже является заданием:
  // приложение называет суру, а пользователь начинает её. Затем идут переходы.
  // Берём по одному заданию из разных сур, чтобы одна сура не шла подряд.
  const lanes = CONTINUE_SURAHS.map((surah) => {
    const firstAyah = surah.ayahs[0];
    const startItem = firstAyah ? {
      surahNumber: surah.number,
      surahName: surah.name,
      surahArabicName: surah.arabicName,
      fromNumber: 0,
      fromArabic: surah.arabicName,
      fromRussian: `Начни суру «${surah.name}»`,
      nextNumber: firstAyah.number,
      nextArabic: firstAyah.arabic,
      nextRussian: firstAyah.russian,
      isSurahStart: true
    } : null;
    const transitionItems = surah.ayahs.slice(0, -1).map((ayah, index) => ({
      surahNumber: surah.number,
      surahName: surah.name,
      surahArabicName: surah.arabicName,
      fromNumber: ayah.number,
      fromArabic: ayah.arabic,
      fromRussian: ayah.russian,
      nextNumber: surah.ayahs[index + 1].number,
      nextArabic: surah.ayahs[index + 1].arabic,
      nextRussian: surah.ayahs[index + 1].russian,
      isSurahStart: false
    }));
    return {
      surahNumber: surah.number,
      items: shuffleContinueItems([startItem, ...transitionItems]
        .filter(Boolean)
        .filter((item) => !excludedIds.has(continueItemId(item))))
    };
  });
  const deck = [];
  let previousSurahNumber = null;
  while (lanes.some((lane) => lane.items.length)) {
    let available = lanes.filter((lane) => lane.items.length && lane.surahNumber !== previousSurahNumber);
    if (!available.length) available = lanes.filter((lane) => lane.items.length);
    const lane = available[Math.floor(Math.random() * available.length)];
    deck.push(lane.items.pop());
    previousSurahNumber = lane.surahNumber;
  }
  return deck;
}

const continueCompletedIds = loadContinueCycle();
let continueDeck = buildContinueDeck(continueCompletedIds);
if (!continueDeck.length) {
  continueCompletedIds.clear();
  saveContinueCycle(continueCompletedIds);
  continueDeck = buildContinueDeck();
}

const continueState = {
  index: 0,
  score: 0,
  errors: 0,
  mistakes: [],
  completedIds: continueCompletedIds,
  answered: false,
  autoAdvance: true,
  repeating: false,
  paused: false,
  cuePlaying: false,
  cueTranscript: "",
  recognitionActive: false,
  deck: continueDeck,
  recognition: null,
  recognitionLanguage: "ar",
  recognitionGeneration: 0,
  recognitionRestartTimer: null,
  recognitionWatchdogTimer: null,
  spokenParts: [],
  audio: null,
  audioPlayer: null,
  audioContext: null,
  audioSource: null,
  audioBuffers: new Map(),
  audioToken: 0,
  microphonePermissionPromise: null,
  microphonePermission: "unknown",
  listenUntil: 0,
  speechTimer: null,
  minuteTimer: null,
  nextTimer: null
};
const continueEl = (id) => document.getElementById(id);
const continueEscape = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function speakContinueArabic(text, onEnd) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ar-SA";
  utterance.rate = 0.72;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
  return true;
}

function speakContinueRussian(text, onEnd) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 0.88;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onEnd?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  window.speechSynthesis.speak(utterance);
  return true;
}

function stopContinueAudio() {
  continueState.audioToken += 1;
  if (continueState.audioSource) {
    continueState.audioSource.onended = null;
    try { continueState.audioSource.stop(0); } catch (error) { /* источник уже остановлен */ }
    try { continueState.audioSource.disconnect(); } catch (error) { /* источник уже отключён */ }
    continueState.audioSource = null;
  }
  if (continueState.audio) {
    continueState.audio.onended = null;
    continueState.audio.onerror = null;
    try { continueState.audio.pause(); } catch (error) { /* запись уже закончилась */ }
    try { continueState.audio.currentTime = 0; } catch (error) { /* Safari может запретить перемотку незагруженного файла */ }
    continueState.audio = null;
  }
}

function continueAyahAudioUrl(surahNumber, ayahNumber) {
  return `${AYMAN_SOWAID_AUDIO_BASE}${String(surahNumber).padStart(3, "0")}${String(ayahNumber).padStart(3, "0")}.mp3`;
}

function ensureContinueAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!continueState.audioContext) continueState.audioContext = new AudioContextClass();
  if (continueState.audioContext.state === "suspended") {
    continueState.audioContext.resume().catch(() => {});
  }
  return continueState.audioContext;
}

function unlockContinueAudio() {
  const context = ensureContinueAudioContext();
  if (!context) return;
  try {
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
    source.connect(context.destination);
    source.start(0);
  } catch (error) { /* Safari уже разрешил звук или не требует разблокировки */ }
}

function playContinueReadyTone(onEnd) {
  const context = ensureContinueAudioContext();
  if (!context) {
    onEnd?.();
    return;
  }
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      try { oscillator.disconnect(); } catch (error) { /* уже отключён */ }
      try { gain.disconnect(); } catch (error) { /* уже отключён */ }
      onEnd?.();
    };
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
  } catch (error) {
    onEnd?.();
  }
}

function loadContinueAudioBuffer(url) {
  const context = ensureContinueAudioContext();
  if (!context) return Promise.reject(new Error("Web Audio API unavailable"));
  if (!continueState.audioBuffers.has(url)) {
    const bufferPromise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Audio ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => context.decodeAudioData(bytes))
      .catch((error) => {
        continueState.audioBuffers.delete(url);
        throw error;
      });
    continueState.audioBuffers.set(url, bufferPromise);
  }
  return continueState.audioBuffers.get(url);
}

function preloadContinueAyah(ayah) {
  const url = continueAyahAudioUrl(ayah.surahNumber, ayah.number);
  if (ensureContinueAudioContext()) loadContinueAudioBuffer(url).catch(() => {});
}

function playContinueAyahElement(ayah, token, onEnd, onError) {
  const audio = continueState.audioPlayer || new Audio();
  continueState.audioPlayer = audio;
  audio.src = continueAyahAudioUrl(ayah.surahNumber, ayah.number);
  audio.preload = "auto";
  audio.playsInline = true;
  continueState.audio = audio;
  let failed = false;
  const fail = () => {
    if (failed || token !== continueState.audioToken) return;
    failed = true;
    if (continueState.audio === audio) continueState.audio = null;
    onError?.();
  };
  audio.onended = () => {
    if (token !== continueState.audioToken) return;
    if (continueState.audio === audio) continueState.audio = null;
    onEnd?.();
  };
  audio.onerror = fail;
  const playPromise = audio.play();
  if (playPromise?.catch) playPromise.catch(fail);
  return true;
}

function playContinueAyah(ayah, onEnd, onError) {
  stopContinueAudio();
  const token = continueState.audioToken;
  const context = ensureContinueAudioContext();
  if (!context) return playContinueAyahElement(ayah, token, onEnd, onError);
  const url = continueAyahAudioUrl(ayah.surahNumber, ayah.number);
  let failed = false;
  const fail = () => {
    if (failed || token !== continueState.audioToken) return;
    failed = true;
    // Резервный обычный плеер нужен только для старых браузеров, где Web Audio
    // не смог декодировать mp3. На iPhone основной путь не создаёт <audio>.
    playContinueAyahElement(ayah, token, onEnd, onError);
  };
  loadContinueAudioBuffer(url)
    .then((buffer) => context.resume().then(() => buffer))
    .then((buffer) => {
      if (token !== continueState.audioToken) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      continueState.audioSource = source;
      source.onended = () => {
        if (token !== continueState.audioToken) return;
        if (continueState.audioSource === source) continueState.audioSource = null;
        try { source.disconnect(); } catch (error) { /* уже отключён */ }
        onEnd?.();
      };
      source.start(0);
    })
    .catch(fail);
  return true;
}

function playContinuePrompt(ayah, onEnd) {
  playContinueAyah(ayah, onEnd, () => {
    const status = continueEl("continue-voice-status");
    if (status) status.textContent = "Локальная запись Аймана Сувайда не загрузилась. Обнови страницу и попробуй ещё раз.";
    if (continueState.repeating) {
      continueState.repeating = false;
    }
    onEnd?.();
  });
}

function playContinueQuestionCue(item, onEnd) {
  if (item.isSurahStart) {
    if (!speakContinueRussian(`Начни суру ${item.surahName}`, onEnd)) onEnd?.();
    return;
  }
  playContinuePrompt({ surahNumber: item.surahNumber, number: item.fromNumber }, onEnd);
}

function prepareContinueMicrophone() {
  if (continueState.microphonePermissionPromise) return continueState.microphonePermissionPromise;
  const setupStatus = continueEl("continue-permission-status");
  if (!navigator.mediaDevices?.getUserMedia) {
    continueState.microphonePermission = "unsupported";
    if (setupStatus) setupStatus.textContent = "Safari не дал доступ к микрофону. Проверь разрешение сайта в настройках Safari.";
    return Promise.resolve(false);
  }
  if (setupStatus) setupStatus.textContent = "Разреши Safari доступ к микрофону — это нужно только при первом запуске.";
  continueState.microphonePermissionPromise = navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
      continueState.microphonePermission = "granted";
      if (setupStatus) setupStatus.textContent = "Микрофон разрешён. Он включится перед чтением аята и останется готов к твоему ответу.";
      return true;
    })
    .catch(() => {
      continueState.microphonePermission = "denied";
      if (setupStatus) setupStatus.textContent = "Микрофон запрещён. На iPhone: aA → Настройки веб-сайта → Микрофон → Разрешить.";
      continueState.microphonePermissionPromise = null;
      return false;
    });
  return continueState.microphonePermissionPromise;
}

function primeContinueMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) return Promise.resolve(false);
  return navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
      continueState.microphonePermission = "granted";
      return true;
    })
    .catch(() => false);
}

function beginContinueListeningAfterPrompt(automatic = true) {
  const status = continueEl("continue-voice-status");
  const iosDelay = isContinueIOS() ? 4200 : 500;
  if (status) {
    status.textContent = isContinueIOS()
      ? "Запись закончилась. Готовлю микрофон Safari — начинай читать, когда появится «Слушаю…»."
      : "Запись закончилась. Включаю микрофон…";
  }
  setTimeout(() => {
    primeContinueMicrophone().then((primed) => {
      if (!primed) {
        continueState.autoAdvance = false;
        if (status) status.textContent = "Safari не получил доступ к микрофону. Разреши микрофон для этого сайта и попробуй ещё раз.";
        const button = continueEl("continue-speak");
        if (button) button.hidden = false;
        const reveal = continueEl("continue-reveal");
        if (reveal) reveal.hidden = false;
        return;
      }
      setTimeout(() => startContinueRecognition(automatic), isContinueIOS() ? 500 : 100);
    });
  }, iosDelay);
}

function saveContinueSession(phase = "test") {
  try {
    localStorage.setItem(CONTINUE_SESSION_KEY, JSON.stringify({
      version: 3,
      phase,
      index: continueState.index,
      score: continueState.score,
      errors: continueState.errors,
      mistakes: continueState.mistakes,
      completedIds: [...continueState.completedIds],
      answered: continueState.answered,
      deck: continueState.deck,
      savedAt: Date.now()
    }));
  } catch (error) { /* В приватном режиме хранилище может быть недоступно. */ }
}

function clearContinueSession() {
  try { localStorage.removeItem(CONTINUE_SESSION_KEY); } catch (error) { /* ничего не делаем */ }
}

function completeCurrentContinueItem() {
  const current = continueState.deck[continueState.index];
  if (!current) return;
  continueState.completedIds.add(continueItemId(current));
  saveContinueCycle(continueState.completedIds);
}

function repeatCurrentContinueAyah() {
  if (continueState.answered || continueState.paused) return;
  clearTimeout(continueState.speechTimer);
  clearTimeout(continueState.minuteTimer);
  continueState.speechTimer = null;
  continueState.listenUntil = Date.now() + 60000;
  const current = continueState.deck[continueState.index];
  continueState.repeating = true;
  stopContinueRecognition();
  continueEl("continue-voice-status").textContent = current.isSurahStart
    ? "Повторяю название суры. После подсказки у тебя снова будет 1 минута для ответа."
    : "Повторяю аят. После записи у тебя снова будет 1 минута для ответа.";
  startContinueRecognitionBeforeCue(current, continueState.autoAdvance, () => {
    continueState.repeating = false;
  });
}

function normalizeArabic(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[^\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function recitationSimilarity(spoken, expected) {
  const spokenWords = [...new Set(normalizeArabic(spoken).split(" ").filter(Boolean))];
  const expectedWords = [...new Set(normalizeArabic(expected).split(" ").filter(Boolean))];
  if (!spokenWords.length || !expectedWords.length) return 0;
  const expectedSet = new Set(expectedWords);
  const matched = spokenWords.filter((word) => expectedSet.has(word)).length;
  const coverage = matched / expectedWords.length;
  const precision = matched / spokenWords.length;
  if (expectedWords.length <= 3) return coverage >= 0.66 && precision >= 0.5 ? 1 : coverage;
  return Math.round(Math.min(coverage, precision) * 100) / 100;
}

function stripContinueCueFromTranscript(text) {
  const current = continueState.deck[continueState.index];
  const spoken = normalizeArabic(text);
  if (!spoken || !current || current.isSurahStart) return spoken;
  const cue = normalizeArabic(current.fromArabic);
  const recognizedCue = normalizeArabic(continueState.cueTranscript);
  const expectedWords = normalizeArabic(current.nextArabic).split(" ").filter(Boolean);
  if (!cue || !expectedWords.length) return spoken;
  if (recognizedCue && spoken === recognizedCue) return "";
  if (recognizedCue && spoken.startsWith(`${recognizedCue} `)) {
    return spoken.slice(recognizedCue.length).trim();
  }
  if (spoken === cue) return "";
  if (spoken.startsWith(`${cue} `)) return spoken.slice(cue.length).trim();

  // Иногда Safari соединяет конец записи Аймана с началом ответа в одном
  // результате. Ищем начало ожидаемого аята и отбрасываем всё перед ним.
  const words = spoken.split(" ").filter(Boolean);
  let bestStart = -1;
  let bestScore = 0;
  let bestCoverage = 0;
  for (let start = 0; start < words.length; start += 1) {
    const suffix = words.slice(start);
    const suffixSet = new Set(suffix);
    const matched = expectedWords.filter((word) => suffixSet.has(word)).length;
    const coverage = matched / expectedWords.length;
    const precision = matched / suffix.length;
    const score = coverage * 0.7 + precision * 0.3;
    if (score > bestScore) {
      bestScore = score;
      bestCoverage = coverage;
      bestStart = start;
    }
  }
  return bestStart > 0 && bestCoverage >= 0.45 ? words.slice(bestStart).join(" ") : spoken;
}

function getRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isContinueIOS() {
  const userAgent = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isContinueRepeatCommand(text) {
  const value = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return false;
  return /повтор|заново|repeat|again|أعد|اعد|كرر|كرّر/.test(value)
    || (/آي[هة]|اي[هة]|ayat|aya/.test(value) && value.split(" ").length <= 6);
}

function normalizedContinueCommand(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isContinuePauseCommand(text) {
  return /подожд|пауза|pause|انتظر|توقف/.test(normalizedContinueCommand(text));
}

function isContinueResumeCommand(text) {
  return /продолж|возобнов|continue|resume|تابع|استمر/.test(normalizedContinueCommand(text));
}

function pauseContinueListening() {
  if (continueState.answered || continueState.paused) return;
  clearTimeout(continueState.speechTimer);
  clearTimeout(continueState.minuteTimer);
  continueState.speechTimer = null;
  continueState.minuteTimer = null;
  continueState.paused = true;
  continueEl("continue-voice-status").textContent = "Пауза. Скажи «продолжай», когда будешь готова.";
  stopContinueRecognition();
  const generation = continueState.recognitionGeneration;
  scheduleContinueRecognition(generation, true, 500);
}

function resumeContinueListening() {
  if (continueState.answered || !continueState.paused) return;
  stopContinueRecognition();
  continueState.paused = false;
  continueEl("continue-voice-status").textContent = "Продолжаем. У тебя снова 1 минута для ответа.";
  setTimeout(() => startContinueRecognition(continueState.autoAdvance), 500);
}

function clearContinueTimers() {
  clearTimeout(continueState.speechTimer);
  clearTimeout(continueState.minuteTimer);
  clearTimeout(continueState.nextTimer);
  clearTimeout(continueState.recognitionRestartTimer);
  clearTimeout(continueState.recognitionWatchdogTimer);
  continueState.speechTimer = null;
  continueState.minuteTimer = null;
  continueState.nextTimer = null;
  continueState.recognitionRestartTimer = null;
  continueState.recognitionWatchdogTimer = null;
}

function stopContinueRecognition() {
  continueState.recognitionGeneration += 1;
  clearTimeout(continueState.recognitionRestartTimer);
  clearTimeout(continueState.recognitionWatchdogTimer);
  continueState.recognitionRestartTimer = null;
  continueState.recognitionWatchdogTimer = null;
  const recognition = continueState.recognition;
  continueState.recognition = null;
  continueState.recognitionActive = false;
  if (!recognition) return;
  recognition.onstart = null;
  recognition.onerror = null;
  recognition.onend = null;
  recognition.onresult = null;
  try { recognition.abort(); } catch (error) { /* сеанс уже завершён */ }
}

function continueRecognitionErrorMessage(error) {
  const messages = {
    "not-allowed": "Разреши микрофон для этого сайта в настройках браузера, затем нажми «Говорить продолжение».",
    "service-not-allowed": "Браузер запретил распознавание речи. Открой публичный сайт через HTTPS в Safari или Chrome.",
    "audio-capture": "Микрофон не найден или занят другим приложением. Закрой диктофон или звонок и попробуй снова.",
    "no-speech": "Пока не услышала речь — продолжаю слушать.",
    "network": "Служба распознавания речи сейчас недоступна. Проверь интернет: запись Аймана работает без него, но распознавание на iPhone требует соединения.",
    "language-not-supported": "Этот браузер не распознаёт арабскую речь. Попробуй Safari или Chrome с языком арабского в настройках телефона."
  };
  return messages[error] || `Микрофон остановился (${error || "неизвестная ошибка"}). Нажми кнопку и попробуй ещё раз.`;
}

function shouldContinueRecognition(automatic) {
  return !continueState.answered
    && (continueState.paused || (automatic && Date.now() < continueState.listenUntil));
}

function scheduleContinueRecognition(generation, automatic, delay = 650) {
  if (generation !== continueState.recognitionGeneration || !shouldContinueRecognition(automatic)) return;
  clearTimeout(continueState.recognitionRestartTimer);
  continueState.recognitionRestartTimer = setTimeout(() => {
    launchContinueRecognition(generation, automatic);
  }, delay);
}

function recoverHungContinueRecognition(generation, automatic, recognition) {
  if (generation !== continueState.recognitionGeneration || continueState.answered || continueState.paused) return;
  const status = continueEl("continue-voice-status");
  if (status) status.textContent = "Safari не передал услышанный текст. Перезапускаю микрофон автоматически…";
  recognition.onstart = null;
  recognition.onerror = null;
  recognition.onend = null;
  recognition.onresult = null;
  try { recognition.abort(); } catch (error) { /* зависший сеанс может не отвечать */ }
  if (continueState.recognition === recognition) continueState.recognition = null;
  continueState.recognitionActive = false;
  const button = continueEl("continue-speak");
  button?.classList.remove("listening");
  primeContinueMicrophone().then((primed) => {
    if (generation !== continueState.recognitionGeneration || continueState.answered) return;
    if (!primed) {
      continueState.autoAdvance = false;
      if (status) status.textContent = "Не удалось перезапустить микрофон. Проверь разрешение Safari.";
      if (button) button.hidden = false;
      continueEl("continue-reveal").hidden = false;
      return;
    }
    scheduleContinueRecognition(generation, automatic, isContinueIOS() ? 3000 : 700);
  });
}

function handleContinueTranscript(finalText, generation, automatic) {
  if (!finalText || generation !== continueState.recognitionGeneration || continueState.answered) return;
  if (continueState.paused) {
    if (isContinueResumeCommand(finalText)) resumeContinueListening();
    return;
  }
  if (isContinuePauseCommand(finalText)) {
    pauseContinueListening();
    return;
  }
  if (isContinueRepeatCommand(finalText)) {
    repeatCurrentContinueAyah();
    return;
  }
  const answerText = stripContinueCueFromTranscript(finalText);
  if (!answerText) return;
  continueState.spokenParts.push(answerText);
  clearTimeout(continueState.speechTimer);
  continueState.speechTimer = setTimeout(
    () => evaluateContinueRecitation(continueState.spokenParts.join(" ")),
    1200
  );
}

function launchContinueRecognition(generation, automatic, onStarted) {
  const Recognition = getRecognitionConstructor();
  const button = continueEl("continue-speak");
  const status = continueEl("continue-voice-status");
  if (!Recognition || generation !== continueState.recognitionGeneration || continueState.answered) return;
  const recognition = new Recognition();
  continueState.recognition = recognition;
  recognition.lang = continueState.paused ? "ru-RU" : continueState.recognitionLanguage;
  // Safari на iPhone нередко возвращает услышанный текст как interim и
  // завершает короткий сеанс без отдельного final-события.
  recognition.interimResults = true;
  // Короткий новый сеанс при каждом перезапуске устойчивее на iPhone,
  // чем повторный start() у уже завершившегося объекта.
  // На iPhone держим один сеанс открытым во время Web Audio-подсказки.
  // Так Safari не должен заново запускать распознавание после воспроизведения.
  recognition.continuous = isContinueIOS();
  recognition.maxAlternatives = 3;
  let lastError = "";
  let receivedResult = false;
  let bestTranscript = "";
  let transcriptCommitted = false;
  recognition.onstart = () => {
    if (generation !== continueState.recognitionGeneration) return;
    continueState.recognitionActive = true;
    button.classList.add("listening");
    button.textContent = "◉ Слушаю…";
    button.hidden = automatic;
    status.textContent = continueState.paused
      ? "Пауза. Скажи «продолжай», когда будешь готова."
      : continueState.cuePlaying
        ? "Микрофон включён. Сначала слушай подсказку Аймана Сувайда."
        : "Слушаю. Произнеси следующий аят целиком — у тебя есть 1 минута.";
    onStarted?.();
    onStarted = null;
    clearTimeout(continueState.recognitionWatchdogTimer);
    if (!continueState.cuePlaying) {
      continueState.recognitionWatchdogTimer = setTimeout(() => {
        if (!receivedResult && !continueState.answered) {
          recoverHungContinueRecognition(generation, automatic, recognition);
        }
      }, isContinueIOS() ? 12000 : 18000);
    }
  };
  recognition.onerror = (event) => {
    if (generation !== continueState.recognitionGeneration) return;
    lastError = event.error || "unknown";
    clearTimeout(continueState.recognitionWatchdogTimer);
    continueState.recognitionWatchdogTimer = null;
    const needsArabicFallback = lastError === "language-not-supported"
      && !continueState.paused
      && continueState.recognitionLanguage !== "ar";
    if (needsArabicFallback) {
      continueState.recognitionLanguage = "ar";
      lastError = "language-fallback";
    }
    continueState.recognitionActive = false;
    button.classList.remove("listening");
    button.textContent = "🎙️ Говорить продолжение";
    clearTimeout(continueState.speechTimer);
    const recoverable = lastError === "no-speech" || lastError === "aborted" || lastError === "language-fallback";
    if (!recoverable) {
      clearTimeout(continueState.minuteTimer);
      continueState.autoAdvance = false;
    }
    if (lastError === "language-fallback") status.textContent = "Переключаю Safari на общий арабский язык и продолжаю слушать.";
    else if (lastError !== "aborted") status.textContent = continueRecognitionErrorMessage(lastError);
    button.hidden = recoverable && automatic;
    continueEl("continue-reveal").hidden = recoverable;
  };
  recognition.onend = () => {
    if (generation !== continueState.recognitionGeneration) return;
    continueState.recognitionActive = false;
    clearTimeout(continueState.recognitionWatchdogTimer);
    continueState.recognitionWatchdogTimer = null;
    if (continueState.recognition === recognition) continueState.recognition = null;
    button.classList.remove("listening");
    button.textContent = "🎙️ Говорить продолжение";
    if (continueState.repeating) return;
    if (bestTranscript && !transcriptCommitted && !continueState.speechTimer) {
      transcriptCommitted = true;
      handleContinueTranscript(bestTranscript, generation, automatic);
      return;
    }
    if (receivedResult || continueState.speechTimer) return;
    const recoverable = !lastError || lastError === "no-speech" || lastError === "aborted" || lastError === "language-fallback";
    if (recoverable) scheduleContinueRecognition(generation, automatic, lastError === "aborted" ? 900 : 650);
  };
  recognition.onresult = (event) => {
    if (generation !== continueState.recognitionGeneration) return;
    // Safari уже слушает, пока играет вопрос. Его собственную запись не считаем
    // ответом пользователя; принимать речь начинаем только после окончания cue.
    if (continueState.cuePlaying) {
      const ignored = [];
      for (let index = 0; index < event.results.length; index += 1) {
        if (event.results[index]?.[0]?.transcript) ignored.push(event.results[index][0].transcript);
      }
      continueState.cueTranscript = ignored.join(" ").trim();
      return;
    }
    const heardParts = [];
    clearTimeout(continueState.recognitionWatchdogTimer);
    continueState.recognitionWatchdogTimer = null;
    const finalParts = [];
    const firstResult = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;
    for (let index = firstResult; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result[0]?.transcript) heardParts.push(result[0].transcript);
      if (result.isFinal && result[0]?.transcript) finalParts.push(result[0].transcript);
    }
    const heardText = heardParts.join(" ").trim();
    if (heardText) {
      receivedResult = true;
      bestTranscript = heardText;
      status.textContent = `Safari услышал: «${heardText}». Проверяю ответ…`;
      clearTimeout(continueState.speechTimer);
      continueState.speechTimer = setTimeout(() => {
        if (transcriptCommitted || generation !== continueState.recognitionGeneration || continueState.answered) return;
        transcriptCommitted = true;
        continueState.speechTimer = null;
        handleContinueTranscript(bestTranscript, generation, automatic);
      }, 1600);
    }
    const finalText = finalParts.join(" ");
    if (!finalText || transcriptCommitted) return;
    transcriptCommitted = true;
    handleContinueTranscript(finalText, generation, automatic);
  };
  try { recognition.start(); } catch (error) {
    if (generation !== continueState.recognitionGeneration) return;
    continueState.recognition = null;
    status.textContent = "Микрофон ещё запускается — пробую снова.";
    scheduleContinueRecognition(generation, automatic, 900);
  }
}

function startContinueRecognitionBeforeCue(current, automatic = true, afterCue) {
  const Recognition = getRecognitionConstructor();
  const status = continueEl("continue-voice-status");
  if (!Recognition) {
    continueState.autoAdvance = false;
    if (status) status.textContent = "Safari не открыл службу распознавания речи. Проверь, что Siri включена в настройках iPhone.";
    continueEl("continue-speak").hidden = false;
    continueEl("continue-reveal").hidden = false;
    return;
  }
  clearContinueTimers();
  stopContinueRecognition();
  continueState.autoAdvance = automatic;
  continueState.spokenParts = [];
  continueState.cuePlaying = true;
  continueState.cueTranscript = "";
  continueState.listenUntil = Date.now() + 90000;
  const generation = continueState.recognitionGeneration;
  let cueStarted = false;
  launchContinueRecognition(generation, automatic, () => {
    if (cueStarted || generation !== continueState.recognitionGeneration) return;
    cueStarted = true;
    if (status) status.textContent = current.isSurahStart
      ? "Микрофон включён. Слушай название суры, затем начинай читать."
      : "Микрофон включён. Слушай аят Аймана Сувайда, затем продолжай.";
    playContinueQuestionCue(current, () => {
      if (generation !== continueState.recognitionGeneration || continueState.answered) return;
      if (status) status.textContent = "Аят закончен. Дождись короткого сигнала и начинай читать после него.";
      setTimeout(() => playContinueReadyTone(() => {
        if (generation !== continueState.recognitionGeneration || continueState.answered) return;
        continueState.cuePlaying = false;
        continueState.spokenParts = [];
        continueState.listenUntil = Date.now() + 60000;
        clearTimeout(continueState.minuteTimer);
        continueState.minuteTimer = setTimeout(
          () => evaluateContinueRecitation(continueState.spokenParts.join(" ")),
          60000
        );
        if (status) status.textContent = "Слушаю тебя. Произнеси следующий аят целиком — у тебя есть 1 минута.";
        const activeRecognition = continueState.recognition;
        clearTimeout(continueState.recognitionWatchdogTimer);
        continueState.recognitionWatchdogTimer = setTimeout(() => {
          if (!continueState.spokenParts.length && !continueState.answered && activeRecognition) {
            recoverHungContinueRecognition(generation, automatic, activeRecognition);
          }
        }, isContinueIOS() ? 15000 : 18000);
        afterCue?.();
      }), 1800);
    });
  });
}

function startContinueRecognition(automatic = false) {
  const Recognition = getRecognitionConstructor();
  const button = continueEl("continue-speak");
  const status = continueEl("continue-voice-status");
  if (!Recognition) {
    continueState.autoAdvance = false;
    status.textContent = "Распознавание речи недоступно. Открой публичный сайт через HTTPS в Safari или Chrome и разреши микрофон.";
    button.hidden = false;
    continueEl("continue-reveal").hidden = false;
    return;
  }
  clearTimeout(continueState.speechTimer);
  clearTimeout(continueState.minuteTimer);
  clearTimeout(continueState.recognitionRestartTimer);
  stopContinueRecognition();
  continueState.autoAdvance = automatic;
  continueState.spokenParts = [];
  continueState.listenUntil = Date.now() + 60000;
  const generation = continueState.recognitionGeneration;
  continueState.minuteTimer = setTimeout(
    () => evaluateContinueRecitation(continueState.spokenParts.join(" ")),
    60000
  );
  launchContinueRecognition(generation, automatic);
}

function showContinueAnswer(correct, spoken, similarity) {
  const current = continueState.deck[continueState.index];
  const answer = continueEl("continue-answer");
  answer.hidden = false;
  continueEl("continue-reveal").hidden = true;
  continueEl("continue-speak").disabled = true;
  continueEl("continue-voice-status").textContent = `Ты сказала: «${spoken || "ответ не распознан"}»`;
  answer.innerHTML = `<small>Следующий аят · ${correct ? "ответ принят" : "сравни с правильным текстом"}</small>
    <p class="continue-answer-arabic" dir="rtl" lang="ar">${continueEscape(current.nextArabic)}</p>
    <div>${continueEscape(current.nextRussian)}</div>
    <button class="continue-answer-listen" id="continue-answer-listen" data-surah="${current.surahNumber}" data-ayah="${current.nextNumber}">🔊 Послушать правильный аят</button>
    <p class="continue-match">Совпадение по словам: ${Math.round(similarity * 100)}%</p>`;
  continueEl("continue-answer-listen").addEventListener("click", () => {
    unlockContinueAudio();
    playContinuePrompt({ surahNumber: current.surahNumber, number: current.nextNumber });
  });
  // Голосовая обратная связь: похвала за верный ответ или правильный аят для повторения.
  continueEl("continue-next-wrap").hidden = continueState.autoAdvance;
  if (continueState.autoAdvance) {
    if (correct) {
      speakContinueArabic("مَا شَاءَ اللَّهُ");
      continueState.nextTimer = setTimeout(advanceContinueQuestion, 3200);
      continueEl("continue-voice-status").textContent = "Ответ принят. Ма ша Аллах! Следующий аят начнётся автоматически.";
    } else {
      continueEl("continue-voice-status").textContent = "Сейчас Айман Сувайд прочитает правильный аят, затем начнётся следующий вопрос.";
      playContinuePrompt(
        { surahNumber: current.surahNumber, number: current.nextNumber },
        () => { continueState.nextTimer = setTimeout(advanceContinueQuestion, 900); }
      );
    }
  } else if (!correct) {
    playContinuePrompt({ surahNumber: current.surahNumber, number: current.nextNumber });
  }
}

function evaluateContinueRecitation(spoken) {
  if (continueState.answered) return;
  if (!String(spoken || "").trim()) {
    continueState.autoAdvance = false;
    stopContinueRecognition();
    continueEl("continue-voice-status").textContent = "Я не услышала ответ. Нажми «Говорить продолжение» и попробуй ещё раз.";
    continueEl("continue-speak").hidden = false;
    continueEl("continue-reveal").hidden = false;
    return;
  }
  clearContinueTimers();
  continueState.answered = true;
  stopContinueRecognition();
  const current = continueState.deck[continueState.index];
  const similarity = recitationSimilarity(spoken, current.nextArabic);
  const correct = similarity >= 0.5;
  if (correct) continueState.score += 1;
  else {
    continueState.errors += 1;
    continueState.mistakes.push({ ...current, spoken, similarity });
  }
  completeCurrentContinueItem();
  saveContinueSession("test");
  continueEl("continue-score-label").textContent = `Получилось ${continueState.score}`;
  showContinueAnswer(correct, spoken, similarity);
}

function renderContinueQuestion(options = {}) {
  const { autoPlay = true, restored = false } = options;
  const current = continueState.deck[continueState.index];
  continueState.answered = false;
  continueState.cuePlaying = false;
  continueState.cueTranscript = "";
  const progress = (continueState.index / continueState.deck.length) * 100;
  continueEl("continue-progress-label").textContent = `Задание ${continueState.index + 1} из ${continueState.deck.length}`;
  continueEl("continue-score-label").textContent = `Получилось ${continueState.score}`;
  continueEl("continue-progress-bar").style.width = `${progress}%`;
  continueEl("continue-question").innerHTML = `
    <div class="continue-reference"><span>Сура ${current.surahNumber}. ${continueEscape(current.surahName)}</span><strong>${current.isSurahStart ? "Начни суру с первого аята" : `После аята ${current.fromNumber}`}</strong></div>
    <p class="prompt">${current.isSurahStart ? "Послушай название суры и произнеси её первый аят" : "Послушай один аят и скажи следующий — варианты ответа не произносятся"}</p>
    <div class="continue-prompt" dir="rtl" lang="ar">${continueEscape(current.fromArabic)}</div>
    <div class="continue-prompt-translation">${continueEscape(current.fromRussian)}</div>
    <div class="continue-actions">
      <button class="continue-listen" id="continue-listen">${current.isSurahStart ? "🔊 Послушать название суры" : "🔊 Послушать аят Аймана Сувайда"}</button>
      <button class="continue-speak" id="continue-speak" hidden>🎙️ Говорить продолжение</button>
      <button class="continue-reveal" id="continue-reveal" hidden>Показать правильный аят</button>
    </div>
    <p class="continue-voice-status" id="continue-voice-status">${restored ? "Задание восстановлено после обновления. Нажми кнопку прослушивания — затем микрофон включится сам." : "После озвучки микрофон включится автоматически на 1 минуту."}</p>
    <div class="continue-answer" id="continue-answer" hidden></div>
    <div id="continue-next-wrap" hidden><button class="continue-next" id="continue-next">Следующее задание →</button></div>`;

  continueEl("continue-listen").addEventListener("click", () => {
    // Нажатие разблокирует Web Audio на iPhone. Распознавание запускается
    // до подсказки, чтобы Safari не зависал после воспроизведения.
    unlockContinueAudio();
    prepareContinueMicrophone().then((granted) => {
      if (granted) startContinueRecognitionBeforeCue(current, true);
    });
  });
  continueEl("continue-speak").addEventListener("click", () => startContinueRecognition(false));
  continueEl("continue-reveal").addEventListener("click", () => {
    clearContinueTimers();
    stopContinueRecognition();
    continueState.autoAdvance = false;
    if (!continueState.answered) {
      continueState.answered = true;
      continueState.errors += 1;
      continueState.mistakes.push({ ...current, spoken: "", similarity: 0 });
      completeCurrentContinueItem();
      saveContinueSession("test");
    }
    showContinueAnswer(false, "", 0);
  });
  preloadContinueAyah({ surahNumber: current.surahNumber, number: current.nextNumber });
  if (autoPlay && continueEl("continue-auto-speak").checked) {
    startContinueRecognitionBeforeCue(current, true);
  }
}

function advanceContinueQuestion() {
  if (continueState.index === continueState.deck.length - 1) renderContinueResult();
  else {
    continueState.index += 1;
    saveContinueSession("test");
    renderContinueQuestion();
    continueEl("continue-test").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function startContinueTest(autoPlay = true) {
  continueState.index = 0;
  continueState.score = 0;
  continueState.errors = 0;
  continueState.mistakes = [];
  continueState.repeating = false;
  continueState.paused = false;
  continueState.cuePlaying = false;
  continueState.cueTranscript = "";
  continueState.autoAdvance = true;
  continueState.deck = buildContinueDeck(continueState.completedIds);
  if (!continueState.deck.length) {
    continueState.completedIds.clear();
    saveContinueCycle(continueState.completedIds);
    continueState.deck = buildContinueDeck();
  }
  continueEl("continue-setup").hidden = true;
  continueEl("continue-result").hidden = true;
  continueEl("continue-test").hidden = false;
  saveContinueSession("test");
  renderContinueQuestion({ autoPlay });
  continueEl("continue-test").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderContinueResult() {
  const total = continueState.deck.length;
  const percent = Math.round((continueState.score / total) * 100);
  window.speechSynthesis?.cancel();
  stopContinueAudio();
  stopContinueRecognition();
  continueEl("continue-test").hidden = true;
  continueEl("continue-result").hidden = false;
  const mistakesMarkup = continueState.mistakes.length
    ? `<section class="continue-mistakes"><h3>Аяты для повторения</h3><p>Вот места, где ответ не совпал полностью:</p>${continueState.mistakes.map((mistake, index) => `<article class="continue-mistake"><div class="continue-mistake-meta">${index + 1}. Сура ${mistake.surahNumber}. ${continueEscape(mistake.surahName)} · ${mistake.isSurahStart ? "первый аят суры" : `после аята ${mistake.fromNumber}`} · повторить аят ${mistake.nextNumber}</div><p class="continue-mistake-arabic" dir="rtl" lang="ar">${continueEscape(mistake.nextArabic)}</p><p>${continueEscape(mistake.nextRussian)}</p><small>Твой ответ: ${continueEscape(mistake.spoken || "не распознан")}</small><button class="continue-mistake-listen" data-surah="${mistake.surahNumber}" data-ayah="${mistake.nextNumber}">🔊 Послушать Аймана Сувайда</button></article>`).join("")}</section>`
    : `<section class="continue-mistakes continue-no-mistakes"><h3>Аяты для повторения</h3><p>Ошибок нет — сегодня повторять отдельные аяты не нужно.</p></section>`;
  continueEl("continue-result").innerHTML = `<div class="continue-result-screen">
    <p class="eyebrow">Занятие завершено</p>
    <div class="result-ring" style="--result:${percent * 3.6}deg"><span><strong>${percent}%</strong><small>${continueState.score} из ${total}</small></span></div>
    <h2>${continueState.errors ? "Повтори места, где было трудно" : "Отлично, продолжение запомнилось!"}</h2>
    <p>Приложение проверило твою речь по словам и убрало огласовки при сравнении.</p>
    <p>Получилось: ${continueState.score}. Нужно повторить: ${continueState.errors}.</p>
    ${mistakesMarkup}
    <div class="result-actions"><button id="repeat-continue-test">↻ Повторить</button><button id="choose-continue-settings">К настройкам</button></div>
  </div>`;
  continueEl("continue-result").querySelectorAll(".continue-mistake-listen").forEach((button) => {
    button.addEventListener("click", () => {
      unlockContinueAudio();
      playContinuePrompt({ surahNumber: Number(button.dataset.surah), number: Number(button.dataset.ayah) });
    });
  });
  continueEl("repeat-continue-test").addEventListener("click", startContinueTest);
  continueEl("choose-continue-settings").addEventListener("click", returnToContinueSetup);
  saveContinueSession("result");
  continueEl("continue-result").scrollIntoView({ behavior: "smooth", block: "start" });
}

function returnToContinueSetup() {
  clearContinueTimers();
  continueState.repeating = false;
  continueState.paused = false;
  window.speechSynthesis?.cancel();
  stopContinueAudio();
  stopContinueRecognition();
  clearContinueSession();
  continueEl("continue-test").hidden = true;
  continueEl("continue-result").hidden = true;
  continueEl("continue-setup").hidden = false;
  continueEl("continue-setup").scrollIntoView({ behavior: "smooth", block: "start" });
}

function restoreContinueSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONTINUE_SESSION_KEY) || "null");
    const isRecent = saved?.savedAt && Date.now() - saved.savedAt < 14 * 24 * 60 * 60 * 1000;
    const hasDeck = Array.isArray(saved?.deck) && saved.deck.length > 0;
    const validIndex = Number.isInteger(saved?.index) && saved.index >= 0 && saved.index < saved.deck?.length;
    if (saved?.version !== 3 || !isRecent || !hasDeck || !validIndex) return false;
    continueState.deck = saved.deck;
    continueState.index = saved.index;
    continueState.score = Number(saved.score) || 0;
    continueState.errors = Number(saved.errors) || 0;
    continueState.mistakes = Array.isArray(saved.mistakes) ? saved.mistakes : [];
    continueState.completedIds = new Set(Array.isArray(saved.completedIds) ? saved.completedIds : [...continueState.completedIds]);
    continueState.repeating = false;
    continueState.paused = false;
    continueState.autoAdvance = true;
    continueEl("continue-setup").hidden = true;
    if (saved.phase === "result") {
      continueEl("continue-test").hidden = true;
      continueEl("continue-result").hidden = false;
      renderContinueResult();
    } else {
      if (saved.answered) {
        if (continueState.index === continueState.deck.length - 1) {
          renderContinueResult();
          return true;
        }
        continueState.index += 1;
        continueState.answered = false;
        saveContinueSession("test");
      }
      continueEl("continue-result").hidden = true;
      continueEl("continue-test").hidden = false;
      renderContinueQuestion({ autoPlay: false, restored: true });
    }
    return true;
  } catch (error) {
    clearContinueSession();
    return false;
  }
}

continueEl("start-continue-test").addEventListener("click", () => {
  // iPhone Safari надёжно показывает системный запрос только внутри нажатия.
  // Здесь же разблокируем Web Audio; после этого всё идёт без дополнительных кнопок.
  unlockContinueAudio();
  startContinueTest(false);
  const current = continueState.deck[continueState.index];
  prepareContinueMicrophone().then((granted) => {
    if (granted && continueEl("continue-auto-speak").checked) {
      startContinueRecognitionBeforeCue(current, true);
    }
  });
});
continueEl("exit-continue-test").addEventListener("click", returnToContinueSetup);
continueEl("continue-auto-speak").addEventListener("change", () => {
  if (!continueEl("continue-auto-speak").checked) {
    window.speechSynthesis?.cancel();
    stopContinueAudio();
  } else if (!continueEl("continue-test").hidden) {
    const current = continueState.deck[continueState.index];
    playContinueQuestionCue(current);
  }
});

document.addEventListener("click", (event) => {
  if (event.target.id === "continue-next") {
    advanceContinueQuestion();
  }
});

restoreContinueSession();
