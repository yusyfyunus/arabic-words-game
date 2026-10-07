// «Скажи перевод»: Айман Сувайд читает аят, затем ученица произносит перевод.
const LISTEN_SURAHS = JUZ30_SURAHS
  .filter((surah) => surah.number >= 98 && surah.number <= 114)
  .sort((a, b) => b.number - a.number);

const LISTEN_ITEMS = LISTEN_SURAHS.flatMap((surah) => surah.ayahs.map((ayah) => ({
  ...ayah,
  surahNumber: surah.number,
  surahName: surah.name
})));

const LISTEN_STOP_WORDS = new Set(["а", "и", "в", "во", "на", "не", "ни", "но", "же", "ли", "бы", "к", "ко", "с", "со", "у", "о", "об", "от", "до", "для", "по", "из", "за", "над", "под", "при", "это", "тот", "та", "те", "его", "ее", "их"]);
const listenState = {
  deck: [], index: 0, score: 0, errors: [], running: false, paused: false,
  stage: "idle", audio: null, audioPlayer: null, audioContext: null,
  audioSource: null, audioBuffers: new Map(), audioToken: 0,
  utterance: null, recognition: null,
  recognitionActive: false, recognitionGeneration: 0, recognitionRestartTimer: null,
  recognitionStartTimer: null, recognitionWatchdogTimer: null, recognitionRecoveryCount: 0,
  microphoneStream: null, microphonePermissionPromise: null,
  microphonePermission: "unknown", microphonePrimed: false, microphoneRequestGeneration: 0,
  spokenParts: [], currentTranscript: "", listenUntil: 0,
  manualFallbackActive: false,
  gradedItems: new Set(),
  timer: null, gradeTimer: null, deadlineTimer: null, feedbackTimer: null, token: 0
};
const LISTEN_SILENCE_MS = 5000;
const listenEl = (id) => document.getElementById(id);
const listenEscape = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function shuffleListenItems(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function listenAudioUrl(item) {
  return `audio/ayman-suwaid/${String(item.surahNumber).padStart(3, "0")}${String(item.number).padStart(3, "0")}.mp3`;
}

function listenItemId(item) {
  return `${item.surahNumber}:${item.number}`;
}

function setListenAudioSession(type) {
  try {
    if (navigator.audioSession && "type" in navigator.audioSession) navigator.audioSession.type = type;
  } catch (error) { /* Audio Session API поддерживается не во всех версиях Safari */ }
}

function ensureListenAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!listenState.audioContext) listenState.audioContext = new AudioContextClass();
  if (listenState.audioContext.state === "suspended") {
    listenState.audioContext.resume().catch(() => {});
  }
  return listenState.audioContext;
}

function unlockListenAudio() {
  const context = ensureListenAudioContext();
  if (!context) return;
  try {
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
    source.connect(context.destination);
    source.start(0);
  } catch (error) { /* Safari уже разрешил звук или не требует разблокировки */ }
}

function stopListenAudio() {
  listenState.audioToken += 1;
  if (listenState.audioSource) {
    listenState.audioSource.onended = null;
    try { listenState.audioSource.stop(0); } catch (error) { /* источник уже остановлен */ }
    try { listenState.audioSource.disconnect(); } catch (error) { /* источник уже отключён */ }
    listenState.audioSource = null;
  }
  if (listenState.audio) {
    listenState.audio.onended = null;
    listenState.audio.onerror = null;
    try { listenState.audio.pause(); } catch (error) { /* запись уже закончилась */ }
    try { listenState.audio.currentTime = 0; } catch (error) { /* файл ещё не загрузился */ }
    listenState.audio = null;
  }
}

function loadListenAudioBuffer(url) {
  const context = ensureListenAudioContext();
  if (!context) return Promise.reject(new Error("Web Audio API unavailable"));
  if (!listenState.audioBuffers.has(url)) {
    const bufferPromise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Audio ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => context.decodeAudioData(bytes))
      .catch((error) => {
        listenState.audioBuffers.delete(url);
        throw error;
      });
    listenState.audioBuffers.set(url, bufferPromise);
  }
  return listenState.audioBuffers.get(url);
}

function playListenAudioElement(item, token, onEnd, onError) {
  const audio = listenState.audioPlayer || new Audio();
  listenState.audioPlayer = audio;
  audio.src = listenAudioUrl(item);
  audio.preload = "auto";
  audio.playsInline = true;
  listenState.audio = audio;
  let failed = false;
  const fail = () => {
    if (failed || token !== listenState.audioToken) return;
    failed = true;
    if (listenState.audio === audio) listenState.audio = null;
    onError?.();
  };
  audio.onended = () => {
    if (token !== listenState.audioToken) return;
    if (listenState.audio === audio) listenState.audio = null;
    onEnd?.();
  };
  audio.onerror = fail;
  const playPromise = audio.play();
  if (playPromise?.catch) playPromise.catch(fail);
}

function playListenAyah(item, onEnd, onError) {
  stopListenAudio();
  setListenAudioSession("playback");
  const token = listenState.audioToken;
  const context = ensureListenAudioContext();
  if (!context) return playListenAudioElement(item, token, onEnd, onError);
  const url = listenAudioUrl(item);
  let failed = false;
  const fail = () => {
    if (failed || token !== listenState.audioToken) return;
    failed = true;
    // На iPhone media-элемент после воспроизведения может заблокировать
    // последующий SpeechRecognition. Поэтому там не используем такой fallback.
    if (isListenIOS()) onError?.();
    else playListenAudioElement(item, token, onEnd, onError);
  };
  loadListenAudioBuffer(url)
    .then((buffer) => context.resume().then(() => buffer))
    .then((buffer) => {
      if (token !== listenState.audioToken) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      listenState.audioSource = source;
      source.onended = () => {
        if (token !== listenState.audioToken) return;
        if (listenState.audioSource === source) listenState.audioSource = null;
        try { source.disconnect(); } catch (error) { /* уже отключён */ }
        onEnd?.();
      };
      source.start(0);
    })
    .catch(fail);
}

function normalizeListenWords(text) {
  return String(text).toLowerCase().replaceAll("ё", "е")
    .replace(/[^а-яa-z0-9\s-]/gi, " ").split(/\s+/).filter(Boolean)
    .filter((word) => !LISTEN_STOP_WORDS.has(word));
}

function listenWordMatches(first, second) {
  if (first === second) return true;
  if (first.length < 4 || second.length < 4) return false;
  return first.slice(0, 5) === second.slice(0, 5) || first.startsWith(second) || second.startsWith(first);
}

function listenTranslationScore(spoken, expected) {
  const heard = normalizeListenWords(spoken);
  const target = normalizeListenWords(expected);
  if (!heard.length || !target.length) return 0;
  const matched = target.filter((word) => heard.some((candidate) => listenWordMatches(word, candidate))).length;
  return matched / target.length;
}

function listenTranslationAccepted(spoken, expected) {
  const target = normalizeListenWords(expected);
  const score = listenTranslationScore(spoken, expected);
  // В ответе из одного-двух слов сохраняем строгость. Для трёх слов принимаем
  // два совпавших: Safari на iPhone часто меняет окончание третьего слова.
  if (target.length <= 2) return score >= 0.99;
  if (target.length === 3) return score >= 0.66;
  return score >= 0.7;
}

function listenMissingWords(spoken, expected) {
  const heard = normalizeListenWords(spoken);
  const missing = normalizeListenWords(expected)
    .filter((word) => !heard.some((candidate) => listenWordMatches(word, candidate)));
  return [...new Set(missing)];
}

function listenHighlightedTranslation(expected, missingWords = []) {
  const missing = new Set(missingWords);
  return String(expected).split(/(\s+)/).map((part) => {
    const normalized = normalizeListenWords(part)[0];
    const escaped = listenEscape(part);
    return normalized && missing.has(normalized)
      ? `<mark class="listen-missed-word">${escaped}</mark>`
      : escaped;
  }).join("");
}

function isListenIOS() {
  const userAgent = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function prepareListenMicrophone() {
  if (isListenIOS() && listenState.microphonePrimed && listenState.microphonePermission === "granted") {
    return Promise.resolve(true);
  }
  if (listenState.microphoneStream?.getAudioTracks().some((track) => track.readyState === "live")) {
    return Promise.resolve(true);
  }
  if (listenState.microphonePermissionPromise) return listenState.microphonePermissionPromise;
  const status = listenEl("listen-permission-status");
  if (!navigator.mediaDevices?.getUserMedia) {
    listenState.microphonePermission = "unsupported";
    if (status) status.textContent = "Safari не предоставил доступ к микрофону. Открой публичный сайт через HTTPS и проверь настройки сайта.";
    return Promise.resolve(false);
  }
  if (status) status.textContent = "Разреши микрофон один раз — он останется готовым до конца занятия.";
  const requestGeneration = listenState.microphoneRequestGeneration;
  listenState.microphonePermissionPromise = navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      if (requestGeneration !== listenState.microphoneRequestGeneration) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      listenState.microphonePermission = "granted";
      listenState.microphonePrimed = true;
      if (isListenIOS()) {
        // На iPhone постоянно открытый getUserMedia-поток мешает аудио и
        // встроенному SpeechRecognition. Разрешение уже получено, поэтому
        // освобождаем вход и дальше используем распознавание Safari.
        stream.getTracks().forEach((track) => track.stop());
        listenState.microphoneStream = null;
      } else listenState.microphoneStream = stream;
      if (status) status.textContent = "Микрофон готов. Повторное разрешение между аятами не потребуется.";
      return true;
    })
    .catch(() => {
      if (requestGeneration !== listenState.microphoneRequestGeneration) return false;
      listenState.microphonePermission = "denied";
      listenState.microphonePrimed = false;
      if (status) status.textContent = "Микрофон запрещён. В Safari открой «аА» → «Настройки веб-сайта» → «Микрофон» → «Разрешить».";
      return false;
    })
    .finally(() => {
      if (requestGeneration === listenState.microphoneRequestGeneration) {
        listenState.microphonePermissionPromise = null;
      }
    });
  return listenState.microphonePermissionPromise;
}

function releaseListenMicrophone() {
  listenState.microphoneRequestGeneration += 1;
  listenState.microphoneStream?.getTracks().forEach((track) => track.stop());
  listenState.microphoneStream = null;
  listenState.microphonePermissionPromise = null;
  listenState.microphonePrimed = false;
}

function stopListenRecognition() {
  clearTimeout(listenState.gradeTimer);
  clearTimeout(listenState.deadlineTimer);
  clearTimeout(listenState.recognitionRestartTimer);
  clearTimeout(listenState.recognitionStartTimer);
  clearTimeout(listenState.recognitionWatchdogTimer);
  listenState.gradeTimer = null;
  listenState.deadlineTimer = null;
  listenState.recognitionRestartTimer = null;
  listenState.recognitionStartTimer = null;
  listenState.recognitionWatchdogTimer = null;
  listenState.recognitionGeneration += 1;
  const recognition = listenState.recognition;
  listenState.recognition = null;
  listenState.recognitionActive = false;
  if (!recognition) return;
  recognition.onstart = null;
  recognition.onend = null;
  recognition.onerror = null;
  recognition.onresult = null;
  try { recognition.abort(); } catch (error) { /* уже остановлен */ }
}

function stopListenPlayback() {
  listenState.token += 1;
  clearTimeout(listenState.timer);
  clearTimeout(listenState.feedbackTimer);
  listenState.timer = null;
  listenState.feedbackTimer = null;
  stopListenRecognition();
  stopListenAudio();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  listenState.utterance = null;
  setListenAudioSession("auto");
}

function updateListenProgress() {
  const total = listenState.deck.length || LISTEN_ITEMS.length;
  const position = Math.min(listenState.index + 1, total);
  listenEl("listen-progress-label").textContent = `Аят ${position} из ${total} · верно ${listenState.score}`;
  listenEl("listen-progress-bar").style.width = `${total ? (position / total) * 100 : 0}%`;
}

function setListenStatus(stage, status) {
  listenEl("listen-stage").textContent = stage;
  listenEl("listen-status").textContent = status;
}

function playListenFeedback(correct, text, onEnd) {
  clearTimeout(listenState.feedbackTimer);
  stopListenAudio();
  setListenAudioSession("playback");
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(listenState.feedbackTimer);
    listenState.feedbackTimer = null;
    listenState.utterance = null;
    setListenAudioSession("auto");
    onEnd?.();
  };
  listenState.feedbackTimer = setTimeout(finish, 3800);

  if (correct) {
    const context = ensureListenAudioContext();
    const token = listenState.audioToken;
    if (context) {
      loadListenAudioBuffer("audio/feedback/mashaallah.wav")
        .then((buffer) => context.resume().then(() => buffer))
        .then((buffer) => {
          if (finished || token !== listenState.audioToken) return;
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          listenState.audioSource = source;
          source.onended = () => {
            if (listenState.audioSource === source) listenState.audioSource = null;
            try { source.disconnect(); } catch (error) { /* уже отключён */ }
            finish();
          };
          source.start(0);
        })
        .catch(() => finish());
      return;
    }
  }

  // Между сеансами распознавания на iPhone не запускаем speechSynthesis:
  // WebKit может после него перестать возвращать onresult. Правильный перевод
  // уже показан на экране, и страховочный таймер продолжит занятие.
  if (isListenIOS() || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 0.86;
  utterance.onend = finish;
  utterance.onerror = finish;
  listenState.utterance = utterance;
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  setTimeout(() => {
    if (!finished) window.speechSynthesis.speak(utterance);
  }, 70);
}

function hideListenManualFallback() {
  listenState.manualFallbackActive = false;
  const fallback = listenEl("listen-manual-fallback");
  const input = listenEl("listen-manual-answer");
  if (fallback) fallback.hidden = true;
  if (input) input.value = "";
}

function showListenManualFallback(message) {
  listenState.manualFallbackActive = true;
  stopListenRecognition();
  listenState.stage = "answer";
  const fallback = listenEl("listen-manual-fallback");
  if (fallback) fallback.hidden = false;
  setListenStatus("Safari не передал речь", message || "Нажми микрофон на клавиатуре iPhone, продиктуй перевод и нажми «Проверить ответ».");
}

function finishListenAnswer(correct, transcript = "") {
  if (listenState.stage === "feedback") return;
  const item = listenState.deck[listenState.index];
  if (!item) return;
  const answerToken = listenState.token;
  const answerIndex = listenState.index;
  stopListenRecognition();
  hideListenManualFallback();
  listenState.stage = "feedback";
  listenEl("listen-translation").textContent = item.russian;
  listenEl("listen-heard").textContent = transcript ? `Услышано: ${transcript}` : "";
  const itemId = listenItemId(item);
  if (!listenState.gradedItems.has(itemId)) {
    listenState.gradedItems.add(itemId);
    if (correct) listenState.score += 1;
    else listenState.errors.push({
      ...item,
      heard: transcript || "Ответ не распознан",
      missing: listenMissingWords(transcript, item.russian)
    });
  }
  updateListenProgress();

  const moveOn = () => {
    if (!listenState.running || listenState.paused
      || answerToken !== listenState.token || answerIndex !== listenState.index
      || listenState.stage !== "feedback") return;
    if (listenEl("listen-auto-next").checked) listenState.timer = setTimeout(() => moveListen(1), 1100);
    else setListenStatus(correct ? "Ма ша Аллах" : "Правильный перевод", "Нажми «Вперёд», когда будешь готова.");
  };

  if (correct) {
    setListenStatus("Ма ша Аллах", "Перевод принят как верный.");
    playListenFeedback(true, "Ма ша Аллах", moveOn);
  } else {
    setListenStatus(
      isListenIOS() ? "Правильный перевод" : "Повтори перевод",
      isListenIOS() ? "Правильный вариант показан на экране." : "Сейчас прозвучит правильный вариант."
    );
    playListenFeedback(false, item.russian, moveOn);
  }
}

function recoverListenRecognition(token, generation, recognition, message) {
  if (token !== listenState.token || generation !== listenState.recognitionGeneration
    || listenState.stage !== "answer" || listenState.manualFallbackActive) return;
  listenState.recognitionRecoveryCount += 1;
  recognition.onstart = null;
  recognition.onend = null;
  recognition.onerror = null;
  recognition.onresult = null;
  try { recognition.abort(); } catch (error) { /* зависший сеанс может не отвечать */ }
  if (listenState.recognition === recognition) listenState.recognition = null;
  listenState.recognitionActive = false;
  clearTimeout(listenState.recognitionStartTimer);
  clearTimeout(listenState.recognitionWatchdogTimer);
  if (listenState.recognitionRecoveryCount >= 2) {
    showListenManualFallback(message);
    return;
  }
  setListenStatus("Перезапускаю микрофон", "Safari не передал услышанный текст. Повтори перевод после сообщения «Микрофон слушает».");
  listenState.recognitionRestartTimer = setTimeout(() => startListenRecognition(token), isListenIOS() ? 1500 : 600);
}

function startListenRecognition(token) {
  if (token !== listenState.token || listenState.paused || listenState.stage !== "answer" || listenState.manualFallbackActive) return;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    showListenManualFallback("Автоматическое распознавание недоступно. Нажми микрофон на клавиатуре iPhone, продиктуй перевод и проверь его.");
    return;
  }
  const generation = listenState.recognitionGeneration;
  setListenAudioSession("play-and-record");
  const recognition = new Recognition();
  listenState.recognition = recognition;
  recognition.lang = "ru-RU";
  recognition.interimResults = true;
  // На iPhone continuous=true часто зависает после первого короткого ответа.
  // Safari работает короткими сеансами, которые автоматически перезапускаются.
  recognition.continuous = !isListenIOS();
  recognition.maxAlternatives = 3;
  let bestTranscript = "";
  let receivedResult = false;
  let lastError = "";
  recognition.onstart = () => {
    if (token !== listenState.token || generation !== listenState.recognitionGeneration) return;
    listenState.recognitionActive = true;
    clearTimeout(listenState.recognitionStartTimer);
    listenState.recognitionStartTimer = null;
    setListenStatus("Твой перевод", "Микрофон слушает. Произнеси перевод по-русски — у тебя 1 минута.");
    clearTimeout(listenState.recognitionWatchdogTimer);
    listenState.recognitionWatchdogTimer = setTimeout(() => {
      if (receivedResult || token !== listenState.token || listenState.stage !== "answer") return;
      recoverListenRecognition(token, generation, recognition, "Safari включил микрофон, но дважды не передал текст. Продиктуй ответ через микрофон клавиатуры.");
    }, 15000);
  };
  recognition.onresult = (event) => {
    if (token !== listenState.token || generation !== listenState.recognitionGeneration || listenState.stage !== "answer") return;
    const heardParts = [];
    for (let index = 0; index < event.results.length; index += 1) {
      const phrase = event.results[index]?.[0]?.transcript?.trim();
      if (phrase) heardParts.push(phrase);
    }
    const currentPart = heardParts.join(" ").trim();
    if (!currentPart) return;
    receivedResult = true;
    listenState.recognitionRecoveryCount = 0;
    bestTranscript = currentPart;
    listenState.currentTranscript = currentPart;
    const transcript = [...listenState.spokenParts, currentPart].filter(Boolean).join(" ").trim();
    listenEl("listen-heard").textContent = transcript ? `Слышу: ${transcript}` : "Слушаю перевод…";
    if (listenTranslationAccepted(transcript, listenState.deck[listenState.index].russian)) {
      finishListenAnswer(true, transcript);
      return;
    }
    clearTimeout(listenState.gradeTimer);
    listenState.gradeTimer = setTimeout(() => {
      const completeTranscript = [...listenState.spokenParts, listenState.currentTranscript]
        .filter(Boolean).join(" ").trim();
      finishListenAnswer(false, completeTranscript || transcript);
    }, LISTEN_SILENCE_MS);
  };
  recognition.onerror = (event) => {
    if (token !== listenState.token || generation !== listenState.recognitionGeneration || listenState.stage !== "answer") return;
    lastError = event.error || "unknown";
    listenState.recognitionActive = false;
    clearTimeout(listenState.recognitionWatchdogTimer);
    clearTimeout(listenState.recognitionStartTimer);
    listenState.recognitionWatchdogTimer = null;
    if (["not-allowed", "service-not-allowed"].includes(event.error)) {
      showListenManualFallback("Safari не разрешил автоматическое распознавание. Разреши микрофон сайту или продиктуй перевод через клавиатуру iPhone.");
      return;
    }
    if (event.error === "network") {
      recoverListenRecognition(token, generation, recognition, "Служба распознавания Safari дважды не ответила. Продиктуй перевод через микрофон клавиатуры.");
      return;
    } else if (event.error === "audio-capture") {
      recoverListenRecognition(token, generation, recognition, "Safari дважды не получил звук с микрофона. Закрой звонок или диктофон либо продиктуй перевод через микрофон клавиатуры.");
      return;
    } else if (event.error !== "aborted") {
      setListenStatus("Слушаю ещё раз", "Произнеси перевод целиком.");
    }
  };
  recognition.onend = () => {
    if (token !== listenState.token || generation !== listenState.recognitionGeneration) return;
    listenState.recognitionActive = false;
    clearTimeout(listenState.recognitionWatchdogTimer);
    clearTimeout(listenState.recognitionStartTimer);
    listenState.recognitionWatchdogTimer = null;
    if (listenState.recognition === recognition) listenState.recognition = null;
    if (bestTranscript) {
      const previous = listenState.spokenParts.at(-1);
      if (previous !== bestTranscript) listenState.spokenParts.push(bestTranscript);
      listenState.currentTranscript = "";
    }
    // Даже если уже идёт отсчёт тишины, новый короткий сеанс Safari должен
    // продолжить слушать. Следующий фрагмент сбросит таймер и дополнит ответ.
    if (listenState.paused || listenState.manualFallbackActive || listenState.stage !== "answer" || Date.now() >= listenState.listenUntil) return;
    const retryDelay = lastError === "network" ? 1800 : isListenIOS() ? 700 : 350;
    listenState.recognitionRestartTimer = setTimeout(() => startListenRecognition(token), retryDelay);
  };
  clearTimeout(listenState.recognitionStartTimer);
  listenState.recognitionStartTimer = setTimeout(() => {
    if (!receivedResult && !listenState.recognitionActive) {
      recoverListenRecognition(token, generation, recognition, "Safari дважды не запустил распознавание. Продиктуй перевод через микрофон клавиатуры.");
    }
  }, 6000);
  try {
    const track = listenState.microphoneStream?.getAudioTracks()
      .find((audioTrack) => audioTrack.readyState === "live");
    if (track && !isListenIOS()) {
      try { recognition.start(track); }
      catch (error) {
        if (error.name !== "TypeError" && error.name !== "NotSupportedError") throw error;
        recognition.start();
      }
    } else recognition.start();
  } catch (error) {
    if (token !== listenState.token || generation !== listenState.recognitionGeneration) return;
    listenState.recognition = null;
    listenState.recognitionActive = false;
    clearTimeout(listenState.recognitionStartTimer);
    recoverListenRecognition(token, generation, recognition, "Safari не смог запустить распознавание. Продиктуй перевод через микрофон клавиатуры.");
  }
}

function beginListenAnswer(item, token) {
  if (token !== listenState.token || listenState.paused) return;
  listenState.stage = "answer";
  listenState.spokenParts = [];
  listenState.currentTranscript = "";
  listenState.recognitionRecoveryCount = 0;
  hideListenManualFallback();
  listenState.listenUntil = Date.now() + 60000;
  listenEl("listen-translation").textContent = "Теперь произнеси перевод этого аята по-русски.";
  listenEl("listen-heard").textContent = isListenIOS() ? "Готовлю микрофон Safari…" : "Слушаю перевод…";
  prepareListenMicrophone().then((granted) => {
    if (token !== listenState.token || listenState.stage !== "answer") return;
    if (!granted) {
      showListenManualFallback("Микрофон сайта не включился. Нажми микрофон на русской клавиатуре iPhone, продиктуй перевод и нажми «Проверить ответ».");
      return;
    }
    startListenRecognition(token);
    listenState.deadlineTimer = setTimeout(() => {
      const transcript = [...listenState.spokenParts, listenState.currentTranscript].filter(Boolean).join(" ").trim();
      finishListenAnswer(false, transcript);
    }, 60000);
  });
}

function playListenCurrent() {
  stopListenPlayback();
  listenState.running = true;
  listenState.paused = false;
  const token = listenState.token;
  const item = listenState.deck[listenState.index];
  if (!item) return showListenResult();
  updateListenProgress();
  listenEl("listen-surah-label").textContent = `${item.surahName} · аят ${item.number}`;
  listenEl("listen-arabic").textContent = item.arabic;
  listenEl("listen-translation").textContent = "Сначала внимательно послушай аят.";
  listenEl("listen-heard").textContent = "";
  hideListenManualFallback();
  listenEl("listen-pause").textContent = "⏸ Пауза";
  listenState.stage = "arabic";
  setListenStatus("Читает Айман Сувайд", "После аята микрофон автоматически включится для твоего перевода.");
  playListenAyah(item, () => {
    if (token !== listenState.token) return;
    setListenStatus("Аят закончен", isListenIOS() ? "Safari освобождает звук. Начинай отвечать, когда появится «Микрофон слушает»." : "Сейчас включится микрофон.");
    listenState.timer = setTimeout(() => beginListenAnswer(item, token), isListenIOS() ? 3500 : 450);
  }, () => {
    if (token !== listenState.token) return;
    setListenStatus("Запись аята недоступна", "Нажми «Повторить» или перейди к следующему аяту.");
  });
}

function moveListen(step) {
  if (!listenState.deck.length) return;
  const nextIndex = listenState.index + step;
  if (nextIndex < 0) listenState.index = 0;
  else if (nextIndex >= listenState.deck.length) return showListenResult();
  else listenState.index = nextIndex;
  playListenCurrent();
}

function pauseListen() {
  if (!listenState.running) return;
  if (!listenState.paused) {
    listenState.paused = true;
    clearTimeout(listenState.timer);
    if (listenState.currentTranscript && listenState.spokenParts.at(-1) !== listenState.currentTranscript) {
      listenState.spokenParts.push(listenState.currentTranscript);
      listenState.currentTranscript = "";
    }
    stopListenRecognition();
    stopListenAudio();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    listenEl("listen-pause").textContent = "▶ Продолжить";
    setListenStatus("Пауза", "Нажми «Продолжить», когда будешь готова.");
    return;
  }
  listenState.paused = false;
  listenEl("listen-pause").textContent = "⏸ Пауза";
  if (listenState.stage === "arabic") {
    // BufferSource нельзя продолжить с середины, поэтому после паузы
    // безопасно начинаем текущий аят сначала.
    playListenCurrent();
  } else if (listenState.stage === "answer") {
    setListenStatus("Твой перевод", "Микрофон снова слушает.");
    const token = listenState.token;
    startListenRecognition(token);
    listenState.listenUntil = Date.now() + 60000;
    listenState.deadlineTimer = setTimeout(() => {
      const transcript = [...listenState.spokenParts, listenState.currentTranscript].filter(Boolean).join(" ").trim();
      finishListenAnswer(false, transcript);
    }, 60000);
  } else playListenCurrent();
}

function showListenResult() {
  stopListenPlayback();
  releaseListenMicrophone();
  listenState.running = false;
  listenEl("listen-player").hidden = true;
  listenEl("listen-result").hidden = false;
  const errorList = listenState.errors.length ? `
    <section class="listen-error-list">
      <h3>Где именно были ошибки</h3>
      <p class="listen-error-note">Цветом выделены слова правильного перевода, которые сайт не услышал или распознал иначе.</p>
      ${listenState.errors.map((error, errorIndex) => `
        <article class="listen-error-item">
          <div class="listen-error-meta">${listenEscape(error.surahName)} · аят ${error.number}</div>
          <div class="listen-error-arabic" dir="rtl" lang="ar">${listenEscape(error.arabic)}</div>
          <p><strong>Сайт услышал:</strong> ${listenEscape(error.heard)}</p>
          <p><strong>Правильный перевод:</strong> ${listenHighlightedTranslation(error.russian, error.missing)}</p>
          <p class="listen-error-missing"><strong>Пропущено или сказано иначе:</strong> ${listenEscape(error.missing.join(", ") || "ответ был близок, но совпадение оказалось ниже 50%")}</p>
          <button type="button" data-listen-error-audio="${errorIndex}">🔊 Послушать аят</button>
        </article>`).join("")}
    </section>` : "";
  listenEl("listen-result").innerHTML = `
    <div class="listen-result-screen">
      <p class="eyebrow">Проверка завершена</p>
      <h2>${listenState.score} из ${listenState.deck.length} переводов верно</h2>
      <p>${listenState.errors.length ? `Повтори аяты, где было ошибок: ${listenState.errors.length}.` : "Ма ша Аллах — все переводы приняты без ошибок."}</p>
      ${errorList}
      <button id="repeat-listen-session">Начать заново</button>
    </div>`;
  listenEl("repeat-listen-session").addEventListener("click", startListenSession);
  document.querySelectorAll("[data-listen-error-audio]").forEach((button) => {
    button.addEventListener("click", () => {
      const error = listenState.errors[Number(button.dataset.listenErrorAudio)];
      if (error) new Audio(listenAudioUrl(error)).play().catch(() => {});
    });
  });
}

async function startListenSession() {
  // Выполняется до первого await, то есть внутри нажатия пользователя.
  // Это один раз разблокирует Web Audio для всех аятов в Safari.
  unlockListenAudio();
  stopListenPlayback();
  const startButton = listenEl("start-listen-session");
  if (startButton) startButton.disabled = true;
  const granted = await prepareListenMicrophone();
  if (startButton) startButton.disabled = false;
  const randomOrder = document.querySelector('input[name="listen-order"]:checked')?.value === "random";
  listenState.deck = randomOrder ? shuffleListenItems(LISTEN_ITEMS) : [...LISTEN_ITEMS];
  listenState.index = 0;
  listenState.score = 0;
  listenState.errors = [];
  listenState.gradedItems = new Set();
  listenEl("listen-setup").hidden = true;
  listenEl("listen-result").hidden = true;
  listenEl("listen-player").hidden = false;
  playListenCurrent();
  if (!granted) {
    const status = listenEl("listen-permission-status");
    if (status) status.textContent = "Автоматический микрофон недоступен. После аята можно продиктовать ответ через микрофон клавиатуры iPhone.";
  }
}

function showListenSetup() {
  stopListenPlayback();
  releaseListenMicrophone();
  listenState.running = false;
  listenEl("listen-player").hidden = true;
  listenEl("listen-result").hidden = true;
  listenEl("listen-setup").hidden = false;
}

listenEl("start-listen-session").addEventListener("click", startListenSession);
listenEl("exit-listen-session").addEventListener("click", showListenSetup);
listenEl("listen-previous").addEventListener("click", () => moveListen(-1));
listenEl("listen-next").addEventListener("click", () => moveListen(1));
listenEl("listen-repeat").addEventListener("click", playListenCurrent);
listenEl("listen-pause").addEventListener("click", pauseListen);
listenEl("listen-manual-check").addEventListener("click", () => {
  const input = listenEl("listen-manual-answer");
  const transcript = input.value.trim();
  if (!transcript || listenState.stage !== "answer") return;
  const current = listenState.deck[listenState.index];
  finishListenAnswer(listenTranslationAccepted(transcript, current.russian), transcript);
});
listenEl("listen-reveal").addEventListener("click", () => {
  const transcript = [...listenState.spokenParts, listenState.currentTranscript].filter(Boolean).join(" ").trim();
  finishListenAnswer(false, transcript);
});
if (location.protocol === "file:") listenEl("listen-origin-notice").hidden = false;
document.addEventListener("click", (event) => {
  const destination = event.target.closest?.("[data-open-project]")?.dataset.openProject;
  if (destination && destination !== "listen") {
    stopListenPlayback();
    releaseListenMicrophone();
    listenState.running = false;
  }
});
window.addEventListener("pagehide", () => {
  stopListenPlayback();
  releaseListenMicrophone();
  listenState.running = false;
});
window.showListenSetup = showListenSetup;
