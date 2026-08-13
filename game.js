const LESSONS = [{
  id: "lesson-1",
  title: "Урок 1",
  words: [
  ["نَاسٌ", "Люди"], ["مَلِكٌ", "Владыка"], ["إِلَهٌ", "Бог"],
  ["وَسْوَاسٌ", "Наущатель"], ["خَنَسَ", "Отступать"], ["وَسْوَسَ", "Наущать"],
  ["صَدْرٌ", "Грудь"], ["جِنَّةٌ", "Джинны"], ["خَنَّاسٌ", "Отступающий"],
  ["عَوَذَ", "Обращаться за защитой"], ["فَلَقٌ", "Рассвет"], ["شَرٌّ", "Зло"],
  ["خَلَقَ", "Сотворить"], ["غَاسِقٌ", "Мрак"], ["وَقَبَ", "Окутывать"],
  ["نَفَّاثَاتٌ", "Дующие, плюющие"], ["عُقَدٌ", "Узлы"], ["حَاسِدٌ", "Завистник"],
  ["حَسَدَ", "Завидовать"], ["أَحَدٌ", "Один"], ["الصَّمَدُ", "Тот, в Ком все нуждаются"],
  ["وَلَدَ", "Рожать"], ["كُفُوٌ", "Равный"]
  ].map(([arabic, russian]) => ({ arabic, russian }))
}, {
  id: "lesson-2",
  title: "Урок 2",
  words: [
  ["ذَاتٌ", "Обладательница"], ["اِمْرَأَةٌ", "Жена, женщина"], ["حَمَّالَةٌ", "Носительница"],
  ["حَطَبٌ", "Дрова"], ["جِيدٌ", "Шея"], ["حَبْلٌ", "Верёвка"],
  ["مَسَدٌ", "Пальмовые волокна"], ["جَاءَ", "Приходить"], ["نَصْرٌ", "Помощь, победа"],
  ["فَتْحٌ", "Открытие"], ["رَأَى", "Видеть"], ["دَخَلَ", "Входить"],
  ["أَفْوَاجًا", "Толпами"], ["سَبَّحَ", "Славить"], ["حَمْدٌ", "Хвала"],
  ["اِسْتَغْفَرَ", "Просить прощение"], ["تَوَّابٌ", "Принимающий покаяние"], ["تَبَّ", "Погибать"],
  ["يَدٌ", "Рука"], ["أَغْنَى", "Обогащать, избавлять, быть заменителем"],
  ["مَالٌ", "Деньги, богатство, имущество"], ["كَسَبَ", "Зарабатывать"],
  ["صَلَّى", "Молить, жарить"], ["نَارٌ", "Огонь"], ["لَهَبٌ", "Пламя"]
  ].map(([arabic, russian]) => ({ arabic, russian }))
}];

const WORDS = LESSONS.flatMap((lesson) => lesson.words);

const KEYBOARD = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د", "ذ"],
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
  ["ئ", "ء", "ؤ", "ر", "ى", "ة", "و", "ز", "ظ"]
];
const DIACRITICS = ["َ", "ِ", "ُ", "ً", "ٍ", "ٌ", "ْ", "ّ"];

let mode = "translate";
let scope = "lesson-1";
let deck = [];
let index = 0;
let score = 0;
let streak = 0;
let answered = false;
let started = false;
let finished = false;
let mistakes = [];
let hardWordIds = new Set();

try {
  hardWordIds = new Set(JSON.parse(localStorage.getItem("kalimat-hard-words") || "[]"));
} catch (_) {
  hardWordIds = new Set();
}

const $ = (id) => document.getElementById(id);
const selectedHardWords = () => WORDS.filter((word) => hardWordIds.has(word.arabic));
const activeWords = () => scope === "all" ? WORDS : scope === "hard" ? selectedHardWords() : LESSONS.find((lesson) => lesson.id === scope).words;
const shuffle = (values) => {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const stripMarks = (value) => value.normalize("NFKD")
  .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
  .replace(/[\s،,.!?؟]/g, "")
  .replace(/ٱ/g, "ا")
  .trim();

function updateMeta() {
  const progress = !started ? 0 : finished ? 100 : ((index + (answered ? 1 : 0)) / deck.length) * 100;
  $("question-number").textContent = started ? `Задание ${index + 1} из ${deck.length}` : scope === "hard" ? "Выбери трудные слова" : "Перед началом теста";
  $("progress-percent").textContent = `${Math.round(progress)}%`;
  $("progress-bar").style.width = `${progress}%`;
  $("score").textContent = score;
  $("streak").textContent = streak;
}

function feedback(correct, current) {
  const box = document.createElement("div");
  box.className = `feedback ${correct ? "feedback-good" : "feedback-bad"}`;
  box.innerHTML = `
    <div class="feedback-icon" aria-hidden="true">${correct ? "✓" : "↺"}</div>
    <div><strong>${correct ? "Верно!" : "Почти. Запомни ответ:"}</strong>
    <p><span dir="rtl" lang="ar">${current.arabic}</span> — ${current.russian}</p></div>
    <button id="next-question">${index === deck.length - 1 ? "Посмотреть результат" : "Дальше →"}</button>`;
  $("question-block").append(box);
  $("next-question").addEventListener("click", next);
}

function grade(correct) {
  if (answered) return;
  answered = true;
  if (correct) { score += 1; streak += 1; } else {
    streak = 0;
    if (!mistakes.some((word) => word.arabic === deck[index].arabic)) mistakes.push(deck[index]);
  }
  updateMeta();
  feedback(correct, deck[index]);
}

function renderTranslate(current) {
  const optionPool = scope === "hard" ? WORDS : activeWords();
  const options = shuffle([current, ...shuffle(optionPool.filter((word) => word.arabic !== current.arabic)).slice(0, 3)]);
  $("question-block").innerHTML = `
    <p class="prompt">Выбери правильный перевод</p>
    <div class="arabic-word" dir="rtl" lang="ar">${current.arabic}</div>
    <div class="answer-grid">${options.map((word, i) => `
      <button class="answer-option" data-answer="${word.russian.replaceAll('"', '&quot;')}">
        <span>${i + 1}</span>${word.russian}
      </button>`).join("")}</div>`;
  document.querySelectorAll(".answer-option").forEach((button) => {
    button.addEventListener("click", () => {
      if (answered) return;
      const correct = button.dataset.answer === current.russian;
      document.querySelectorAll(".answer-option").forEach((option) => {
        option.disabled = true;
        if (option.dataset.answer === current.russian) option.classList.add("right");
      });
      if (!correct) button.classList.add("wrong");
      grade(correct);
    });
  });
}

function renderArabicChoice(current) {
  const options = shuffle([current, ...shuffle(WORDS.filter((word) => word.arabic !== current.arabic)).slice(0, 3)]);
  $("question-block").innerHTML = `
    <p class="prompt">Выбери арабское слово</p>
    <div class="russian-word">${current.russian}</div>
    <div class="answer-grid">${options.map((word, i) => `
      <button class="answer-option arabic-option" data-answer="${word.arabic}">
        <span>${i + 1}</span><b dir="rtl" lang="ar">${word.arabic}</b>
      </button>`).join("")}</div>`;
  document.querySelectorAll(".answer-option").forEach((button) => {
    button.addEventListener("click", () => {
      if (answered) return;
      const correct = button.dataset.answer === current.arabic;
      document.querySelectorAll(".answer-option").forEach((option) => {
        option.disabled = true;
        if (option.dataset.answer === current.arabic) option.classList.add("right");
      });
      if (!correct) button.classList.add("wrong");
      grade(correct);
    });
  });
}

function renderSpell(current) {
  $("question-block").innerHTML = `
    <p class="prompt">Переведи с русского и напиши по-арабски</p>
    <div class="russian-word">${current.russian}</div>
    <div class="spell-area">
      <label for="arabic-answer">Твой ответ</label>
      <input id="arabic-answer" dir="rtl" lang="ar" autocomplete="off" autocapitalize="off" placeholder="اكتب هنا">
      <div class="arabic-keyboard" aria-label="Арабская экранная клавиатура">
        <div class="keyboard-label"><span>Арабская клавиатура</span><small>огласовки — в верхнем ряду</small></div>
        <div class="keyboard-row diacritics-row" dir="rtl">${DIACRITICS.map((key) => `<button type="button" data-key="${key}">${key}</button>`).join("")}</div>
        ${KEYBOARD.map((row) => `<div class="keyboard-row" dir="rtl">${row.map((key) => `<button type="button" data-key="${key}">${key}</button>`).join("")}</div>`).join("")}
        <div class="keyboard-tools"><button type="button" id="clear-input">Очистить</button><button type="button" id="backspace">⌫ Удалить</button></div>
      </div>
      <div class="spell-actions">
        <button class="hint-button" id="hint">Показать первую букву</button>
        <button class="check-button" id="check" disabled>Проверить</button>
      </div>
    </div>`;
  const input = $("arabic-answer");
  const check = $("check");
  input.focus();
  input.addEventListener("input", () => { check.disabled = !input.value.trim(); });
  document.querySelectorAll("[data-key]").forEach((key) => key.addEventListener("click", () => {
    input.value += key.dataset.key;
    input.dispatchEvent(new Event("input"));
    input.focus();
  }));
  $("clear-input").addEventListener("click", () => {
    input.value = "";
    input.dispatchEvent(new Event("input"));
    input.focus();
  });
  $("backspace").addEventListener("click", () => {
    input.value = Array.from(input.value).slice(0, -1).join("");
    input.dispatchEvent(new Event("input"));
    input.focus();
  });
  $("hint").addEventListener("click", () => { $("hint").textContent = `Начало: ${current.arabic.slice(0, 1)}`; });
  const checkAnswer = () => {
    if (answered || !input.value.trim()) return;
    const correct = stripMarks(input.value) === stripMarks(current.arabic);
    input.disabled = true;
    input.classList.add(correct ? "input-right" : "input-wrong");
    document.querySelector(".spell-actions").remove();
    grade(correct);
  };
  check.addEventListener("click", checkAnswer);
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") checkAnswer(); });
}

function render() {
  answered = false;
  updateMeta();
  if (!started) {
    scope === "hard" ? renderHardSelector() : renderPreview();
    return;
  }
  if (scope === "hard") {
    const current = deck[index];
    current.task === "ar-ru"
      ? renderTranslate(current)
      : current.task === "ru-ar-choice"
        ? renderArabicChoice(current)
        : renderSpell(current);
    return;
  }
  mode === "translate" ? renderTranslate(deck[index]) : renderSpell(deck[index]);
}

function saveHardWords() {
  localStorage.setItem("kalimat-hard-words", JSON.stringify([...hardWordIds]));
  $("scope-hard-count").textContent = `${hardWordIds.size} выбрано`;
}

function buildHardDeck(words) {
  return [
    ...shuffle(words).map((word) => ({ ...word, task: "ru-ar-choice" })),
    ...shuffle(words).map((word) => ({ ...word, task: "ru-ar" })),
    ...shuffle(words).map((word) => ({ ...word, task: "ar-ru" }))
  ];
}

function renderHardSelector() {
  $("question-block").innerHTML = `
    <div class="hard-selector">
      <p class="eyebrow">Свой набор для повторения</p>
      <h2>Выбери трудные слова</h2>
      <p class="preview-intro">Каждое выбранное слово встретится три раза: выбрать арабское слово по русскому, написать перевод по-арабски и выбрать перевод на русский.</p>
      <div class="hard-tools"><button type="button" id="select-all-hard">Выбрать все</button><button type="button" id="clear-hard">Очистить</button><strong id="hard-selected-count">Выбрано: ${hardWordIds.size}</strong></div>
      <div class="hard-word-groups">${LESSONS.map((lesson) => `
        <section class="hard-word-group"><h3>${lesson.title}</h3><div class="hard-word-grid">${lesson.words.map((word) => `
          <label class="hard-word ${hardWordIds.has(word.arabic) ? "selected" : ""}">
            <input type="checkbox" value="${word.arabic}" ${hardWordIds.has(word.arabic) ? "checked" : ""}>
            <span dir="rtl" lang="ar">${word.arabic}</span><small>${word.russian}</small><i aria-hidden="true">✓</i>
          </label>`).join("")}</div></section>`).join("")}</div>
      <button class="start-test-button" id="start-hard-test" ${hardWordIds.size ? "" : "disabled"}>Начать тест · <span>${hardWordIds.size * 3}</span> заданий →</button>
    </div>`;

  const updateSelection = () => {
    saveHardWords();
    $("hard-selected-count").textContent = `Выбрано: ${hardWordIds.size}`;
    $("start-hard-test").disabled = hardWordIds.size === 0;
    $("start-hard-test").innerHTML = `Начать тест · <span>${hardWordIds.size * 3}</span> заданий →`;
  };
  document.querySelectorAll(".hard-word input").forEach((input) => input.addEventListener("change", () => {
    input.checked ? hardWordIds.add(input.value) : hardWordIds.delete(input.value);
    input.closest(".hard-word").classList.toggle("selected", input.checked);
    updateSelection();
  }));
  $("select-all-hard").addEventListener("click", () => {
    WORDS.forEach((word) => hardWordIds.add(word.arabic));
    renderHardSelector();
    saveHardWords();
  });
  $("clear-hard").addEventListener("click", () => {
    hardWordIds.clear();
    renderHardSelector();
    saveHardWords();
  });
  $("start-hard-test").addEventListener("click", () => {
    const words = selectedHardWords();
    if (!words.length) return;
    deck = buildHardDeck(words);
    index = 0; score = 0; streak = 0; answered = false; mistakes = []; finished = false; started = true;
    render();
  });
}

function renderPreview() {
  const previewLessons = scope === "all" ? LESSONS : LESSONS.filter((lesson) => lesson.id === scope);
  const heading = scope === "all" ? "Все слова для повторения" : `${previewLessons[0].title}: слова теста`;
  $("question-block").innerHTML = `
    <div class="lesson-preview">
      <p class="eyebrow">Сначала познакомься со словами</p>
      <h2>${heading}</h2>
      <p class="preview-intro">Прочитай арабские слова с огласовками и их перевод. Когда будешь готова — начинай тест.</p>
      <div class="preview-groups">${previewLessons.map((lesson) => `
        <section class="preview-group">
          ${scope === "all" ? `<h3>${lesson.title} · ${lesson.words.length} слов</h3>` : ""}
          <div class="preview-word-grid">${lesson.words.map((word) => `
            <div class="preview-word"><span dir="rtl" lang="ar">${word.arabic}</span><small>${word.russian}</small></div>`).join("")}
          </div>
        </section>`).join("")}</div>
      <button class="start-test-button" id="start-test">Начать тест →</button>
    </div>`;
  $("start-test").addEventListener("click", () => { started = true; render(); });
}

function renderResult() {
  const percent = Math.round((score / deck.length) * 100);
  const grade = percent >= 90 ? 5 : percent >= 70 ? 4 : percent >= 50 ? 3 : 2;
  const message = grade === 5
    ? "Отлично! Слова уже хорошо запомнились."
    : grade === 4
      ? "Очень хорошо! Ещё одно повторение закрепит результат."
      : grade === 3
        ? "Хорошее начало. Повтори слова и попробуй ещё раз."
        : "Не расстраивайся — повторение поможет запомнить слова.";
  $("question-block").innerHTML = `
    <div class="result-screen">
      <p class="eyebrow">Тест завершён</p>
      <div class="grade-badge grade-${grade}"><small>Оценка</small><strong>${grade}</strong></div>
      <h2>${message}</h2>
      <div class="result-stats">
        <div><strong>${score}<span>/${deck.length}</span></strong><small>правильных ответов</small></div>
        <div><strong>${percent}%</strong><small>результат теста</small></div>
        <div><strong>${mistakes.length}</strong><small>слов повторить</small></div>
      </div>
      <div class="mistakes-review ${mistakes.length ? "has-mistakes" : "no-mistakes"}">
        <h3>${mistakes.length ? "Слова, в которых были ошибки" : "Без ошибок — великолепно!"}</h3>
        ${mistakes.length ? `<div class="mistake-list">${mistakes.map((word) => `
          <div class="mistake-word"><span dir="rtl" lang="ar">${word.arabic}</span><small>${word.russian}</small></div>`).join("")}</div>` : ""}
      </div>
      <button class="result-restart" id="result-restart">↻ Пройти ещё раз</button>
    </div>`;
  $("result-restart").addEventListener("click", () => reset());
}

function reset(nextMode = mode, nextScope = scope) {
  mode = nextMode;
  scope = nextScope;
  deck = scope === "hard" ? [] : shuffle(activeWords());
  index = 0; score = 0; streak = 0; answered = false; started = false; finished = false; mistakes = [];
  $("mode-translate").classList.toggle("active", mode === "translate");
  $("mode-spell").classList.toggle("active", mode === "spell");
  $("scope-lesson").classList.toggle("active", scope === "lesson-1");
  $("scope-lesson2").classList.toggle("active", scope === "lesson-2");
  $("scope-all").classList.toggle("active", scope === "all");
  $("scope-hard").classList.toggle("active", scope === "hard");
  $("mode-translate").parentElement.hidden = scope === "hard";
  render();
}

function next() {
  if (index === deck.length - 1) {
    finished = true;
    answered = false;
    updateMeta();
    renderResult();
  }
  else { index += 1; render(); }
}

$("mode-translate").addEventListener("click", () => mode !== "translate" && reset("translate"));
$("mode-spell").addEventListener("click", () => mode !== "spell" && reset("spell"));
$("scope-lesson").addEventListener("click", () => scope !== "lesson-1" && reset(mode, "lesson-1"));
$("scope-lesson2").addEventListener("click", () => scope !== "lesson-2" && reset(mode, "lesson-2"));
$("scope-all").addEventListener("click", () => scope !== "all" && reset(mode, "all"));
$("scope-hard").addEventListener("click", () => scope !== "hard" && reset(mode, "hard"));
$("restart").addEventListener("click", () => reset());

const backdrop = $("dictionary-backdrop");
let dictionaryOffset = 0;
$("word-list").innerHTML = LESSONS.map((lesson) => {
  const rows = lesson.words.map((word, i) => `
    <div class="word-row"><span class="word-index">${String(dictionaryOffset + i + 1).padStart(2, "0")}</span>
    <span class="word-russian">${word.russian}</span><span class="word-arabic" dir="rtl" lang="ar">${word.arabic}</span></div>`).join("");
  dictionaryOffset += lesson.words.length;
  return `<div class="lesson-list-label"><span>${lesson.title}</span><small>${lesson.words.length} слов</small></div>${rows}`;
}).join("");
$("open-dictionary").addEventListener("click", () => { backdrop.hidden = false; });
$("close-dictionary").addEventListener("click", () => { backdrop.hidden = true; });
backdrop.addEventListener("click", (event) => { if (event.target === backdrop) backdrop.hidden = true; });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") backdrop.hidden = true; });

saveHardWords();
reset();
