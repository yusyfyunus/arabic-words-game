// «Начни или продолжи аят»: приложение называет суру либо произносит один аят,
// а пользователь читает первый либо следующий аят. Ответ проверяется без огласовок.
const CONTINUE_SURAHS = JUZ30_SURAHS
  .filter((surah) => surah.number >= 98 && surah.number <= 114)
  .sort((a, b) => b.number - a.number);
const AYMAN_SOWAID_AUDIO_BASE = "audio/ayman-suwaid/";
const CONTINUE_SESSION_KEY = "kalimat-continue-session-v7";
const CONTINUE_SILENCE_GRACE_MS = 5000;

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

function buildContinueDeck() {
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
      items: shuffleContinueItems([startItem, ...transitionItems].filter(Boolean))
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

const continueCompletedIds = new Set();
const continueDeck = buildContinueDeck();

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
  recognitionLanguage: "ar-SA",
  recognitionGeneration: 0,
  recognitionRecoveryCount: 0,
  recognitionRestartTimer: null,
  recognitionStartTimer: null,
  recognitionWatchdogTimer: null,
  recognitionCooldownTimer: null,
  recognitionResumeTimer: null,
  spokenParts: [],
  currentTranscript: "",
  audio: null,
  audioPlayer: null,
  audioContext: null,
  audioSource: null,
  audioBuffers: new Map(),
  audioToken: 0,
  utterance: null,
  microphoneStream: null,
  microphonePermissionPromise: null,
  microphonePermission: "unknown",
  microphonePrimed: false,
  microphoneRequestGeneration: 0,
  listenUntil: 0,
  speechTimer: null,
  minuteTimer: null,
  nextTimer: null,
  speechWatchdogTimer: null,
  feedbackTimer: null,
  manualFallbackActive: false,
  startPending: false
};
const continueEl = (id) => document.getElementById(id);
const continueEscape = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function speakContinueArabic(text, onEnd) {
  return speakContinueText(text, "ar-SA", 0.72, onEnd);
}

function speakContinueRussian(text, onEnd) {
  return speakContinueText(text, "ru-RU", 0.88, onEnd);
}

function speakContinueText(text, language, rate, onEnd) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = rate;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(continueState.speechWatchdogTimer);
    continueState.speechWatchdogTimer = null;
    continueState.utterance = null;
    setContinueAudioSession("auto");
    onEnd?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  continueState.utterance = utterance;
  setContinueAudioSession("playback");
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  clearTimeout(continueState.speechWatchdogTimer);
  continueState.speechWatchdogTimer = setTimeout(finish, 6000);
  setTimeout(() => {
    if (!finished) window.speechSynthesis.speak(utterance);
  }, 80);
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

function setContinueAudioSession(type) {
  try {
    if (navigator.audioSession && "type" in navigator.audioSession) {
      navigator.audioSession.type = type;
    }
  } catch (error) { /* Audio Session API поддерживается не во всех версиях Safari */ }
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
  setContinueAudioSession("playback");
  const token = continueState.audioToken;
  const context = ensureContinueAudioContext();
  if (!context) return playContinueAyahElement(ayah, token, onEnd, onError);
  const url = continueAyahAudioUrl(ayah.surahNumber, ayah.number);
  let failed = false;
  const fail = () => {
    if (failed || token !== continueState.audioToken) return;
    failed = true;
    // Резервный обычный плеер нужен только для старых браузеров, где Web Audio
    // не смог декодировать mp3. На iPhone не создаём <audio>: в Safari 26
    // воспроизведение media-элемента может полностью зависнуть SpeechRecognition.
    if (isContinueIOS()) onError?.();
    else playContinueAyahElement(ayah, token, onEnd, onError);
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
  let finished = false;
  const timeoutMs = item.isSurahStart ? 7000 : 45000;
  const watchdog = setTimeout(() => {
    if (finished) return;
    stopContinueAudio();
    window.speechSynthesis?.cancel();
    finish();
  }, timeoutMs);
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    setContinueAudioSession("auto");
    onEnd?.();
  };
  if (item.isSurahStart) {
    // На iPhone speechSynthesis перед SpeechRecognition нередко оставляет
    // микрофон без onresult. Название уже крупно показано на экране, поэтому
    // там безопасно переходим сразу к сигналу начала ответа.
    if (isContinueIOS()) {
      setTimeout(finish, 350);
      return;
    }
    if (!speakContinueRussian(`Начни суру ${item.surahName}`, finish)) finish();
    return;
  }
  playContinuePrompt({ surahNumber: item.surahNumber, number: item.fromNumber }, finish);
}

function playContinuePraise(onEnd) {
  clearTimeout(continueState.feedbackTimer);
  stopContinueAudio();
  setContinueAudioSession("playback");
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(continueState.feedbackTimer);
    continueState.feedbackTimer = null;
    setContinueAudioSession("auto");
    onEnd?.();
  };
  continueState.feedbackTimer = setTimeout(finish, 3800);
  const context = ensureContinueAudioContext();
  const token = continueState.audioToken;
  if (!context) {
    finish();
    return;
  }
  loadContinueAudioBuffer("audio/feedback/mashaallah.wav")
    .then((buffer) => context.resume().then(() => buffer))
    .then((buffer) => {
      if (finished || token !== continueState.audioToken) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      continueState.audioSource = source;
      source.onended = () => {
        if (continueState.audioSource === source) continueState.audioSource = null;
        try { source.disconnect(); } catch (error) { /* уже отключён */ }
        finish();
      };
      source.start(0);
    })
    .catch(finish);
}

function prepareContinueMicrophone() {
  // На iPhone достаточно один раз получить разрешение. Постоянно открытый
  // getUserMedia-поток может конкурировать со встроенным SpeechRecognition,
  // поэтому после первого разрешения Safari использует микрофон сам.
  if (isContinueIOS() && continueState.microphonePrimed && continueState.microphonePermission === "granted") {
    return Promise.resolve(true);
  }
  if (continueState.microphoneStream?.getAudioTracks().some((track) => track.readyState === "live")) {
    return Promise.resolve(true);
  }
  if (continueState.microphonePermissionPromise) return continueState.microphonePermissionPromise;
  const setupStatus = continueEl("continue-permission-status");
  if (!navigator.mediaDevices?.getUserMedia) {
    continueState.microphonePermission = "unsupported";
    if (setupStatus) setupStatus.textContent = "Браузер не дал доступ к микрофону. Открой сайт через HTTPS и проверь разрешение.";
    return Promise.resolve(false);
  }
  if (setupStatus) setupStatus.textContent = "Разреши браузеру доступ к микрофону — он останется включённым до конца занятия.";
  const requestGeneration = continueState.microphoneRequestGeneration;
  continueState.microphonePermissionPromise = navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      if (requestGeneration !== continueState.microphoneRequestGeneration) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      continueState.microphonePermission = "granted";
      continueState.microphonePrimed = true;
      if (isContinueIOS()) {
        // Разрешение уже получено; освобождаем физический вход перед запуском
        // Web Speech API, иначе на iPhone индикатор мигает без результатов.
        stream.getTracks().forEach((track) => track.stop());
        continueState.microphoneStream = null;
      } else continueState.microphoneStream = stream;
      if (setupStatus) setupStatus.textContent = "Микрофон готов на всё занятие. При выходе он выключится.";
      return true;
    })
    .catch(() => {
      if (requestGeneration !== continueState.microphoneRequestGeneration) return false;
      continueState.microphonePermission = "denied";
      if (setupStatus) setupStatus.textContent = "Микрофон запрещён. Разреши его в настройках этого сайта и попробуй снова.";
      return false;
    })
    .finally(() => {
      if (requestGeneration === continueState.microphoneRequestGeneration) {
        continueState.microphonePermissionPromise = null;
      }
    });
  return continueState.microphonePermissionPromise;
}

function primeContinueMicrophone() {
  return prepareContinueMicrophone();
}

function releaseContinueMicrophone() {
  continueState.microphoneRequestGeneration += 1;
  continueState.microphoneStream?.getTracks().forEach((track) => track.stop());
  continueState.microphoneStream = null;
  continueState.microphonePermissionPromise = null;
  continueState.microphonePrimed = false;
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
        showContinueManualFallback("Safari не получил доступ к микрофону сайта. Продиктуй аят через микрофон арабской клавиатуры iPhone и нажми «Проверить».");
        return;
      }
      setTimeout(() => startContinueRecognition(automatic), isContinueIOS() ? 500 : 100);
    });
  }, iosDelay);
}

function saveContinueSession(phase = "test") {
  try {
    localStorage.setItem(CONTINUE_SESSION_KEY, JSON.stringify({
      version: 4,
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
}

function repeatCurrentContinueAyah() {
  if (continueState.answered || continueState.paused) return;
  clearTimeout(continueState.speechTimer);
  clearTimeout(continueState.minuteTimer);
  continueState.speechTimer = null;
  continueState.listenUntil = Date.now() + 60000;
  const current = continueState.deck[continueState.index];
  continueState.repeating = true;
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
  if (!spoken || !current) return spoken;
  // Safari иногда повторно присылает уже услышанную подсказку после того,
  // как запись закончилась. Не считаем её ответом ученицы.
  const rawCue = normalizedContinueCommand(continueState.cueTranscript);
  const rawSpoken = normalizedContinueCommand(text);
  if (rawCue && rawSpoken === rawCue) return "";
  if (current.isSurahStart) return spoken;
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
  const generation = continueState.recognitionGeneration;
  clearTimeout(continueState.recognitionResumeTimer);
  continueState.recognitionResumeTimer = setTimeout(() => {
    continueState.recognitionResumeTimer = null;
    if (generation !== continueState.recognitionGeneration
      || continueState.answered
      || continueState.paused
      || document.visibilityState === "hidden") return;
    startContinueRecognition(continueState.autoAdvance);
  }, 500);
}

function clearContinueTimers() {
  clearTimeout(continueState.speechTimer);
  clearTimeout(continueState.minuteTimer);
  clearTimeout(continueState.nextTimer);
  clearTimeout(continueState.recognitionRestartTimer);
  clearTimeout(continueState.recognitionStartTimer);
  clearTimeout(continueState.recognitionWatchdogTimer);
  clearTimeout(continueState.recognitionCooldownTimer);
  clearTimeout(continueState.recognitionResumeTimer);
  clearTimeout(continueState.speechWatchdogTimer);
  clearTimeout(continueState.feedbackTimer);
  continueState.speechTimer = null;
  continueState.minuteTimer = null;
  continueState.nextTimer = null;
  continueState.recognitionRestartTimer = null;
  continueState.recognitionStartTimer = null;
  continueState.recognitionWatchdogTimer = null;
  continueState.recognitionCooldownTimer = null;
  continueState.recognitionResumeTimer = null;
  continueState.speechWatchdogTimer = null;
  continueState.feedbackTimer = null;
}

function stopContinueRecognition() {
  continueState.recognitionGeneration += 1;
  clearTimeout(continueState.recognitionRestartTimer);
  clearTimeout(continueState.recognitionStartTimer);
  clearTimeout(continueState.recognitionWatchdogTimer);
  clearTimeout(continueState.recognitionCooldownTimer);
  clearTimeout(continueState.recognitionResumeTimer);
  continueState.recognitionRestartTimer = null;
  continueState.recognitionStartTimer = null;
  continueState.recognitionWatchdogTimer = null;
  continueState.recognitionCooldownTimer = null;
  continueState.recognitionResumeTimer = null;
  const recognition = continueState.recognition;
  continueState.recognition = null;
  continueState.recognitionActive = false;
  setContinueAudioSession("auto");
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

function shouldContinueRecognition() {
  return !continueState.answered
    && (continueState.paused || Date.now() < continueState.listenUntil);
}

function scheduleContinueRecognition(generation, automatic, delay = 650) {
  if (generation !== continueState.recognitionGeneration || continueState.manualFallbackActive || !shouldContinueRecognition()) return;
  clearTimeout(continueState.recognitionRestartTimer);
  continueState.recognitionRestartTimer = setTimeout(() => {
    launchContinueRecognition(generation, automatic);
  }, delay);
}

function showContinueManualFallback(message) {
  continueState.manualFallbackActive = true;
  continueState.autoAdvance = false;
  clearTimeout(continueState.minuteTimer);
  clearTimeout(continueState.speechTimer);
  stopContinueRecognition();
  const status = continueEl("continue-voice-status");
  if (status) status.textContent = message || "Safari не передал речь. Нажми микрофон на арабской клавиатуре iPhone, продиктуй аят и проверь его.";
  const fallback = continueEl("continue-manual-fallback");
  if (fallback) fallback.hidden = false;
  const retry = continueEl("continue-speak");
  if (retry) retry.hidden = false;
  const reveal = continueEl("continue-reveal");
  if (reveal) reveal.hidden = false;
}

function recoverHungContinueRecognition(generation, automatic, recognition) {
  if (generation !== continueState.recognitionGeneration || continueState.answered || continueState.paused) return;
  const status = continueEl("continue-voice-status");
  continueState.recognitionRecoveryCount += 1;
  if (continueState.recognitionRecoveryCount >= 2) {
    showContinueManualFallback(isContinueIOS()
      ? "Safari дважды не передал текст ответа. Нажми микрофон на арабской клавиатуре iPhone, продиктуй аят и нажми «Проверить»."
      : "Браузер дважды не передал текст ответа. Продиктуй или введи аят и нажми «Проверить».");
    return;
  }
  if (status) status.textContent = "Браузер не передал услышанный текст. Перезапускаю распознавание автоматически…";
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
      showContinueManualFallback("Не удалось перезапустить распознавание. Продиктуй аят через микрофон арабской клавиатуры и нажми «Проверить».");
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
  // Внутри одного сеанса SpeechRecognition каждый раз присылает более полную
  // версию текущей фразы. Храним её отдельно; завершённые сеансы остаются в
  // spokenParts, чтобы пауза внутри длинного аята не обрезала начало ответа.
  continueState.currentTranscript = answerText;
  clearTimeout(continueState.speechTimer);
  continueState.speechTimer = setTimeout(
    () => evaluateContinueRecitation(collectContinueTranscript()),
    CONTINUE_SILENCE_GRACE_MS
  );
}

function collectContinueTranscript() {
  return [...continueState.spokenParts, continueState.currentTranscript]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function launchContinueRecognition(generation, automatic, onStarted) {
  const Recognition = getRecognitionConstructor();
  const button = continueEl("continue-speak");
  const status = continueEl("continue-voice-status");
  if (!Recognition || generation !== continueState.recognitionGeneration || continueState.answered || continueState.manualFallbackActive) return;
  setContinueAudioSession("play-and-record");
  const reuseActiveRecognition = continueState.recognitionActive && Boolean(continueState.recognition);
  const recognition = reuseActiveRecognition ? continueState.recognition : new Recognition();
  continueState.recognition = recognition;
  if (!reuseActiveRecognition) recognition.lang = continueState.paused ? "ru-RU" : continueState.recognitionLanguage;
  // Safari на iPhone нередко возвращает услышанный текст как interim и
  // завершает короткий сеанс без отдельного final-события.
  recognition.interimResults = true;
  // На iPhone continuous=true работает нестабильно: Safari может зависнуть и
  // больше не прислать onresult. Короткие сеансы автоматически перезапускаются
  // через onend, а доступ к микрофону остаётся выданным на всё занятие.
  recognition.continuous = !isContinueIOS();
  recognition.maxAlternatives = 3;
  let lastError = "";
  let receivedResult = false;
  let bestTranscript = "";
  const handleRecognitionStart = () => {
    if (generation !== continueState.recognitionGeneration) return;
    continueState.recognitionActive = true;
    clearTimeout(continueState.recognitionStartTimer);
    continueState.recognitionStartTimer = null;
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
      }, 15000);
    }
  };
  recognition.onstart = handleRecognitionStart;
  recognition.onerror = (event) => {
    if (generation !== continueState.recognitionGeneration) return;
    lastError = event.error || "unknown";
    clearTimeout(continueState.recognitionWatchdogTimer);
    clearTimeout(continueState.recognitionStartTimer);
    continueState.recognitionStartTimer = null;
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
    // Если служба распознавания кратковременно потеряла соединение, пробуем
    // ещё два раза. На iPhone Safari первый запуск после аудио нередко
    // заканчивается network, хотя следующая попытка уже возвращает текст.
    const retryNetwork = lastError === "network"
      && navigator.onLine !== false
      && continueState.recognitionRecoveryCount < 2;
    if (retryNetwork) continueState.recognitionRecoveryCount += 1;
    else if (lastError === "network") continueState.recognitionRecoveryCount = 3;
    // Если текст уже получен, его отложенная проверка должна состояться даже
    // после короткой ошибки распознавания (часто бывает на iPhone Safari).
    const recoverable = lastError === "no-speech"
      || lastError === "aborted"
      || lastError === "language-fallback"
      || retryNetwork;
    if (!recoverable) {
      clearTimeout(continueState.minuteTimer);
      continueState.autoAdvance = false;
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(lastError)) releaseContinueMicrophone();
    }
    if (lastError === "language-fallback") status.textContent = "Переключаю Safari на общий арабский язык и продолжаю слушать.";
    else if (retryNetwork) status.textContent = `Связь со службой распознавания прервалась. Повторяю подключение (${continueState.recognitionRecoveryCount} из 2)…`;
    else if (lastError !== "aborted") status.textContent = continueRecognitionErrorMessage(lastError);
    button.hidden = recoverable && automatic;
    continueEl("continue-reveal").hidden = recoverable;
    if (!recoverable) {
      showContinueManualFallback(lastError === "network"
        ? "Служба распознавания Safari не ответила. Продиктуй аят через микрофон арабской клавиатуры и нажми «Проверить»."
        : "Safari не смог проверить голос автоматически. Продиктуй или введи аят ниже и нажми «Проверить».");
    }
  };
  recognition.onend = () => {
    if (generation !== continueState.recognitionGeneration) return;
    continueState.recognitionActive = false;
    clearTimeout(continueState.recognitionWatchdogTimer);
    clearTimeout(continueState.recognitionStartTimer);
    continueState.recognitionStartTimer = null;
    continueState.recognitionWatchdogTimer = null;
    if (continueState.recognition === recognition) continueState.recognition = null;
    button.classList.remove("listening");
    button.textContent = "🎙️ Говорить продолжение";
    if (continueState.repeating) return;
    if (bestTranscript && !continueState.currentTranscript) {
      handleContinueTranscript(bestTranscript, generation, automatic);
    }
    if (continueState.currentTranscript) {
      const lastPart = continueState.spokenParts.at(-1);
      if (lastPart !== continueState.currentTranscript) {
        continueState.spokenParts.push(continueState.currentTranscript);
      }
      continueState.currentTranscript = "";
    }
    // После короткой паузы Safari завершает один сеанс. Пока не прошла
    // безопасная пауза тишины, запускаем следующий и продолжаем собирать аят.
    if (continueState.speechTimer) {
      if (Date.now() < continueState.listenUntil) {
        scheduleContinueRecognition(generation, automatic, 300);
      }
      return;
    }
    const recoverable = !lastError
      || lastError === "no-speech"
      || lastError === "aborted"
      || lastError === "language-fallback"
      || (lastError === "network" && continueState.autoAdvance && continueState.recognitionRecoveryCount < 3);
    if (recoverable) {
      const retryDelay = lastError === "network" ? 1800 : lastError === "aborted" ? 900 : 650;
      scheduleContinueRecognition(generation, automatic, retryDelay);
    }
  };
  recognition.onresult = (event) => {
    if (generation !== continueState.recognitionGeneration) return;
    if (continueState.answered) return;
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
    // event.resultIndex указывает только на изменившийся фрагмент. Если брать
    // речь с этого индекса, длинный аят теряет уже распознанное начало.
    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result[0]?.transcript) heardParts.push(result[0].transcript);
    }
    const heardText = heardParts.join(" ").trim();
    const answerText = stripContinueCueFromTranscript(heardText);
    if (answerText) {
      receivedResult = true;
      continueState.recognitionRecoveryCount = 0;
      bestTranscript = heardText;
      handleContinueTranscript(heardText, generation, automatic);
      const transcript = collectContinueTranscript();
      status.textContent = `Услышала: «${transcript}». Проверяю после короткой паузы.`;
    }
  };
  if (reuseActiveRecognition) {
    handleRecognitionStart();
    return;
  }
  clearTimeout(continueState.recognitionStartTimer);
  continueState.recognitionStartTimer = setTimeout(() => {
    if (!continueState.recognitionActive && !receivedResult) {
      recoverHungContinueRecognition(generation, automatic, recognition);
    }
  }, 6000);
  try {
    // Chromium может получать звук из уже разрешённого потока. При перезапуске
    // распознавания он не должен заново открывать микрофон для каждого аята.
    const track = continueState.microphoneStream?.getAudioTracks()
      .find((audioTrack) => audioTrack.readyState === "live");
    if (track && !isContinueIOS()) {
      try { recognition.start(track); }
      catch (error) {
        if (error.name !== "TypeError" && error.name !== "NotSupportedError") throw error;
        recognition.start();
      }
    } else recognition.start();
  } catch (error) {
    if (generation !== continueState.recognitionGeneration) return;
    continueState.recognition = null;
    clearTimeout(continueState.recognitionStartTimer);
    continueState.recognitionStartTimer = null;
    status.textContent = "Микрофон ещё запускается — пробую снова.";
    recoverHungContinueRecognition(generation, automatic, recognition);
  }
}

function startContinueRecognitionBeforeCue(current, automatic = true, afterCue) {
  const Recognition = getRecognitionConstructor();
  const status = continueEl("continue-voice-status");
  if (!Recognition) {
    showContinueManualFallback("Автоматическое распознавание недоступно. Продиктуй аят через микрофон арабской клавиатуры и нажми «Проверить».");
    return;
  }
  clearContinueTimers();
  stopContinueRecognition();
  continueState.autoAdvance = automatic;
  continueState.recognitionRecoveryCount = 0;
  continueState.manualFallbackActive = false;
  continueState.spokenParts = [];
  continueState.currentTranscript = "";
  continueState.cuePlaying = true;
  continueState.cueTranscript = "";
  continueState.listenUntil = Date.now() + 90000;
  const generation = continueState.recognitionGeneration;
  // Не запускаем SpeechRecognition во время записи Аймана Сувайда. Иначе
  // телефон слышит динамик, смешивает вопрос с ответом ученицы и может сам
  // завершить распознавание ещё до начала ответа.
  if (status) status.textContent = current.isSurahStart
    ? isContinueIOS()
      ? "Название суры показано на экране. После короткого сигнала микрофон начнёт слушать тебя."
      : "Слушай название суры. После короткого сигнала микрофон начнёт слушать тебя."
    : "Слушай аят Аймана Сувайда. После короткого сигнала микрофон начнёт слушать тебя.";
  playContinueQuestionCue(current, () => {
    if (generation !== continueState.recognitionGeneration || continueState.answered) return;
    if (status) status.textContent = current.isSurahStart && isContinueIOS()
      ? "Начни выбранную суру после короткого сигнала."
      : "Аят закончен. Дождись короткого сигнала и начинай читать после него.";
    // WebKit на iPhone может перестать отдавать onresult, если распознавание
    // запустить сразу после аудио. Даём аудиосессии освободиться, затем подаём
    // короткий сигнал: именно после него начинается минутный ответ.
    const recognitionCooldown = isContinueIOS() ? 4500 : 350;
    clearTimeout(continueState.recognitionCooldownTimer);
    continueState.recognitionCooldownTimer = setTimeout(() => {
      continueState.recognitionCooldownTimer = null;
      if (generation !== continueState.recognitionGeneration || continueState.answered) return;
      playContinueReadyTone(() => {
        if (generation !== continueState.recognitionGeneration || continueState.answered) return;
        continueState.cuePlaying = false;
        continueState.spokenParts = [];
        continueState.currentTranscript = "";
        continueState.listenUntil = Date.now() + 60000;
        clearTimeout(continueState.minuteTimer);
        continueState.minuteTimer = setTimeout(
          () => evaluateContinueRecitation(collectContinueTranscript()),
          60000
        );
        if (status) status.textContent = "Слушаю тебя до 1 минуты. После ответа сделай короткую паузу — я сразу проверю.";
        launchContinueRecognition(generation, automatic, () => {
          if (generation !== continueState.recognitionGeneration || continueState.answered) return;
          if (status) status.textContent = "Слушаю тебя до 1 минуты. После ответа сделай короткую паузу — я сразу проверю.";
          afterCue?.();
        });
      });
    }, recognitionCooldown);
  });
}

function startContinueRecognition(automatic = false) {
  const Recognition = getRecognitionConstructor();
  const button = continueEl("continue-speak");
  const status = continueEl("continue-voice-status");
  if (!Recognition) {
    showContinueManualFallback("Автоматическое распознавание недоступно. Продиктуй аят через микрофон арабской клавиатуры и нажми «Проверить».");
    return;
  }
  clearTimeout(continueState.speechTimer);
  clearTimeout(continueState.minuteTimer);
  clearTimeout(continueState.recognitionRestartTimer);
  stopContinueRecognition();
  continueState.autoAdvance = automatic;
  continueState.recognitionRecoveryCount = 0;
  continueState.manualFallbackActive = false;
  continueState.spokenParts = [];
  continueState.currentTranscript = "";
  continueState.listenUntil = Date.now() + 60000;
  const generation = continueState.recognitionGeneration;
  continueState.minuteTimer = setTimeout(
    () => evaluateContinueRecitation(collectContinueTranscript()),
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
  if (correct) {
    continueEl("continue-voice-status").textContent = continueState.autoAdvance
      ? "Ответ принят. Ма ша Аллах! Следующий аят начнётся автоматически."
      : "Ответ принят. Ма ша Аллах! Нажми «Следующее задание», когда будешь готова.";
    playContinuePraise(() => {
      if (continueState.autoAdvance) continueState.nextTimer = setTimeout(advanceContinueQuestion, 850);
    });
  } else if (continueState.autoAdvance) {
    continueEl("continue-voice-status").textContent = "Сейчас Айман Сувайд прочитает правильный аят, затем начнётся следующий вопрос.";
    playContinuePrompt(
      { surahNumber: current.surahNumber, number: current.nextNumber },
      () => { continueState.nextTimer = setTimeout(advanceContinueQuestion, 900); }
    );
  } else {
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
  // Освобождаем микрофон до голосовой обратной связи и следующей подсказки.
  // На iPhone одновременные SpeechRecognition и воспроизведение конфликтуют.
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
  continueState.manualFallbackActive = false;
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
    <div class="voice-manual-fallback" id="continue-manual-fallback" hidden>
      <label for="continue-manual-answer">Если Safari не передал речь, нажми микрофон на арабской клавиатуре iPhone или введи аят:</label>
      <textarea id="continue-manual-answer" dir="rtl" lang="ar" rows="3" placeholder="اِقْرَأْ أَوِ اكْتُبِ الْآيَةَ هُنَا"></textarea>
      <button type="button" id="continue-manual-check">Проверить ответ</button>
    </div>
    <div class="continue-answer" id="continue-answer" hidden></div>
    <div id="continue-next-wrap" hidden><button class="continue-next" id="continue-next">Следующее задание →</button></div>`;

  continueEl("continue-listen").addEventListener("click", () => {
    // Нажатие разблокирует Web Audio на iPhone. Распознавание запускается
    // до подсказки, чтобы Safari не зависал после воспроизведения.
    unlockContinueAudio();
    prepareContinueMicrophone().then((granted) => {
      if (granted) startContinueRecognitionBeforeCue(current, true);
      else showContinueManualFallback("Микрофон сайта не включился. Продиктуй аят через микрофон арабской клавиатуры iPhone и нажми «Проверить».");
    });
  });
  continueEl("continue-speak").addEventListener("click", () => {
    prepareContinueMicrophone().then((granted) => {
      if (granted) startContinueRecognition(false);
      else showContinueManualFallback("Микрофон сайта не включился. Продиктуй аят через микрофон арабской клавиатуры iPhone и нажми «Проверить».");
    });
  });
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
  continueEl("continue-manual-check").addEventListener("click", () => {
    const transcript = continueEl("continue-manual-answer").value.trim();
    if (!transcript || continueState.answered) return;
    continueState.autoAdvance = false;
    evaluateContinueRecitation(transcript);
  });
  preloadContinueAyah({ surahNumber: current.surahNumber, number: current.nextNumber });
  if (autoPlay && continueEl("continue-auto-speak").checked) {
    prepareContinueMicrophone().then((granted) => {
      if (granted && !continueState.answered) startContinueRecognitionBeforeCue(current, true);
      else if (!granted && !continueState.answered) showContinueManualFallback("Автоматический микрофон недоступен. Продиктуй аят через микрофон арабской клавиатуры и нажми «Проверить».");
    });
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
  continueState.completedIds = new Set();
  continueState.deck = buildContinueDeck();
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
  releaseContinueMicrophone();
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
  continueEl("repeat-continue-test").addEventListener("click", beginContinueTestWithMicrophone);
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
  releaseContinueMicrophone();
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
    if (saved?.version !== 4 || !isRecent || !hasDeck || !validIndex) return false;
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

if (location.protocol === "file:") continueEl("continue-origin-notice").hidden = false;

function setContinueStartPending(pending) {
  continueState.startPending = pending;
  const startButton = continueEl("start-continue-test");
  const repeatButton = continueEl("repeat-continue-test");
  if (startButton) startButton.disabled = pending;
  if (repeatButton) repeatButton.disabled = pending;
}

function beginContinueTestWithMicrophone() {
  if (continueState.startPending) return;
  setContinueStartPending(true);
  // iPhone Safari надёжно показывает системный запрос только внутри нажатия.
  // Здесь же разблокируем Web Audio; после этого всё идёт без дополнительных кнопок.
  unlockContinueAudio();
  startContinueTest(false);
  const current = continueState.deck[continueState.index];
  const voiceStatus = continueEl("continue-voice-status");
  if (voiceStatus) voiceStatus.textContent = "Включаю микрофон. Если браузер спросит разрешение, выбери «Разрешить».";
  prepareContinueMicrophone().then((granted) => {
    if (granted && continueEl("continue-auto-speak").checked) {
      startContinueRecognitionBeforeCue(current, true);
    } else if (!granted && voiceStatus) {
      showContinueManualFallback("Микрофон сайта не включился. Нажми микрофон на арабской клавиатуре iPhone, продиктуй аят и нажми «Проверить».");
    }
  }).finally(() => setContinueStartPending(false));
}

continueEl("start-continue-test").addEventListener("click", beginContinueTestWithMicrophone);
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
  const destination = event.target.closest?.("[data-open-project]")?.dataset.openProject;
  if (destination && destination !== "continue") {
    clearContinueTimers();
    stopContinueAudio();
    stopContinueRecognition();
    releaseContinueMicrophone();
    const status = continueEl("continue-voice-status");
    if (status) status.textContent = "Занятие приостановлено. Нажми «Послушать аят», чтобы продолжить.";
  }
});

window.addEventListener("pagehide", () => {
  clearContinueTimers();
  window.speechSynthesis?.cancel();
  stopContinueAudio();
  stopContinueRecognition();
  releaseContinueMicrophone();
});

restoreContinueSession();
