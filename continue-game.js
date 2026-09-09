// «Продолжи аят»: приложение произносит один аят, а пользователь
// продолжает следующий. Голосовой ответ проверяется по словам без огласовок.
const CONTINUE_SURAHS = JUZ30_SURAHS
  .filter((surah) => surah.number >= 104 && surah.number <= 114)
  .sort((a, b) => b.number - a.number);
const AYMAN_SOWAID_AUDIO_BASE = "audio/ayman-suwaid/";

function shuffleContinueItems(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function buildContinueDeck() {
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
    })))
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

let continueDeck = buildContinueDeck();

const continueState = { index: 0, score: 0, errors: 0, mistakes: [], answered: false, autoAdvance: true, repeating: false, paused: false, recognitionActive: false, deck: continueDeck, recognition: null, audio: null, audioContext: null, audioBuffers: new Map(), microphonePrimed: false, listenUntil: 0, speechTimer: null, minuteTimer: null, nextTimer: null };
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
  if (!continueState.audio) return;
  continueState.audio.onended = null;
  try { continueState.audio.stop(0); } catch (error) { /* запись уже закончилась */ }
  try { continueState.audio.disconnect(); } catch (error) { /* источник уже отключён */ }
  continueState.audio = null;
}

function getContinueAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!continueState.audioContext) continueState.audioContext = new AudioContextClass();
  if (continueState.audioContext.state === "suspended") {
    continueState.audioContext.resume().catch(() => {});
  }
  return continueState.audioContext;
}

function primeContinueMicrophone() {
  if (continueState.microphonePrimed || !navigator.mediaDevices?.getUserMedia) return Promise.resolve(true);
  continueState.microphonePrimed = true;
  return navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    stream.getTracks().forEach((track) => track.stop());
    return true;
  }).catch(() => {
    // Подробное сообщение покажет SpeechRecognition при запуске проверки.
    continueState.microphonePrimed = false;
    return false;
  });
}

function continueAyahAudioUrl(surahNumber, ayahNumber) {
  return `${AYMAN_SOWAID_AUDIO_BASE}${String(surahNumber).padStart(3, "0")}${String(ayahNumber).padStart(3, "0")}.mp3`;
}

async function playContinueAyah(ayah, onEnd, onError) {
  stopContinueAudio();
  const context = getContinueAudioContext();
  if (!context) {
    onError?.();
    return false;
  }
  const url = continueAyahAudioUrl(ayah.surahNumber, ayah.number);
  try {
    let buffer = continueState.audioBuffers.get(url);
    if (!buffer) {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error(`Audio ${response.status}`);
      buffer = await context.decodeAudioData(await response.arrayBuffer());
      continueState.audioBuffers.set(url, buffer);
    }
    if (context.state === "suspended") await context.resume();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      if (continueState.audio === source) continueState.audio = null;
      try { source.disconnect(); } catch (error) { /* источник уже отключён */ }
      onEnd?.();
    };
    continueState.audio = source;
    source.start(0);
    return true;
  } catch (error) {
    continueState.audio = null;
    onError?.();
    return false;
  }
}

function playContinuePrompt(ayah, onEnd) {
  playContinueAyah(ayah, onEnd, () => {
    const status = continueEl("continue-voice-status");
    if (status) status.textContent = "Локальная запись Аймана Сувайда не загрузилась. Обнови страницу и попробуй ещё раз.";
    if (continueState.repeating) {
      continueState.repeating = false;
      startContinueRecognition(continueState.autoAdvance);
    }
  });
}

function repeatCurrentContinueAyah() {
  if (continueState.answered || continueState.paused) return;
  clearTimeout(continueState.speechTimer);
  clearTimeout(continueState.minuteTimer);
  continueState.speechTimer = null;
  continueState.listenUntil = Date.now() + 60000;
  const current = continueState.deck[continueState.index];
  continueState.repeating = true;
  continueState.recognition?.stop();
  continueEl("continue-voice-status").textContent = "Повторяю аят. После записи у тебя снова будет 1 минута для ответа.";
  playContinuePrompt({ surahNumber: current.surahNumber, number: current.fromNumber }, () => {
    continueState.repeating = false;
    startContinueRecognition(continueState.autoAdvance);
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
}

function resumeContinueListening() {
  if (continueState.answered || !continueState.paused) return;
  continueState.paused = false;
  continueState.listenUntil = Date.now() + 60000;
  continueEl("continue-voice-status").textContent = "Продолжаем. У тебя снова 1 минута для ответа.";
  continueState.minuteTimer = setTimeout(() => evaluateContinueRecitation(""), 60000);
  if (!continueState.recognitionActive) startContinueRecognition(continueState.autoAdvance);
}

function clearContinueTimers() {
  clearTimeout(continueState.speechTimer);
  clearTimeout(continueState.minuteTimer);
  clearTimeout(continueState.nextTimer);
  continueState.speechTimer = null;
  continueState.minuteTimer = null;
  continueState.nextTimer = null;
}

function startContinueRecognition(automatic = false) {
  const Recognition = getRecognitionConstructor();
  const button = continueEl("continue-speak");
  const status = continueEl("continue-voice-status");
  if (!Recognition) {
    continueState.autoAdvance = false;
    status.textContent = "Распознавание речи недоступно. Открой сайт через HTTPS или localhost, а не file://, и разреши микрофон.";
    button.hidden = false;
    continueEl("continue-reveal").hidden = false;
    return;
  }
  clearContinueTimers();
  continueState.autoAdvance = automatic;
  if (continueState.recognition) {
    const previousRecognition = continueState.recognition;
    previousRecognition.onstart = null;
    previousRecognition.onerror = null;
    previousRecognition.onend = null;
    previousRecognition.onresult = null;
    try { previousRecognition.abort(); } catch (error) { /* прежний сеанс уже завершён */ }
  }
  const recognition = new Recognition();
  continueState.recognition = recognition;
  recognition.lang = "ar-SA";
  recognition.interimResults = false;
  // В Safari на iPhone короткие отдельные сеансы работают устойчивее.
  recognition.continuous = !isContinueIOS();
  recognition.maxAlternatives = 1;
  continueState.listenUntil = Date.now() + 60000;
  let spokenParts = [];
  let allowRestart = true;
  recognition.onstart = () => {
    continueState.recognitionActive = true;
    button.classList.add("listening");
    button.textContent = "◉ Слушаю…";
    button.hidden = !automatic;
    status.textContent = "Микрофон включён на 1 минуту. Произнеси следующий аят целиком.";
  };
  recognition.onerror = (event) => {
    continueState.recognitionActive = false;
    button.classList.remove("listening");
    button.textContent = "🎙️ Говорить продолжение";
    clearTimeout(continueState.speechTimer);
    // При отсутствии речи сохраняем общий минутный таймер и пробуем слушать снова.
    if (event.error !== "no-speech") {
      clearTimeout(continueState.minuteTimer);
      allowRestart = false;
      continueState.autoAdvance = false;
    }
    const messages = {
      "not-allowed": "Разреши доступ к микрофону в настройках браузера и нажми кнопку ещё раз.",
      "service-not-allowed": "Браузер запретил службу распознавания речи. Открой сайт через HTTPS в Chrome или Safari.",
      "audio-capture": "Микрофон не найден или уже занят другим приложением.",
      "no-speech": "Речь не услышана. Говори после появления надписи «Слушаю…».",
      "network": "Служба распознавания недоступна. Проверь интернет и открой сайт не как file://, а через HTTPS.",
      "language-not-supported": "Этот браузер не поддерживает распознавание арабской речи. Попробуй Chrome или Safari."
    };
    status.textContent = messages[event.error] || "Не удалось услышать ответ. Проверь микрофон и попробуй ещё раз.";
    button.hidden = false;
    continueEl("continue-reveal").hidden = false;
  };
  recognition.onend = () => {
    continueState.recognitionActive = false;
    button.classList.remove("listening");
    button.textContent = "🎙️ Говорить продолжение";
    if (continueState.repeating) return;
    if (allowRestart && !continueState.answered && (continueState.paused || (Date.now() < continueState.listenUntil && automatic))) {
      setTimeout(() => {
        try { recognition.start(); } catch (error) { /* браузер уже завершил слушание */ }
      }, 120);
    }
  };
  recognition.onresult = (event) => {
    // SpeechRecognitionResultList в Safari не является обычным массивом.
    const finalParts = [];
    const firstResult = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;
    for (let index = firstResult; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal && result[0]?.transcript) finalParts.push(result[0].transcript);
    }
    const finalText = finalParts.join(" ");
    if (!finalText) return;
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
    spokenParts.push(finalText);
    clearTimeout(continueState.speechTimer);
    continueState.speechTimer = setTimeout(() => evaluateContinueRecitation(spokenParts.join(" ")), 1800);
  };
  continueState.minuteTimer = setTimeout(() => evaluateContinueRecitation(spokenParts.join(" ")), 60000);
  try { recognition.start(); } catch (error) {
    status.textContent = "Не удалось включить микрофон. Нажми кнопку ещё раз или проверь разрешение микрофона.";
    button.hidden = false;
    continueEl("continue-reveal").hidden = false;
  }
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
  if (correct) speakContinueArabic("مَا شَاءَ اللَّهُ");
  else playContinuePrompt({ surahNumber: current.surahNumber, number: current.nextNumber });
  continueEl("continue-next-wrap").hidden = continueState.autoAdvance;
  if (continueState.autoAdvance) {
    continueState.nextTimer = setTimeout(advanceContinueQuestion, correct ? 3600 : 5200);
    continueEl("continue-voice-status").textContent = correct
      ? "Ответ принят. Следующий аят начнётся автоматически."
      : "Сравни ответ с правильным аятом. Следующий вопрос начнётся автоматически.";
  }
}

function evaluateContinueRecitation(spoken) {
  if (continueState.answered) return;
  if (!String(spoken || "").trim()) {
    continueState.autoAdvance = false;
    continueEl("continue-voice-status").textContent = "Я не услышала ответ. Нажми «Говорить продолжение» и попробуй ещё раз.";
    continueEl("continue-speak").hidden = false;
    continueEl("continue-reveal").hidden = false;
    return;
  }
  clearContinueTimers();
  continueState.answered = true;
  continueState.recognition?.stop();
  const current = continueState.deck[continueState.index];
  const similarity = recitationSimilarity(spoken, current.nextArabic);
  const correct = similarity >= 0.5;
  if (correct) continueState.score += 1;
  else {
    continueState.errors += 1;
    continueState.mistakes.push({ ...current, spoken, similarity });
  }
  continueEl("continue-score-label").textContent = `Получилось ${continueState.score}`;
  showContinueAnswer(correct, spoken, similarity);
}

function renderContinueQuestion() {
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
    <p class="continue-voice-status" id="continue-voice-status">После озвучки микрофон включится автоматически на 1 минуту.</p>
    <div class="continue-answer" id="continue-answer" hidden></div>
    <div id="continue-next-wrap" hidden><button class="continue-next" id="continue-next">Следующий переход →</button></div>`;

  continueEl("continue-listen").addEventListener("click", () => {
    // После чтения сразу включаем микрофон на минуту — отдельная кнопка не нужна.
    playContinuePrompt(
      { surahNumber: current.surahNumber, number: current.fromNumber },
      () => startContinueRecognition(true)
    );
  });
  continueEl("continue-speak").addEventListener("click", () => startContinueRecognition(false));
  continueEl("continue-reveal").addEventListener("click", () => {
    clearContinueTimers();
    continueState.recognition?.stop();
    continueState.autoAdvance = false;
    if (!continueState.answered) {
      continueState.answered = true;
      continueState.errors += 1;
    }
    showContinueAnswer(false, "", 0);
  });
  if (continueEl("continue-auto-speak").checked) {
    playContinuePrompt({ surahNumber: current.surahNumber, number: current.fromNumber }, () => startContinueRecognition(true));
  }
}

function advanceContinueQuestion() {
  if (continueState.index === continueState.deck.length - 1) renderContinueResult();
  else {
    continueState.index += 1;
    renderContinueQuestion();
    continueEl("continue-test").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function startContinueTest() {
  // Эти вызовы происходят прямо по нажатию пользователя: Safari разрешает
  // аудио и один раз запрашивает доступ к микрофону до начала упражнения.
  getContinueAudioContext();
  await primeContinueMicrophone();
  continueState.index = 0;
  continueState.score = 0;
  continueState.errors = 0;
  continueState.mistakes = [];
  continueState.repeating = false;
  continueState.paused = false;
  continueState.autoAdvance = true;
  continueState.deck = buildContinueDeck();
  continueEl("continue-setup").hidden = true;
  continueEl("continue-result").hidden = true;
  continueEl("continue-test").hidden = false;
  renderContinueQuestion();
  continueEl("continue-test").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderContinueResult() {
  const total = continueState.deck.length;
  const percent = Math.round((continueState.score / total) * 100);
  window.speechSynthesis?.cancel();
  stopContinueAudio();
  continueEl("continue-test").hidden = true;
  continueEl("continue-result").hidden = false;
  const mistakesMarkup = continueState.mistakes.length
    ? `<section class="continue-mistakes"><h3>Аяты для повторения</h3><p>Вот места, где ответ не совпал полностью:</p>${continueState.mistakes.map((mistake, index) => `<article class="continue-mistake"><div class="continue-mistake-meta">${index + 1}. Сура ${mistake.surahNumber}. ${continueEscape(mistake.surahName)} · после аята ${mistake.fromNumber} · повторить аят ${mistake.nextNumber}</div><p class="continue-mistake-arabic" dir="rtl" lang="ar">${continueEscape(mistake.nextArabic)}</p><p>${continueEscape(mistake.nextRussian)}</p><small>Твой ответ: ${continueEscape(mistake.spoken || "не распознан")}</small><button class="continue-mistake-listen" data-arabic="${continueEscape(mistake.nextArabic)}">🔊 Послушать аят</button></article>`).join("")}</section>`
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
    button.addEventListener("click", () => speakContinueArabic(button.dataset.arabic));
  });
  continueEl("repeat-continue-test").addEventListener("click", startContinueTest);
  continueEl("choose-continue-settings").addEventListener("click", returnToContinueSetup);
  continueEl("continue-result").scrollIntoView({ behavior: "smooth", block: "start" });
}

function returnToContinueSetup() {
  clearContinueTimers();
  continueState.repeating = false;
  continueState.paused = false;
  window.speechSynthesis?.cancel();
  stopContinueAudio();
  continueState.recognition?.abort();
  continueEl("continue-test").hidden = true;
  continueEl("continue-result").hidden = true;
  continueEl("continue-setup").hidden = false;
  continueEl("continue-setup").scrollIntoView({ behavior: "smooth", block: "start" });
}

continueEl("start-continue-test").addEventListener("click", startContinueTest);
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
