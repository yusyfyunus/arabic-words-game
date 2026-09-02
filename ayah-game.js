const portalViews = {
  home: document.getElementById("portal-home"),
  words: document.getElementById("words-app"),
  ayahs: document.getElementById("ayah-app"),
  tafsir: document.getElementById("tafsir-app")
};

function openProject(name) {
  const viewName = name === "full-juz" ? "ayahs" : name;
  Object.entries(portalViews).forEach(([key, element]) => { element.hidden = key !== viewName; });
  if (name === "full-juz") {
    startAyahTest(JUZ30_SURAHS, "full-juz");
  }
  if (name === "ayahs") {
    document.getElementById("ayah-test").hidden = true;
    document.getElementById("ayah-result").hidden = true;
    document.getElementById("ayah-setup").hidden = false;
    setAyahTab("single");
    requestAnimationFrame(() => { document.getElementById("surah-grid").scrollTop = 0; });
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-open-project]").forEach((button) => {
  button.addEventListener("click", () => openProject(button.dataset.openProject));
});

const ayahState = {
  singleSurah: null,
  customSurahs: new Set(),
  selectedSurahs: [],
  deck: [],
  index: 0,
  score: 0,
  errors: [],
  revealed: false,
  answered: false,
  source: "single"
};

const ayahById = new Map();
const allAyahs = JUZ30_SURAHS.flatMap((surah) => surah.ayahs.map((ayah) => {
  const item = { ...ayah, surahNumber: surah.number, surahName: surah.name, arabicSurahName: surah.arabicName };
  ayahById.set(`${surah.number}:${ayah.number}`, item);
  return item;
}));

const ayahElement = (id) => document.getElementById(id);
const escapeText = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function shuffleAyahs(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function taskCount(surahs) {
  return surahs.reduce((sum, surah) => sum + surah.ayahs.length * 2 + 2, 0);
}

function ayahCountText(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  const noun = lastTwo >= 11 && lastTwo <= 14 ? "аятов" : last === 1 ? "аят" : last >= 2 && last <= 4 ? "аята" : "аятов";
  return `${count} ${noun}`;
}

function surahCard(surah, custom = false) {
  const selected = custom ? ayahState.customSurahs.has(surah.number) : ayahState.singleSurah === surah.number;
  return `<button class="surah-card ${selected ? "selected" : ""}" data-${custom ? "custom-" : ""}surah="${surah.number}">
    <span class="surah-number">${surah.number}</span>
    <span class="surah-card-copy"><strong>${escapeText(surah.name)}</strong><small>${escapeText(surah.meaning)} · ${ayahCountText(surah.ayahs.length)}</small></span>
    <span class="surah-arabic" dir="rtl" lang="ar">${escapeText(surah.arabicName)}</span>
    <i aria-hidden="true">✓</i>
  </button>`;
}

function renderSurahPickers() {
  ayahElement("surah-grid").innerHTML = JUZ30_SURAHS.map((surah) => surahCard(surah)).join("");
  ayahElement("custom-surah-grid").innerHTML = JUZ30_SURAHS.map((surah) => surahCard(surah, true)).join("");

  document.querySelectorAll("[data-surah]").forEach((button) => button.addEventListener("click", () => {
    ayahState.singleSurah = Number(button.dataset.surah);
    renderSurahPickers();
    updateAyahSetup();
  }));

  document.querySelectorAll("[data-custom-surah]").forEach((button) => button.addEventListener("click", () => {
    const number = Number(button.dataset.customSurah);
    ayahState.customSurahs.has(number) ? ayahState.customSurahs.delete(number) : ayahState.customSurahs.add(number);
    renderSurahPickers();
    updateAyahSetup();
  }));
}

function updateAyahSetup() {
  const selected = JUZ30_SURAHS.find((surah) => surah.number === ayahState.singleSurah);
  ayahElement("single-selection-label").textContent = selected
    ? `${selected.number}. ${selected.name} · ${selected.ayahs.length * 2 + 2} заданий`
    : "Сура не выбрана";
  ayahElement("start-single-surah").disabled = !selected;

  const custom = JUZ30_SURAHS.filter((surah) => ayahState.customSurahs.has(surah.number));
  const count = taskCount(custom);
  ayahElement("custom-selection-count").textContent = `${custom.length} сур · ${count} заданий`;
  ayahElement("custom-start-label").textContent = custom.length
    ? `${custom.length} сур · ${count} заданий`
    : "Выбери хотя бы одну суру";
  ayahElement("start-custom-test").disabled = !custom.length;
}

function setAyahTab(tab) {
  const single = tab === "single";
  ayahElement("tab-one-surah").classList.toggle("active", single);
  ayahElement("tab-custom-test").classList.toggle("active", !single);
  ayahElement("one-surah-panel").hidden = !single;
  ayahElement("custom-test-panel").hidden = single;
}

function buildAyahDeck(surahs) {
  const entries = surahs.flatMap((surah) => surah.ayahs.map((ayah) => ({
    ...ayah,
    type: "ayah",
    surahNumber: surah.number,
    surahName: surah.name,
    arabicSurahName: surah.arabicName,
    meaning: surah.meaning
  })));
  const surahQuestions = surahs.flatMap((surah) => ([
    {
      type: "surah-count",
      surahNumber: surah.number,
      surahName: surah.name,
      arabicSurahName: surah.arabicName,
      meaning: surah.meaning,
      correctValue: String(surah.ayahs.length)
    },
    {
      type: "surah-name",
      surahNumber: surah.number,
      surahName: surah.name,
      arabicSurahName: surah.arabicName,
      meaning: surah.meaning,
      correctValue: `${surah.name} — ${surah.meaning}`
    }
  ]));
  return shuffleAyahs([
    ...entries.map((ayah) => ({ ...ayah, direction: "arabic-russian" })),
    ...entries.map((ayah) => ({ ...ayah, direction: "russian-arabic" })),
    ...surahQuestions
  ]);
}

function startAyahTest(surahs, source) {
  ayahState.selectedSurahs = surahs;
  ayahState.deck = buildAyahDeck(surahs);
  ayahState.index = 0;
  ayahState.score = 0;
  ayahState.errors = [];
  ayahState.source = source;
  ayahElement("exit-ayah-test").textContent = source === "full-juz" ? "← К разделам" : "← К выбору сур";
  ayahElement("ayah-setup").hidden = true;
  ayahElement("ayah-result").hidden = true;
  ayahElement("ayah-test").hidden = false;
  renderAyahQuestion();
  ayahElement("ayah-test").scrollIntoView({ behavior: "smooth", block: "start" });
}

function uniqueOptions(current, key) {
  const selectedNumbers = new Set(ayahState.selectedSurahs.map((surah) => surah.number));
  const preferred = allAyahs.filter((ayah) => selectedNumbers.has(ayah.surahNumber));
  const candidates = [...shuffleAyahs(preferred), ...shuffleAyahs(allAyahs)];
  const seen = new Set([current[key]]);
  const distractors = [];
  for (const candidate of candidates) {
    if (candidate.surahNumber === current.surahNumber && candidate.number === current.number) continue;
    if (seen.has(candidate[key])) continue;
    seen.add(candidate[key]);
    distractors.push(candidate);
    if (distractors.length === 3) break;
  }
  return shuffleAyahs([current, ...distractors]);
}

function answerMarkup(option, optionIndex, direction) {
  const content = direction === "arabic-russian"
    ? escapeText(option.russian)
    : `<b dir="rtl" lang="ar">${escapeText(option.arabic)}</b>`;
  return `<button class="ayah-answer ${direction === "russian-arabic" ? "arabic-answer" : ""}" data-option="${optionIndex}"><span>${optionIndex + 1}</span><span>${content}</span></button>`;
}

function textAnswerMarkup(value, optionIndex) {
  return `<button class="ayah-answer" data-option="${optionIndex}"><span>${optionIndex + 1}</span><span>${escapeText(value)}</span></button>`;
}

function uniqueTextOptions(correctValue, candidates) {
  const distractors = shuffleAyahs([...new Set(candidates)])
    .filter((value) => value !== correctValue)
    .slice(0, 3);
  return shuffleAyahs([correctValue, ...distractors]);
}

function surahQuestionConfig(current) {
  if (current.type === "surah-count") {
    return {
      prompt: "Сколько аятов в этой суре?",
      referenceStrong: "Количество аятов",
      display: current.arabicSurahName,
      correctValue: current.correctValue,
      options: uniqueTextOptions(current.correctValue, JUZ30_SURAHS.map((surah) => String(surah.ayahs.length)))
    };
  }
  return {
    prompt: "Выбери название с его переводом",
    referenceStrong: "Название и перевод",
    display: current.arabicSurahName,
    correctValue: current.correctValue,
    options: uniqueTextOptions(current.correctValue, JUZ30_SURAHS.map((surah) => `${surah.name} — ${surah.meaning}`))
  };
}

function renderAyahQuestion() {
  const current = ayahState.deck[ayahState.index];
  ayahState.revealed = false;
  ayahState.answered = false;
  const isSurahQuestion = current.type !== "ayah";
  const isArabicPrompt = current.direction === "arabic-russian";
  const optionKey = isArabicPrompt ? "russian" : "arabic";
  const surahConfig = isSurahQuestion ? surahQuestionConfig(current) : null;
  const options = isSurahQuestion ? surahConfig.options : uniqueOptions(current, optionKey);
  const progress = (ayahState.index / ayahState.deck.length) * 100;

  ayahElement("ayah-progress-label").textContent = `Задание ${ayahState.index + 1} из ${ayahState.deck.length}`;
  ayahElement("ayah-score-label").textContent = `Верно ${ayahState.score}`;
  ayahElement("ayah-progress-bar").style.width = `${progress}%`;
  ayahElement("ayah-question").innerHTML = `
    <div class="ayah-reference"><span>Сура ${current.surahNumber}. ${escapeText(current.surahName)}</span><strong>${isSurahQuestion ? surahConfig.referenceStrong : `Аят ${current.number}`}</strong></div>
    <p class="prompt">${isSurahQuestion ? surahConfig.prompt : (isArabicPrompt ? "Выбери перевод аята" : "Выбери аят на арабском")}</p>
    <div class="ayah-prompt ${isSurahQuestion || isArabicPrompt ? "arabic-prompt" : "russian-prompt"}" ${isSurahQuestion || isArabicPrompt ? 'dir="rtl" lang="ar"' : ""}>${escapeText(isSurahQuestion ? surahConfig.display : (isArabicPrompt ? current.arabic : current.russian))}</div>
    <button class="reveal-answers" id="reveal-ayah-answers">Показать варианты ответов</button>
    <div class="ayah-answer-list" id="ayah-answer-list" hidden>${options.map((option, index) => isSurahQuestion ? textAnswerMarkup(option, index) : answerMarkup(option, index, current.direction)).join("")}</div>
    <div id="ayah-feedback"></div>`;

  ayahElement("reveal-ayah-answers").addEventListener("click", () => {
    ayahState.revealed = true;
    ayahElement("reveal-ayah-answers").hidden = true;
    ayahElement("ayah-answer-list").hidden = false;
  });

  document.querySelectorAll(".ayah-answer").forEach((button) => button.addEventListener("click", () => {
    if (!ayahState.revealed || ayahState.answered) return;
    const chosen = options[Number(button.dataset.option)];
    const correct = isSurahQuestion
      ? chosen === surahConfig.correctValue
      : chosen.surahNumber === current.surahNumber && chosen.number === current.number;
    ayahState.answered = true;
    if (typeof window.playAnswerSound === "function") window.playAnswerSound(correct);
    if (correct) ayahState.score += 1;
    else ayahState.errors.push({ ...current, chosen: isSurahQuestion ? chosen : chosen[optionKey] });

    document.querySelectorAll(".ayah-answer").forEach((answer, index) => {
      answer.disabled = true;
      const option = options[index];
      const isCorrectOption = isSurahQuestion
        ? option === surahConfig.correctValue
        : option.surahNumber === current.surahNumber && option.number === current.number;
      if (isCorrectOption) answer.classList.add("right");
    });
    if (!correct) button.classList.add("wrong");
    ayahElement("ayah-score-label").textContent = `Верно ${ayahState.score}`;
    ayahElement("ayah-progress-bar").style.width = `${((ayahState.index + 1) / ayahState.deck.length) * 100}%`;
    renderAyahFeedback(correct, current);
  }));
}

function renderAyahFeedback(correct, current) {
  const correctAnswer = current.type === "surah-count"
    ? `<p class="feedback-arabic" dir="rtl" lang="ar">${escapeText(current.arabicSurahName)}</p><p>${escapeText(current.surahName)} — ${escapeText(current.meaning)} · ${ayahCountText(Number(current.correctValue))}</p>`
    : current.type === "surah-name"
      ? `<p class="feedback-arabic" dir="rtl" lang="ar">${escapeText(current.arabicSurahName)}</p><p>${escapeText(current.correctValue)}</p>`
      : `<p class="feedback-arabic" dir="rtl" lang="ar">${escapeText(current.arabic)}</p><p>${escapeText(current.russian)}</p>`;
  ayahElement("ayah-feedback").innerHTML = `<div class="ayah-feedback ${correct ? "good" : "bad"}">
    <span class="feedback-icon">${correct ? "✓" : "↺"}</span>
    <div><strong>${correct ? "Верно!" : "Правильный ответ:"}</strong>
      ${correct ? "" : correctAnswer}
    </div>
    <button id="next-ayah-question">${ayahState.index === ayahState.deck.length - 1 ? "Посмотреть результат" : "Следующее задание →"}</button>
  </div>`;
  ayahElement("next-ayah-question").addEventListener("click", () => {
    if (ayahState.index === ayahState.deck.length - 1) renderAyahResult();
    else {
      ayahState.index += 1;
      renderAyahQuestion();
      ayahElement("ayah-test").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function renderAyahResult() {
  const total = ayahState.deck.length;
  const percent = Math.round((ayahState.score / total) * 100);
  ayahElement("ayah-test").hidden = true;
  ayahElement("ayah-result").hidden = false;
  ayahElement("ayah-result").innerHTML = `<div class="ayah-result-screen">
    <p class="eyebrow">Тест завершён</p>
    <div class="result-ring" style="--result:${percent * 3.6}deg"><span><strong>${percent}%</strong><small>${ayahState.score} из ${total}</small></span></div>
    <h2>${percent >= 90 ? "Отличный результат!" : percent >= 70 ? "Очень хорошо!" : "Продолжай повторять"}</h2>
    <p>${ayahState.errors.length ? `Ошибок: ${ayahState.errors.length}. Ниже показаны задания, которые стоит повторить.` : "Все ответы верные — великолепно!"}</p>
    ${ayahState.errors.length ? `<section class="ayah-error-review"><h3>Задания с ошибками</h3><div class="ayah-error-list">${ayahState.errors.map((error, index) => errorMarkup(error, index)).join("")}</div></section>` : ""}
    <div class="result-actions"><button id="repeat-ayah-test">↻ Пройти ещё раз</button><button id="choose-other-surah">${ayahState.source === "full-juz" ? "Вернуться в разделы" : "Выбрать другие суры"}</button></div>
  </div>`;
  ayahElement("repeat-ayah-test").addEventListener("click", () => startAyahTest(ayahState.selectedSurahs, ayahState.source));
  ayahElement("choose-other-surah").addEventListener("click", returnToAyahSetup);
  ayahElement("ayah-result").scrollIntoView({ behavior: "smooth", block: "start" });
}

function errorMarkup(error, index) {
  if (error.type === "surah-count") {
    return `<article class="ayah-error-item"><span class="error-index">${index + 1}</span><div>
      <small>Сура ${error.surahNumber}. ${escapeText(error.surahName)} · количество аятов</small>
      <p class="error-arabic" dir="rtl" lang="ar">${escapeText(error.arabicSurahName)}</p>
      <p><b>Правильно:</b> ${ayahCountText(Number(error.correctValue))}</p>
      <p class="chosen-wrong"><b>Выбрано:</b> ${escapeText(error.chosen)}</p>
    </div></article>`;
  }
  if (error.type === "surah-name") {
    return `<article class="ayah-error-item"><span class="error-index">${index + 1}</span><div>
      <small>Сура ${error.surahNumber} · название и перевод</small>
      <p class="error-arabic" dir="rtl" lang="ar">${escapeText(error.arabicSurahName)}</p>
      <p><b>Правильно:</b> ${escapeText(error.correctValue)}</p>
      <p class="chosen-wrong"><b>Выбрано:</b> ${escapeText(error.chosen)}</p>
    </div></article>`;
  }
  return `<article class="ayah-error-item"><span class="error-index">${index + 1}</span><div>
    <small>Сура ${error.surahNumber}. ${escapeText(error.surahName)} · аят ${error.number} · ${error.direction === "arabic-russian" ? "арабский → русский" : "русский → арабский"}</small>
    <p class="error-arabic" dir="rtl" lang="ar">${escapeText(error.arabic)}</p>
    <p><b>Правильно:</b> ${escapeText(error.russian)}</p>
    <p class="chosen-wrong"><b>Выбрано:</b> ${escapeText(error.chosen)}</p>
  </div></article>`;
}

function returnToAyahSetup() {
  if (ayahState.source === "full-juz") {
    openProject("home");
    return;
  }
  ayahElement("ayah-test").hidden = true;
  ayahElement("ayah-result").hidden = true;
  ayahElement("ayah-setup").hidden = false;
  setAyahTab(ayahState.source === "custom" ? "custom" : "single");
  ayahElement("ayah-setup").scrollIntoView({ behavior: "smooth", block: "start" });
}

ayahElement("tab-one-surah").addEventListener("click", () => setAyahTab("single"));
ayahElement("tab-custom-test").addEventListener("click", () => setAyahTab("custom"));
ayahElement("select-all-surahs").addEventListener("click", () => {
  JUZ30_SURAHS.forEach((surah) => ayahState.customSurahs.add(surah.number));
  renderSurahPickers();
  updateAyahSetup();
});
ayahElement("clear-surahs").addEventListener("click", () => {
  ayahState.customSurahs.clear();
  renderSurahPickers();
  updateAyahSetup();
});
ayahElement("start-single-surah").addEventListener("click", () => {
  const selected = JUZ30_SURAHS.filter((surah) => surah.number === ayahState.singleSurah);
  if (selected.length) startAyahTest(selected, "single");
});
ayahElement("start-custom-test").addEventListener("click", () => {
  const selected = JUZ30_SURAHS.filter((surah) => ayahState.customSurahs.has(surah.number));
  if (selected.length) startAyahTest(selected, "custom");
});
ayahElement("exit-ayah-test").addEventListener("click", returnToAyahSetup);

renderSurahPickers();
updateAyahSetup();
