// «Скажи перевод»: Айман Сувайд читает аят, затем ученица произносит перевод.
const LISTEN_SURAHS = JUZ30_SURAHS
  .filter((surah) => surah.number >= 100 && surah.number <= 114)
  .sort((a, b) => b.number - a.number);

const LISTEN_ITEMS = LISTEN_SURAHS.flatMap((surah) => surah.ayahs.map((ayah) => ({
  ...ayah,
  surahNumber: surah.number,
  surahName: surah.name
})));

const LISTEN_STOP_WORDS = new Set(["а", "и", "в", "во", "на", "не", "ни", "но", "же", "ли", "бы", "к", "ко", "с", "со", "у", "о", "об", "от", "до", "для", "по", "из", "за", "над", "под", "при", "это", "тот", "та", "те", "его", "ее", "их"]);
const listenState = {
  deck: [], index: 0, score: 0, errors: [], running: false, paused: false,
  stage: "idle", audio: null, utterance: null, recognition: null,
  spokenParts: [], timer: null, gradeTimer: null, deadlineTimer: null, token: 0
};
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

function stopListenRecognition() {
  clearTimeout(listenState.gradeTimer);
  clearTimeout(listenState.deadlineTimer);
  listenState.gradeTimer = null;
  listenState.deadlineTimer = null;
  if (listenState.recognition) {
    listenState.recognition.onend = null;
    listenState.recognition.onerror = null;
    listenState.recognition.onresult = null;
    try { listenState.recognition.abort(); } catch (error) { /* уже остановлен */ }
    listenState.recognition = null;
  }
}

function stopListenPlayback() {
  listenState.token += 1;
  clearTimeout(listenState.timer);
  listenState.timer = null;
  stopListenRecognition();
  if (listenState.audio) {
    listenState.audio.onended = null;
    listenState.audio.onerror = null;
    listenState.audio.pause();
    listenState.audio = null;
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  listenState.utterance = null;
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

function speakListenFeedback(text, onEnd) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    onEnd?.();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 0.86;
  let finished = false;
  const finish = () => { if (!finished) { finished = true; onEnd?.(); } };
  utterance.onend = finish;
  utterance.onerror = finish;
  listenState.utterance = utterance;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function finishListenAnswer(correct, transcript = "") {
  if (listenState.stage === "feedback") return;
  const item = listenState.deck[listenState.index];
  if (!item) return;
  stopListenRecognition();
  listenState.stage = "feedback";
  listenEl("listen-translation").textContent = item.russian;
  listenEl("listen-heard").textContent = transcript ? `Услышано: ${transcript}` : "";
  if (correct) listenState.score += 1;
  else listenState.errors.push({
    ...item,
    heard: transcript || "Ответ не распознан",
    missing: listenMissingWords(transcript, item.russian)
  });
  updateListenProgress();

  const moveOn = () => {
    if (!listenState.running || listenState.paused) return;
    if (listenEl("listen-auto-next").checked) listenState.timer = setTimeout(() => moveListen(1), 1100);
    else setListenStatus(correct ? "Ма ша Аллах" : "Правильный перевод", "Нажми «Вперёд», когда будешь готова.");
  };

  if (correct) {
    setListenStatus("Ма ша Аллах", "Перевод принят как верный.");
    speakListenFeedback("Ма ша Аллах", moveOn);
  } else {
    setListenStatus("Повтори перевод", "Сейчас прозвучит правильный вариант.");
    speakListenFeedback(item.russian, moveOn);
  }
}

function startListenRecognition(token) {
  if (token !== listenState.token || listenState.paused || listenState.stage !== "answer") return;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    setListenStatus("Микрофонное распознавание недоступно", "Открой сайт в Safari или Chrome через HTTPS. Можно нажать «Не помню — ответ».");
    return;
  }
  const recognition = new Recognition();
  listenState.recognition = recognition;
  recognition.lang = "ru-RU";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.onresult = (event) => {
    if (token !== listenState.token || listenState.stage !== "answer") return;
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const phrase = event.results[index][0].transcript.trim();
      if (event.results[index].isFinal) listenState.spokenParts.push(phrase);
      else interim += ` ${phrase}`;
    }
    const transcript = [...listenState.spokenParts, interim.trim()].filter(Boolean).join(" ").trim();
    listenEl("listen-heard").textContent = transcript ? `Слышу: ${transcript}` : "Слушаю перевод…";
    const score = listenTranslationScore(transcript, listenState.deck[listenState.index].russian);
    if (score >= 0.5) {
      finishListenAnswer(true, transcript);
      return;
    }
    clearTimeout(listenState.gradeTimer);
    if (listenState.spokenParts.length) {
      listenState.gradeTimer = setTimeout(() => finishListenAnswer(false, transcript), 2600);
    }
  };
  recognition.onerror = (event) => {
    if (token !== listenState.token || listenState.stage !== "answer") return;
    if (["not-allowed", "service-not-allowed"].includes(event.error)) {
      listenState.stage = "blocked";
      setListenStatus("Нет доступа к микрофону", "Разреши микрофон для этого сайта в настройках Safari.");
      return;
    }
    if (event.error !== "aborted") setListenStatus("Слушаю ещё раз", "Произнеси перевод целиком.");
  };
  recognition.onend = () => {
    if (token !== listenState.token || listenState.paused || listenState.stage !== "answer" || listenState.gradeTimer) return;
    listenState.timer = setTimeout(() => startListenRecognition(token), 350);
  };
  try {
    recognition.start();
    setListenStatus("Твой перевод", "Микрофон слушает. Произнеси перевод по-русски — у тебя 1 минута.");
  } catch (error) {
    listenState.timer = setTimeout(() => startListenRecognition(token), 500);
  }
}

function beginListenAnswer(item, token) {
  if (token !== listenState.token || listenState.paused) return;
  listenState.stage = "answer";
  listenState.spokenParts = [];
  listenEl("listen-translation").textContent = "Теперь произнеси перевод этого аята по-русски.";
  listenEl("listen-heard").textContent = "Слушаю перевод…";
  startListenRecognition(token);
  listenState.deadlineTimer = setTimeout(() => finishListenAnswer(false, listenState.spokenParts.join(" ")), 60000);
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
  listenEl("listen-pause").textContent = "⏸ Пауза";
  listenState.stage = "arabic";
  setListenStatus("Читает Айман Сувайд", "После аята микрофон автоматически включится для твоего перевода.");
  const audio = new Audio(listenAudioUrl(item));
  listenState.audio = audio;
  audio.preload = "auto";
  audio.onended = () => {
    if (token !== listenState.token) return;
    listenState.audio = null;
    listenState.timer = setTimeout(() => beginListenAnswer(item, token), 450);
  };
  audio.onerror = () => {
    if (token !== listenState.token) return;
    listenState.audio = null;
    setListenStatus("Запись аята недоступна", "Нажми «Повторить» или перейди к следующему аяту.");
  };
  audio.play().catch(() => setListenStatus("Нажми «Повторить»", "Safari ждёт касания, чтобы разрешить звук."));
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
    stopListenRecognition();
    if (listenState.audio) listenState.audio.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    listenEl("listen-pause").textContent = "▶ Продолжить";
    setListenStatus("Пауза", "Нажми «Продолжить», когда будешь готова.");
    return;
  }
  listenState.paused = false;
  listenEl("listen-pause").textContent = "⏸ Пауза";
  if (listenState.stage === "arabic" && listenState.audio) {
    setListenStatus("Читает Айман Сувайд", "После аята микрофон автоматически включится.");
    listenState.audio.play().catch(playListenCurrent);
  } else if (listenState.stage === "answer") {
    setListenStatus("Твой перевод", "Микрофон снова слушает.");
    const token = listenState.token;
    startListenRecognition(token);
    listenState.deadlineTimer = setTimeout(() => finishListenAnswer(false, listenState.spokenParts.join(" ")), 60000);
  } else playListenCurrent();
}

function showListenResult() {
  stopListenPlayback();
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

function startListenSession() {
  stopListenPlayback();
  const randomOrder = document.querySelector('input[name="listen-order"]:checked')?.value === "random";
  listenState.deck = randomOrder ? shuffleListenItems(LISTEN_ITEMS) : [...LISTEN_ITEMS];
  listenState.index = 0;
  listenState.score = 0;
  listenState.errors = [];
  listenEl("listen-setup").hidden = true;
  listenEl("listen-result").hidden = true;
  listenEl("listen-player").hidden = false;
  playListenCurrent();
}

function showListenSetup() {
  stopListenPlayback();
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
listenEl("listen-reveal").addEventListener("click", () => finishListenAnswer(false, listenState.spokenParts.join(" ")));
window.showListenSetup = showListenSetup;
