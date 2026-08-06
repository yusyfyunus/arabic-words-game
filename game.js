const LESSONS = [{
  id: "lesson-1",
  title: "Урок 1",
  words: [
  ["ناس", "Люди"], ["ملك", "Владыка"], ["إله", "Бог"],
  ["وسواس", "Наущатель"], ["خنس", "Отступать"], ["وسوس", "Наущать"],
  ["صدر", "Грудь"], ["جنة", "Джинны"], ["خناس", "Отступающий"],
  ["عوذ", "Обращаться за защитой"], ["فلق", "Рассвет"], ["شر", "Зло"],
  ["خلق", "Сотворить"], ["غاسق", "Мрак"], ["وقب", "Окутывать"],
  ["نفاثات", "Дующие, плюющие"], ["عقد", "Узлы"], ["حاسد", "Завистник"],
  ["حسد", "Завидовать"], ["أحد", "Один"], ["الصمد", "Тот, в Ком все нуждаются"],
  ["ولد", "Рожать"], ["كفو", "Равный"]
  ].map(([arabic, russian]) => ({ arabic, russian }))
}];

const WORDS = LESSONS.flatMap((lesson) => lesson.words);

const KEYBOARD = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د"],
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

const $ = (id) => document.getElementById(id);
const activeWords = () => scope === "all" ? WORDS : LESSONS.find((lesson) => lesson.id === scope).words;
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
  const progress = ((index + (answered ? 1 : 0)) / deck.length) * 100;
  $("question-number").textContent = `Слово ${index + 1} из ${deck.length}`;
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
    <button id="next-question">${index === deck.length - 1 ? "Новый раунд" : "Дальше →"}</button>`;
  $("question-block").append(box);
  $("next-question").addEventListener("click", next);
}

function grade(correct) {
  if (answered) return;
  answered = true;
  if (correct) { score += 1; streak += 1; } else { streak = 0; }
  updateMeta();
  feedback(correct, deck[index]);
}

function renderTranslate(current) {
  const options = shuffle([current, ...shuffle(activeWords().filter((word) => word !== current)).slice(0, 3)]);
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

function renderSpell(current) {
  $("question-block").innerHTML = `
    <p class="prompt">Напиши слово по-арабски</p>
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
  mode === "translate" ? renderTranslate(deck[index]) : renderSpell(deck[index]);
}

function reset(nextMode = mode, nextScope = scope) {
  mode = nextMode;
  scope = nextScope;
  deck = shuffle(activeWords());
  index = 0; score = 0; streak = 0; answered = false;
  $("mode-translate").classList.toggle("active", mode === "translate");
  $("mode-spell").classList.toggle("active", mode === "spell");
  $("scope-lesson").classList.toggle("active", scope === "lesson-1");
  $("scope-all").classList.toggle("active", scope === "all");
  render();
}

function next() {
  if (index === deck.length - 1) reset();
  else { index += 1; render(); }
}

$("mode-translate").addEventListener("click", () => mode !== "translate" && reset("translate"));
$("mode-spell").addEventListener("click", () => mode !== "spell" && reset("spell"));
$("scope-lesson").addEventListener("click", () => scope !== "lesson-1" && reset(mode, "lesson-1"));
$("scope-all").addEventListener("click", () => scope !== "all" && reset(mode, "all"));
$("restart").addEventListener("click", () => reset());

const backdrop = $("dictionary-backdrop");
$("word-list").innerHTML = `<div class="lesson-list-label"><span>Урок 1</span><small>23 слова</small></div>` + WORDS.map((word, i) => `
  <div class="word-row"><span class="word-index">${String(i + 1).padStart(2, "0")}</span>
  <span class="word-russian">${word.russian}</span><span class="word-arabic" dir="rtl" lang="ar">${word.arabic}</span></div>`).join("");
$("open-dictionary").addEventListener("click", () => { backdrop.hidden = false; });
$("close-dictionary").addEventListener("click", () => { backdrop.hidden = true; });
backdrop.addEventListener("click", (event) => { if (event.target === backdrop) backdrop.hidden = true; });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") backdrop.hidden = true; });

reset();
