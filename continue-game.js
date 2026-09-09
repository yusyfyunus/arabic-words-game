// «Продолжи аят»: приложение произносит один аят, а пользователь
// продолжает следующий. Голосовой ответ проверяется по словам без огласовок.
const CONTINUE_SURAHS = JUZ30_SURAHS
  .filter((surah) => surah.number >= 104 && surah.number <= 114)
  .sort((a, b) => b.number - a.number);
const AYMAN_SOWAID_AUDIO_BASE = "audio/ayman-suwaid/";
const CONTINUE_SESSION_KEY = "kalimat-continue-session-v2";
const CONTINUE_CYCLE_KEY = "kalimat-continue-cycle-v1";

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
  // Каждая сура — отдельная «дорожка». Берём по одному переходу из разных
  // сур за круг, поэтому вопросы не идут подряд всей одной сурой.
  const lanes = CONTINUE_SURAHS.map((surah) => ({
    surahNumber: surah.number,
    items: shuffleContinueItems(surah.ayahs.slice(0, -1).map((ayah, index) => ({
      surahNumber: surah.number,
      surahName: surah.name,
      fromNumber: ayah.number,
      fromArabic: ayah.arabic,
      fromRussian: ayah.russian,
      nextNumber: surah.ayahs[index + 1].number,
      nextArabic: surah.ayahs[index + 1].arabic,
      nextRussian: surah.ayahs[index + 1].russian
    })).filter((item) => !excludedIds.has(continueItemId(item))))
  }));
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
  recognitionActive: false,
  deck: continueDeck,
  recognition: null,
  recognitionGeneration: 0,
  recognitionRestartTimer: null,
  spokenParts: [],
  audio: null,
  audioPlayer: null,
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

function stopContinueAudio() {
  continueState.audioToken += 1;
  if (!continueState.audio) return;
  continueState.audio.onended = null;
  continueState.audio.onerror = null;
  try { continueState.audio.pause(); } catch (error) { /* запись уже закончилась */ }
  try { continueState.audio.currentTime = 0; } catch (error) { /* Safari может запретить перемотку незагруженного файла */ }
  continueState.audio = null;
}

function continueAyahAudioUrl(surahNumber, ayahNumber) {
  return `${AYMAN_SOWAID_AUDIO_BASE}${String(surahNumber).padStart(3, "0")}${String(ayahNumber).padStart(3, "0")}.mp3`;
}

function preloadContinueAyah(ayah) {
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = continueAyahAudioUrl(ayah.surahNumber, ayah.number);
  audio.load();
}

function playContinueAyah(ayah, onEnd, onError) {
  stopContinueAudio();
  const token = continueState.audioToken;
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
      if (setupStatus) setupStatus.textContent = "Микрофон разрешён. После чтения аята он включится автоматически.";
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

function beginContinueListeningAfterPrompt(automatic = true) {
  const permission = continueState.microphonePermissionPromise || Promise.resolve(true);
  permission.then(() => setTimeout(() => startContinueRecognition(automatic), 650));
}

function saveContinueSession(phase = "test") {
  try {
    localStorage.setItem(CONTINUE_SESSION_KEY, JSON.stringify({
      version: 2,
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
  continueEl("continue-voice-status").textContent = "Повторяю аят. После записи у тебя снова будет 1 минута для ответа.";
  playContinuePrompt({ surahNumber: current.surahNumber, number: current.fromNumber }, () => {
    continueState.repeating = false;
    beginContinueListeningAfterPrompt(continueState.autoAdvance);
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
  continueState.speechTimer = null;
  continueState.minuteTimer = null;
  continueState.nextTimer = null;
  continueState.recognitionRestartTimer = null;
}

function stopContinueRecognition() {
  continueState.recognitionGeneration += 1;
  clearTimeout(continueState.recognitionRestartTimer);
  continueState.recognitionRestartTimer = null;
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
  continueState.spokenParts.push(finalText);
  clearTimeout(continueState.speechTimer);
  continueState.speechTimer = setTimeout(
    () => evaluateContinueRecitation(continueState.spokenParts.join(" ")),
    2200
  );
}

function launchContinueRecognition(generation, automatic) {
  const Recognition = getRecognitionConstructor();
  const button = continueEl("continue-speak");
  const status = continueEl("continue-voice-status");
  if (!Recognition || generation !== continueState.recognitionGeneration || continueState.answered) return;
  const recognition = new Recognition();
  continueState.recognition = recognition;
  recognition.lang = continueState.paused ? "ru-RU" : "ar-SA";
  recognition.interimResults = false;
  // Короткий новый сеанс при каждом перезапуске устойчивее на iPhone,
  // чем повторный start() у уже завершившегося объекта.
  recognition.continuous = false;
  recognition.maxAlternatives = 3;
  let lastError = "";
  let receivedResult = false;
  recognition.onstart = () => {
    if (generation !== continueState.recognitionGeneration) return;
    continueState.recognitionActive = true;
    button.classList.add("listening");
    button.textContent = "◉ Слушаю…";
    button.hidden = automatic;
    status.textContent = continueState.paused
      ? "Пауза. Скажи «продолжай», когда будешь готова."
      : "Слушаю. Произнеси следующий аят целиком — у тебя есть 1 минута.";
  };
  recognition.onerror = (event) => {
    if (generation !== continueState.recognitionGeneration) return;
    lastError = event.error || "unknown";
    continueState.recognitionActive = false;
    button.classList.remove("listening");
    button.textContent = "🎙️ Говорить продолжение";
    clearTimeout(continueState.speechTimer);
    const recoverable = lastError === "no-speech" || lastError === "aborted";
    if (!recoverable) {
      clearTimeout(continueState.minuteTimer);
      continueState.autoAdvance = false;
    }
    if (lastError !== "aborted") status.textContent = continueRecognitionErrorMessage(lastError);
    button.hidden = recoverable && automatic;
    continueEl("continue-reveal").hidden = recoverable;
  };
  recognition.onend = () => {
    if (generation !== continueState.recognitionGeneration) return;
    continueState.recognitionActive = false;
    if (continueState.recognition === recognition) continueState.recognition = null;
    button.classList.remove("listening");
    button.textContent = "🎙️ Говорить продолжение";
    if (continueState.repeating) return;
    if (receivedResult || continueState.speechTimer) return;
    const recoverable = !lastError || lastError === "no-speech" || lastError === "aborted";
    if (recoverable) scheduleContinueRecognition(generation, automatic, lastError === "aborted" ? 900 : 650);
  };
  recognition.onresult = (event) => {
    if (generation !== continueState.recognitionGeneration) return;
    const finalParts = [];
    const firstResult = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;
    for (let index = firstResult; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal && result[0]?.transcript) finalParts.push(result[0].transcript);
    }
    const finalText = finalParts.join(" ");
    if (!finalText) return;
    receivedResult = true;
    handleContinueTranscript(finalText, generation, automatic);
  };
  try { recognition.start(); } catch (error) {
    if (generation !== continueState.recognitionGeneration) return;
    continueState.recognition = null;
    status.textContent = "Микрофон ещё запускается — пробую снова.";
    scheduleContinueRecognition(generation, automatic, 900);
  }
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
  continueEl("continue-answer-listen").addEventListener("click", () => playContinuePrompt({ surahNumber: current.surahNumber, number: current.nextNumber }));
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
  const progress = (continueState.index / continueState.deck.length) * 100;
  continueEl("continue-progress-label").textContent = `Переход ${continueState.index + 1} из ${continueState.deck.length}`;
  continueEl("continue-score-label").textContent = `Получилось ${continueState.score}`;
  continueEl("continue-progress-bar").style.width = `${progress}%`;
  continueEl("continue-question").innerHTML = `
    <div class="continue-reference"><span>Сура ${current.surahNumber}. ${continueEscape(current.surahName)}</span><strong>После аята ${current.fromNumber}</strong></div>
    <p class="prompt">Послушай один аят и скажи следующий — варианты ответа не произносятся</p>
    <div class="continue-prompt" dir="rtl" lang="ar">${continueEscape(current.fromArabic)}</div>
    <div class="continue-prompt-translation">${continueEscape(current.fromRussian)}</div>
    <div class="continue-actions">
      <button class="continue-listen" id="continue-listen">🔊 Послушать аят Аймана Сувайда</button>
      <button class="continue-speak" id="continue-speak" hidden>🎙️ Говорить продолжение</button>
      <button class="continue-reveal" id="continue-reveal" hidden>Показать правильный аят</button>
    </div>
    <p class="continue-voice-status" id="continue-voice-status">${restored ? "Задание восстановлено после обновления. Нажми «Послушать аят» — затем микрофон включится сам." : "После озвучки микрофон включится автоматически на 1 минуту."}</p>
    <div class="continue-answer" id="continue-answer" hidden></div>
    <div id="continue-next-wrap" hidden><button class="continue-next" id="continue-next">Следующий переход →</button></div>`;

  continueEl("continue-listen").addEventListener("click", () => {
    // После чтения сразу включаем микрофон на минуту — отдельная кнопка не нужна.
    prepareContinueMicrophone();
    playContinuePrompt(
      { surahNumber: current.surahNumber, number: current.fromNumber },
      () => beginContinueListeningAfterPrompt(true)
    );
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
    playContinuePrompt(
      { surahNumber: current.surahNumber, number: current.fromNumber },
      () => beginContinueListeningAfterPrompt(true)
    );
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

function startContinueTest() {
  continueState.index = 0;
  continueState.score = 0;
  continueState.errors = 0;
  continueState.mistakes = [];
  continueState.repeating = false;
  continueState.paused = false;
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
  renderContinueQuestion();
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
    ? `<section class="continue-mistakes"><h3>Аяты для повторения</h3><p>Вот места, где ответ не совпал полностью:</p>${continueState.mistakes.map((mistake, index) => `<article class="continue-mistake"><div class="continue-mistake-meta">${index + 1}. Сура ${mistake.surahNumber}. ${continueEscape(mistake.surahName)} · после аята ${mistake.fromNumber} · повторить аят ${mistake.nextNumber}</div><p class="continue-mistake-arabic" dir="rtl" lang="ar">${continueEscape(mistake.nextArabic)}</p><p>${continueEscape(mistake.nextRussian)}</p><small>Твой ответ: ${continueEscape(mistake.spoken || "не распознан")}</small><button class="continue-mistake-listen" data-surah="${mistake.surahNumber}" data-ayah="${mistake.nextNumber}">🔊 Послушать Аймана Сувайда</button></article>`).join("")}</section>`
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
    button.addEventListener("click", () => playContinuePrompt({ surahNumber: Number(button.dataset.surah), number: Number(button.dataset.ayah) }));
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
    if (saved?.version !== 2 || !isRecent || !hasDeck || !validIndex) return false;
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
  // Запрашиваем доступ здесь, а после этого все задания идут без дополнительных кнопок.
  prepareContinueMicrophone();
  startContinueTest();
});
continueEl("exit-continue-test").addEventListener("click", returnToContinueSetup);
continueEl("continue-auto-speak").addEventListener("change", () => {
  if (!continueEl("continue-auto-speak").checked) {
    window.speechSynthesis?.cancel();
    stopContinueAudio();
  } else if (!continueEl("continue-test").hidden) {
    const current = continueState.deck[continueState.index];
    playContinuePrompt({ surahNumber: current.surahNumber, number: current.fromNumber });
  }
});

document.addEventListener("click", (event) => {
  if (event.target.id === "continue-next") {
    advanceContinueQuestion();
  }
});

restoreContinueSession();
