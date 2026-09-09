const DAILY_SURAHS = JUZ30_SURAHS
  .filter((surah) => surah.number >= 102 && surah.number <= 114)
  .sort((a, b) => b.number - a.number);

const DAILY_DAYS = 7;
const DAILY_PROGRESS_KEY = "kalimat-daily-progress-v1";
const DAILY_AYAH_ENTRIES = DAILY_SURAHS.flatMap((surah) => surah.ayahs.map((ayah) => ({
  ...ayah,
  surahNumber: surah.number,
  surahName: surah.name,
  arabicSurahName: surah.arabicName,
  meaning: surah.meaning
})));
const DAILY_WORD_ENTRIES = LESSONS.flatMap((lesson) => lesson.words.map((word) => ({
  ...word,
  lessonTitle: lesson.title
})));

const dailyState = {
  day: 0,
  units: [],
  index: 0,
  score: 0,
  errors: [],
  revealed: false,
  answered: false
};

let dailyProgress = {};
try {
  dailyProgress = JSON.parse(localStorage.getItem(DAILY_PROGRESS_KEY) || "{}");
} catch (_) {
  dailyProgress = {};
}

const dailyElement = (id) => document.getElementById(id);
const dailyShuffle = (values) => {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function splitDailyUnits(units) {
  const days = Array.from({ length: DAILY_DAYS }, () => []);
  units.forEach((unit, index) => days[Math.floor(index * DAILY_DAYS / units.length)].push(unit));
  return days;
}

function dailyFactLabel(surah) {
  return `${surah.number} — ${ayahCountText(surah.ayahs.length)}`;
}

function buildDailyDays() {
  const wordUnits = DAILY_WORD_ENTRIES.flatMap((word) => ([
    { kind: "word", direction: "ar-ru", arabic: word.arabic, russian: word.russian, lessonTitle: word.lessonTitle },
    { kind: "word", direction: "ru-ar", arabic: word.arabic, russian: word.russian, lessonTitle: word.lessonTitle }
  ]));
  const ayahUnits = DAILY_AYAH_ENTRIES.flatMap((ayah) => ([
    { kind: "ayah", direction: "ar-ru", ...ayah },
    { kind: "ayah", direction: "ru-ar", ...ayah }
  ]));
  const factUnits = DAILY_SURAHS.map((surah) => ({
    kind: "facts",
    surahNumber: surah.number,
    surahName: surah.name,
    arabicSurahName: surah.arabicName,
    meaning: surah.meaning,
    correctValue: dailyFactLabel(surah),
    correctCount: surah.ayahs.length
  }));
  const dayBuckets = Array.from({ length: DAILY_DAYS }, () => []);
  [wordUnits, ayahUnits, factUnits].forEach((units) => {
    splitDailyUnits(units).forEach((day, dayIndex) => dayBuckets[dayIndex].push(...day));
  });
  return dayBuckets.map((day) => dailyShuffle(day));
}

const dailyDays = buildDailyDays();

// Эти два дня пользователь уже прошла без ошибок до появления сохранения прогресса.
if (Object.keys(dailyProgress).length === 0) {
  dailyProgress = {
    0: { score: dailyDays[0].length, total: dailyDays[0].length, errors: 0, completedAt: new Date().toISOString() },
    1: { score: dailyDays[1].length, total: dailyDays[1].length, errors: 0, completedAt: new Date().toISOString() }
  };
  localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(dailyProgress));
}

function dailyKindCount(day, kind) {
  return day.filter((unit) => unit.kind === kind).length;
}

function renderDailySetup() {
  dailyElement("daily-setup").hidden = false;
  dailyElement("daily-test").hidden = true;
  dailyElement("daily-result").hidden = true;
  dailyElement("daily-days-grid").innerHTML = dailyDays.map((day, index) => {
    const result = dailyProgress[index];
    return `
    <button class="daily-day-card ${result ? "completed" : ""}" data-daily-day="${index}">
      <span class="daily-day-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="daily-day-copy"><strong>День ${index + 1}</strong><small>${day.length} заданий</small>
        <em>Слова ${dailyKindCount(day, "word")} · Аяты ${dailyKindCount(day, "ayah")} · Номер + аяты ${dailyKindCount(day, "facts")}</em>
        ${result ? `<em class="daily-completed-label">✓ Пройдено · ошибок: ${result.errors}</em>` : ""}
      </span><span class="daily-day-arrow">${result ? "Повторить →" : "Начать →"}</span>
    </button>`;
  }).join("");
  document.querySelectorAll("[data-daily-day]").forEach((button) => button.addEventListener("click", () => {
    startDailyDay(Number(button.dataset.dailyDay));
  }));
}

function startDailyDay(dayIndex) {
  dailyState.day = dayIndex;
  dailyState.units = dailyDays[dayIndex];
  dailyState.index = 0;
  dailyState.score = 0;
  dailyState.errors = [];
  dailyState.revealed = false;
  dailyState.answered = false;
  dailyElement("daily-setup").hidden = true;
  dailyElement("daily-result").hidden = true;
  dailyElement("daily-test").hidden = false;
  renderDailyQuestion();
  dailyElement("daily-test").scrollIntoView({ behavior: "smooth", block: "start" });
}

function dailyOptions(current) {
  if (current.kind === "facts") {
    const values = DAILY_SURAHS.map(dailyFactLabel);
    return dailyUniqueOptions(current.correctValue, values);
  }
  const pool = current.kind === "word" ? DAILY_WORD_ENTRIES : DAILY_AYAH_ENTRIES;
  const key = current.direction === "ar-ru" ? "russian" : "arabic";
  return dailyUniqueOptions(current[key], pool.map((item) => item[key]));
}

function dailyUniqueOptions(correctValue, candidates) {
  const distractors = dailyShuffle([...new Set(candidates)])
    .filter((value) => value !== correctValue)
    .slice(0, 3);
  return dailyShuffle([correctValue, ...distractors]);
}

function dailyOptionMarkup(option, index, current) {
  const value = current.kind === "facts"
    ? escapeText(option)
    : current.direction === "ar-ru"
      ? escapeText(option)
      : `<b dir="rtl" lang="ar">${escapeText(option)}</b>`;
  return `<button class="daily-answer ${current.direction === "ru-ar" ? "arabic-answer" : ""}" data-daily-option="${index}"><span>${index + 1}</span><span>${value}</span></button>`;
}

function renderDailyQuestion() {
  const current = dailyState.units[dailyState.index];
  dailyState.revealed = false;
  dailyState.answered = false;
  const isFacts = current.kind === "facts";
  const isArabicPrompt = isFacts || current.direction === "ar-ru";
  const prompt = isFacts
    ? "Какая это сура по счёту и сколько в ней аятов?"
    : current.direction === "ar-ru"
      ? (current.kind === "word" ? "Выбери перевод слова" : "Выбери перевод аята")
      : (current.kind === "word" ? "Выбери арабское слово" : "Выбери аят на арабском");
  const display = isFacts || isArabicPrompt ? (isFacts ? current.arabicSurahName : current.arabic) : current.russian;
  const options = dailyOptions(current);
  const reference = isFacts
    ? `Сура ${current.surahNumber}. ${current.surahName}`
    : current.kind === "word"
      ? `${current.lessonTitle} · слово`
      : `Сура ${current.surahNumber}. ${current.surahName} · аят ${current.number}`;
  const progress = (dailyState.index / dailyState.units.length) * 100;
  dailyElement("daily-progress-label").textContent = `День ${dailyState.day + 1} · задание ${dailyState.index + 1} из ${dailyState.units.length}`;
  dailyElement("daily-score-label").textContent = `Верно ${dailyState.score}`;
  dailyElement("daily-progress-bar").style.width = `${progress}%`;
  dailyElement("daily-question").innerHTML = `
    <div class="daily-reference"><span>${escapeText(reference)}</span><strong>${isFacts ? "Номер + количество аятов" : current.kind === "word" ? "Слова" : "Перевод аятов"}</strong></div>
    <p class="prompt">${prompt}</p>
    <div class="daily-prompt ${isArabicPrompt ? "arabic-prompt" : "russian-prompt"}" ${isArabicPrompt ? 'dir="rtl" lang="ar"' : ""}>${escapeText(display)}</div>
    <button class="reveal-answers" id="reveal-daily-answers">Показать варианты ответов</button>
    <div class="daily-answer-list" id="daily-answer-list" hidden>${options.map((option, index) => dailyOptionMarkup(option, index, current)).join("")}</div>
    <div id="daily-feedback"></div>`;

  dailyElement("reveal-daily-answers").addEventListener("click", () => {
    dailyState.revealed = true;
    dailyElement("reveal-daily-answers").hidden = true;
    dailyElement("daily-answer-list").hidden = false;
  });
  document.querySelectorAll("[data-daily-option]").forEach((button) => button.addEventListener("click", () => {
    if (!dailyState.revealed || dailyState.answered) return;
    const chosen = options[Number(button.dataset.dailyOption)];
    const correctValue = current.kind === "facts"
      ? current.correctValue
      : current.direction === "ar-ru" ? current.russian : current.arabic;
    const correct = chosen === correctValue;
    dailyState.answered = true;
    if (typeof window.playAnswerSound === "function") window.playAnswerSound(correct);
    if (correct) dailyState.score += 1;
    else dailyState.errors.push({ ...current, chosen });
    document.querySelectorAll("[data-daily-option]").forEach((answer, answerIndex) => {
      answer.disabled = true;
      if (options[answerIndex] === correctValue) answer.classList.add("right");
    });
    if (!correct) button.classList.add("wrong");
    dailyElement("daily-score-label").textContent = `Верно ${dailyState.score}`;
    dailyElement("daily-progress-bar").style.width = `${((dailyState.index + 1) / dailyState.units.length) * 100}%`;
    renderDailyFeedback(correct, current, correctValue);
  }));
}

function renderDailyFeedback(correct, current, correctValue) {
  const answer = current.kind === "facts"
    ? `<p class="feedback-arabic" dir="rtl" lang="ar">${escapeText(current.arabicSurahName)}</p><p>${escapeText(current.surahName)} — ${escapeText(current.correctValue)}</p>`
    : `<p class="feedback-arabic" dir="rtl" lang="ar">${escapeText(current.arabic)}</p><p>${escapeText(current.russian)}</p>`;
  dailyElement("daily-feedback").innerHTML = `<div class="daily-feedback ${correct ? "good" : "bad"}">
    <span class="feedback-icon">${correct ? "✓" : "↺"}</span><div><strong>${correct ? "Верно!" : "Правильный ответ:"}</strong>${correct ? "" : answer}</div>
    <button id="next-daily-question">${dailyState.index === dailyState.units.length - 1 ? "Посмотреть результат" : "Следующее задание →"}</button>
  </div>`;
  dailyElement("next-daily-question").addEventListener("click", () => {
    if (dailyState.index === dailyState.units.length - 1) renderDailyResult();
    else {
      dailyState.index += 1;
      renderDailyQuestion();
      dailyElement("daily-test").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function renderDailyResult() {
  const total = dailyState.units.length;
  const percent = Math.round((dailyState.score / total) * 100);
  dailyProgress[dailyState.day] = {
    score: dailyState.score,
    total,
    errors: dailyState.errors.length,
    completedAt: new Date().toISOString()
  };
  localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(dailyProgress));
  dailyElement("daily-test").hidden = true;
  dailyElement("daily-result").hidden = false;
  dailyElement("daily-result").innerHTML = `<div class="daily-result-screen">
    <p class="eyebrow">День ${dailyState.day + 1} завершён</p>
    <div class="result-ring" style="--result:${percent * 3.6}deg"><span><strong>${percent}%</strong><small>${dailyState.score} из ${total}</small></span></div>
    <h2>${percent >= 90 ? "Отлично закреплено!" : percent >= 70 ? "Очень хорошо!" : "Повтори эту часть ещё раз"}</h2>
    <p>${dailyState.errors.length ? `Ошибок: ${dailyState.errors.length}. Ниже — задания для повторения.` : "Все ответы верные — великолепно!"}</p>
    ${dailyState.errors.length ? `<section class="daily-error-review"><h3>Повтори ошибки</h3><div class="daily-error-list">${dailyState.errors.map((error, index) => dailyErrorMarkup(error, index)).join("")}</div></section>` : ""}
    <div class="result-actions"><button id="repeat-daily-day">↻ Пройти день ещё раз</button><button id="choose-daily-day">Выбрать другой день</button></div>
  </div>`;
  dailyElement("repeat-daily-day").addEventListener("click", () => startDailyDay(dailyState.day));
  dailyElement("choose-daily-day").addEventListener("click", renderDailySetup);
  dailyElement("daily-result").scrollIntoView({ behavior: "smooth", block: "start" });
}

function dailyErrorMarkup(error, index) {
  const title = error.kind === "facts"
    ? `Сура ${error.surahNumber} · номер и количество аятов`
    : error.kind === "word"
      ? `${error.lessonTitle} · слово`
      : `Сура ${error.surahNumber}. ${error.surahName} · аят ${error.number}`;
  const correct = error.kind === "facts"
    ? error.correctValue
    : error.direction === "ar-ru" ? error.russian : error.arabic;
  return `<article class="daily-error-item"><span class="error-index">${index + 1}</span><div><small>${escapeText(title)}</small>${error.kind === "facts" || error.direction === "ar-ru" ? `<p class="error-arabic" dir="rtl" lang="ar">${escapeText(error.kind === "facts" ? error.arabicSurahName : error.arabic)}</p>` : ""}<p><b>Правильно:</b> ${escapeText(correct)}</p><p class="chosen-wrong"><b>Выбрано:</b> ${escapeText(error.chosen)}</p></div></article>`;
}

function returnToDailySetup() {
  dailyElement("daily-test").hidden = true;
  dailyElement("daily-result").hidden = true;
  renderDailySetup();
  dailyElement("daily-setup").scrollIntoView({ behavior: "smooth", block: "start" });
}

window.renderDailySetup = renderDailySetup;
dailyElement("exit-daily-test").addEventListener("click", returnToDailySetup);
renderDailySetup();
