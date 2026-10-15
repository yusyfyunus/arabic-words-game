const LESSONS = [
  {
    id: "lesson-1",
    title: "Урок 1",
    summary: "30 слов в единственном числе, в порядке из учебника.",
    words: [
      ["هَذَا", "Это, этот"], ["مَسْجِدٌ", "Мечеть"], ["بَابٌ", "Дверь"],
      ["كِتَابٌ", "Книга"], ["قَلَمٌ", "Ручка"], ["مِفْتَاحٌ", "Ключ"],
      ["مَكْتَبٌ", "Письменный стол, офис"], ["سَرِيرٌ", "Кровать"], ["كُرْسِيٌّ", "Стул"],
      ["مَا هَذَا؟", "Что это?"], ["قَمِيصٌ", "Рубашка"], ["نَجْمٌ", "Звезда"],
      ["بَيْتٌ", "Дом"], ["مَنْ هَذَا؟", "Кто это?"], ["وَلَدٌ", "Ребёнок, мальчик"],
      ["رَجُلٌ", "Мужчина"], ["تَاجِرٌ", "Торговец"], ["كَلْبٌ", "Собака"],
      ["قِطٌّ", "Кот"], ["حِمَارٌ", "Осёл"], ["حِصَانٌ", "Конь"],
      ["جَمَلٌ", "Верблюд"], ["دِيكٌ", "Петух"], ["مِنْدِيلٌ", "Платок, салфетка"],
      ["مُدَرِّسٌ", "Учитель"], ["طَبِيبٌ", "Врач"], ["طَالِبٌ", "Студент, ученик"],
      ["أَ", "Ли, разве?"], ["نَعَمْ", "Да"], ["لَا", "Нет"]
    ].map(([arabic, russian]) => ({ arabic, russian }))
  },
  {
    id: "lesson-2",
    title: "Урок 2",
    summary: "6 слов в единственном числе, в порядке из учебника.",
    words: [
      ["ذَلِكَ", "Тот"], ["إِمَامٌ", "Имам"], ["مَا ذَاكَ؟", "Что это вон там?"],
      ["حَجَرٌ", "Камень"], ["سُكَّرٌ", "Сахар"], ["لَبَنٌ", "Молоко, кефир"]
    ].map(([arabic, russian]) => ({ arabic, russian }))
  },
  {
    id: "lesson-3",
    title: "Урок 3",
    summary: "64 слова в единственном числе, в порядке из учебника.",
    words: [
      ["مَكْسُورٌ", "Сломанный"], ["مَفْتُوحٌ", "Открытый"], ["جَالِسٌ", "Сидящий"],
      ["وَاقِفٌ", "Стоящий"], ["جَدِيدٌ", "Новый"], ["قَدِيمٌ", "Старый"],
      ["بَارِدٌ", "Холодный"], ["حَارٌّ", "Горячий"], ["نَظِيفٌ", "Чистый"],
      ["وَسِخٌ", "Грязный"], ["قَمَرٌ", "Луна"], ["قَرِيبٌ", "Близкий, родной"],
      ["بَعِيدٌ", "Далёкий"], ["ثَقِيلٌ", "Тяжёлый"], ["خَفِيفٌ", "Лёгкий"],
      ["صَغِيرٌ", "Маленький"], ["كَبِيرٌ", "Большой"], ["جَمِيلٌ", "Красивый"],
      ["وَرَقٌ", "Бумага"], ["مَاءٌ", "Вода"], ["مُهَنْدِسٌ", "Инженер"],
      ["حُلْوٌ", "Сладкий"], ["لَذِيذٌ", "Вкусный"], ["دَفْتَرٌ", "Тетрадь"],
      ["دُكَّانٌ", "Магазин"], ["تُفَّاحَةٌ", "Яблоко"], ["مَرِيضٌ", "Больной"],
      ["غَنِيٌّ", "Богатый"], ["فَقِيرٌ", "Бедный"], ["طَوِيلٌ", "Высокий, длинный"],
      ["قَصِيرٌ", "Короткий"], ["أَبٌ", "Отец"], ["جَنَّةٌ", "Рай, сад"],
      ["خُبْزٌ", "Хлеб"], ["عَيْنٌ", "Глаз, родник, сам"], ["غَدَاءٌ", "Обед"],
      ["فَمٌ", "Рот"], ["هَوَاءٌ", "Воздух"], ["يَدٌ", "Рука"],
      ["ثَوْبٌ", "Одежда"], ["ذَهَبٌ", "Золото"], ["زَهْرَةٌ", "Цветок"],
      ["سَمَكٌ", "Рыба"], ["شَمْسٌ", "Солнце"], ["صَدْرٌ", "Грудь"],
      ["ضَيْفٌ", "Гость"], ["ظَهْرٌ", "Спина"], ["لَحْمٌ", "Мясо"],
      ["أَخٌ", "Брат"], ["رَسُولٌ", "Посланник, посол"],
      ["وَجْهٌ", "Лицо, способ, сторона, вид, причина"], ["صَدِيقٌ", "Друг"],
      ["الْقُرْآنُ", "Коран"], ["صَلَاةٌ", "Молитва, намаз"], ["كَعْبَةٌ", "Кааба"],
      ["رَأْسٌ", "Голова"], ["إِصْبَعٌ", "Палец"], ["صَابُونٌ", "Мыло"],
      ["ظُفْرٌ", "Ноготь"], ["فَجْرٌ", "Рассвет"], ["ظُهْرٌ", "Полдень"],
      ["عَصْرٌ", "Предвечернее время"], ["مَغْرِبٌ", "Закат, запад"], ["عِشَاءٌ", "Вечернее время"]
    ].map(([arabic, russian]) => ({ arabic, russian }))
  },
  {
    id: "lesson-4",
    title: "Урок 4",
    summary: "28 слов в единственном числе, в порядке из учебника.",
    words: [
      ["أَيْنَ", "Где"], ["غُرْفَةٌ", "Комната"], ["حَمَّامٌ", "Ванна, сауна"],
      ["هُوَ", "Он"], ["هِيَ", "Она"], ["مَطْبَخٌ", "Кухня"],
      ["سَاعَةٌ", "Часы"], ["مَاذَا", "Что?"], ["مَدْرَسَةٌ", "Школа"],
      ["جَامِعَةٌ", "Университет"], ["فَصْلٌ", "Класс, сезон года"],
      ["مِرْحَاضٌ", "Туалет"], ["سَمَاءٌ", "Небо"], ["مِنْ أَيْنَ", "Откуда?"],
      ["أَنْتَ", "Ты (м. р.)"], ["أَنْتِ", "Ты (ж. р.)"], ["الْيَابَانُ", "Япония"],
      ["الصِّينُ", "Китай"], ["الْهِنْدُ", "Индия"], ["الْفِلِبِّينُ", "Филиппины"],
      ["خَرَجَ", "Выйти"], ["ذَهَبَ", "Уйти, пойти"], ["مُدِيرٌ", "Директор"],
      ["سُوقٌ", "Рынок"], ["فِي", "В, внутри"], ["عَلَى", "На"],
      ["مِنْ", "Из, от, с; чем (при сравнении)"], ["إِلَى", "К, в, до (направление)"]
    ].map(([arabic, russian]) => ({ arabic, russian }))
  },
  {
    id: "lesson-5",
    title: "Урок 5",
    summary: "18 слов в единственном числе, в порядке из учебника.",
    words: [
      ["اِسْمٌ", "Имя"], ["بِنْتٌ", "Дочь"], ["اِبْنٌ", "Сын"],
      ["سَيَّارَةٌ", "Автомобиль"], ["مَدِينَةٌ", "Город"],
      ["الْمَدِينَةُ الْمُنَوَّرَةُ", "Лучезарная Медина"],
      ["عَمٌّ", "Дядя (брат отца)"], ["خَالٌ", "Дядя (брат матери)"],
      ["حَقِيبَةٌ", "Портфель, чемодан"], ["شَارِعٌ", "Улица"],
      ["مُغْلَقٌ", "Закрытый"], ["تَحْتَ", "Под"], ["هُنَاكَ", "Там"],
      ["أُسْتَاذٌ", "Профессор, учитель"],
      ["شَيْخٌ", "Старик, учитель, предводитель"], ["دُكْتُورٌ", "Доктор"],
      ["الْعِرَاقُ", "Ирак"], ["وَزِيرٌ", "Министр"]
    ].map(([arabic, russian]) => ({ arabic, russian }))
  },
  {
    id: "lesson-6",
    title: "Урок 6",
    summary: "22 слова в единственном числе, в порядке из учебника.",
    words: [
      ["أُخْتٌ", "Сестра"], ["أَيْضًا", "Также, тоже"], ["مِكْوَاةٌ", "Утюг"],
      ["لِمَنْ", "Чей? Для кого?"], ["دَرَّاجَةٌ", "Велосипед"], ["جِدًّا", "Очень"],
      ["مِلْعَقَةٌ", "Ложка"], ["قِدْرٌ", "Кастрюля"], ["بَقَرَةٌ", "Корова"],
      ["فَلَّاحٌ", "Земледелец"], ["أَنْفٌ", "Нос"], ["أُذُنٌ", "Ухо"],
      ["رِجْلٌ", "Нога"], ["دَجَاجَةٌ", "Курица"], ["ثَلَّاجَةٌ", "Холодильник"],
      ["نَافِذَةٌ", "Окно"], ["مُسْلِمٌ", "Мусульманин"], ["شَايٌ", "Чай"],
      ["قَهْوَةٌ", "Кофе"], ["أُمٌّ", "Мать"], ["مَشْرِقٌ", "Восток"],
      ["سَرِيعٌ", "Быстрый"]
    ].map(([arabic, russian]) => ({ arabic, russian }))
  },
  {
    id: "lesson-7",
    title: "Урок 7",
    summary: "6 слов в единственном числе, в порядке из учебника.",
    words: [
      ["تِلْكَ", "Та"], ["مُمَرِّضَةٌ", "Медсестра"], ["بَطَّةٌ", "Утка"],
      ["بَيْضَةٌ", "Яйцо"], ["نَاقَةٌ", "Верблюдица"], ["مُؤَذِّنٌ", "Муэдзин"]
    ].map(([arabic, russian]) => ({ arabic, russian }))
  },
  {
    id: "lesson-8",
    title: "Урок 8",
    summary: "12 слов в единственном числе, в порядке из учебника.",
    words: [
      ["سِكِّينٌ", "Нож"], ["أَمَامَ", "Перед, впереди"], ["خَلْفَ", "Позади, за"],
      ["أَمْرِيكَا", "Америка"], ["إِنْكِلْتَرَا", "Англия"], ["سُوَيْسْرَا", "Швейцария"],
      ["أَلْمَانِيَا", "Германия"], ["مُسْتَشْفًى", "Больница"], ["الْآنَ", "Сейчас"],
      ["سَبُّورَةٌ", "Школьная доска"], ["جَلَسَ", "Сидеть"], ["مِحْرَابٌ", "Михраб, ниша"]
    ].map(([arabic, russian]) => ({ arabic, russian }))
  },
  {
    id: "lesson-9",
    title: "Урок 9",
    summary: "28 слов и форм в порядке из учебника.",
    words: [
      ["فَاكِهَةٌ", "Фрукт"], ["عُصْفُورٌ", "Воробей"], ["طَائِرٌ", "Птица"],
      ["لُغَةٌ", "Язык"], ["أَنَا", "Я"], ["نَحْنُ", "Мы"],
      ["مَدْرَسَةٌ ثَانَوِيَّةٌ", "Полная средняя школа"], ["سَهْلٌ", "Лёгкий"],
      ["صَعْبٌ", "Сложный"], ["كَسْلَانُ", "Ленивый"], ["مُجْتَهِدٌ", "Старательный"],
      ["شَهِيرٌ", "Знаменитый"], ["الْقَاهِرَةُ", "Каир"],
      ["الْإِنْكِلِيزِيَّةُ", "Английский язык"], ["جَوْعَانُ", "Голодный"],
      ["عَطْشَانُ", "Жаждущий"], ["غَضْبَانُ", "Гневный"], ["مَلْآنُ", "Полный"],
      ["لِمَاذَا", "Почему"], ["يَوْمٌ", "День"], ["الْيَوْمَ", "Сегодня"],
      ["عِنْدَ", "У, при"], ["الَّذِي", "Который"], ["مُسْتَوْصَفٌ", "Поликлиника"],
      ["مَكْتَبَةٌ", "Библиотека"], ["مِرْوَحَةٌ", "Вентилятор"],
      ["حَادٌّ", "Острый"], ["كُوبٌ", "Стакан"]
    ].map(([arabic, russian]) => ({ arabic, russian }))
  },
  {
    id: "lesson-10",
    title: "Урок 10",
    summary: "18 слов и форм в порядке из учебника.",
    words: [
      ["فَتًى", "Юноша"], ["زَمِيلٌ", "Товарищ, коллега"], ["يَا", "О, эй (обращение)"],
      ["وَاحِدٌ", "Один"], ["هُنَا", "Здесь"], ["زَوْجٌ", "Муж, пара"],
      ["طِفْلٌ", "Ребёнок"], ["مَعَ", "С, вместе"], ["الْكُوَيْتُ", "Кувейт"],
      ["ـي", "Мой, мной (суффикс)"], ["ـكَ", "Твой, тобой (м. р., суффикс)"],
      ["ـكِ", "Твой, тобой (ж. р., суффикс)"], ["ـهُ", "Его, ним (суффикс)"],
      ["ـهَا", "Её, ней (суффикс)"], ["مَا", "Нет"],
      ["لِي", "Мой, для меня, у меня, мне"],
      ["لَكَ", "Твой, для тебя, у тебя, тебе"],
      ["لَهُ", "Его, для него, у него, ему"]
    ].map(([arabic, russian]) => ({ arabic, russian }))
  },
  {
    id: "lesson-11",
    title: "Урок 11",
    summary: "5 слов и форм в порядке из учебника.",
    words: [
      ["حَدِيقَةٌ", "Сад, парк"], ["أُحِبُّ", "Люблю"], ["نُحِبُّ", "Любим"],
      ["نَبِيٌّ", "Пророк"], ["أَحَدٌ", "Один, никто, некто"]
    ].map(([arabic, russian]) => ({ arabic, russian }))
  }
];

const DICTATION_DAYS = [
  {
    id: "dictation-day-1",
    title: "День 1",
    lessonIds: ["lesson-1", "lesson-2", "lesson-9", "lesson-10", "lesson-11"],
    description: "Уроки 1, 2, 9, 10 и 11 · 87 слов. Сначала повтори перевод, затем напиши слова по-арабски."
  },
  {
    id: "dictation-day-2",
    title: "День 2",
    lessonIds: ["lesson-3", "lesson-7", "lesson-8"],
    description: "Уроки 3, 7 и 8 · 82 слова. Большой 3-й урок удобно разделить на утро и вечер."
  },
  {
    id: "dictation-day-3",
    title: "День 3",
    lessonIds: ["lesson-4", "lesson-5", "lesson-6"],
    description: "Уроки 4, 5 и 6 · 68 слов. После них пройди «Все уроки» и повтори только ошибки."
  }
];


const STORAGE_KEY = "med-course-hard-words-v13";
const DEFAULT_SCOPE = LESSONS[0]?.id || "all";
const ALL_WORDS = LESSONS.flatMap((lesson) => lesson.words.map((word, index) => ({
  ...word,
  lessonId: lesson.id,
  lessonTitle: lesson.title,
  lessonSummary: lesson.summary,
  uid: `${lesson.id}:${index}`
})));
const WORDS_BY_LESSON = LESSONS.reduce((acc, lesson) => {
  acc[lesson.id] = lesson.words.map((word, index) => ({
    ...word,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonSummary: lesson.summary,
    uid: `${lesson.id}:${index}`
  }));
  return acc;
}, {});

const $ = (id) => document.getElementById(id);
let answerAudioContext = null;

function playAnswerSound(correct) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    answerAudioContext ||= new AudioContextClass();
    const play = () => {
      const now = answerAudioContext.currentTime;
      const notes = correct ? [523.25, 659.25, 783.99] : [220, 174.61];

      notes.forEach((frequency, noteIndex) => {
        const start = now + noteIndex * (correct ? 0.075 : 0.11);
        const duration = correct ? 0.2 : 0.24;
        const oscillator = answerAudioContext.createOscillator();
        const gain = answerAudioContext.createGain();

        oscillator.type = correct ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(correct ? 0.12 : 0.1, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain);
        gain.connect(answerAudioContext.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
      });
    };

    if (answerAudioContext.state === "suspended") {
      answerAudioContext.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch (_) {}
}

const stripMarks = (value) => value
  .normalize("NFKD")
  .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
  .replace(/[\s،,.!?؟:؛()"']/g, "")
  .replace(/ٱ/g, "ا")
  .trim();

const shuffle = (values) => {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const state = {
  mode: "translate",
  scope: DEFAULT_SCOPE,
  deck: [],
  index: 0,
  score: 0,
  streak: 0,
  answered: false,
  started: false,
  finished: false,
  mistakes: [],
  hardWordIds: new Set(),
  query: ""
};

try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  state.hardWordIds = new Set(stored);
} catch (_) {
  state.hardWordIds = new Set();
}

function selectedHardWords() {
  return ALL_WORDS.filter((word) => state.hardWordIds.has(word.uid));
}

function currentDictationDay(scope = state.scope) {
  return DICTATION_DAYS.find((day) => day.id === scope);
}

function activeWords() {
  if (state.scope === "all") return ALL_WORDS;
  if (state.scope === "hard") return selectedHardWords();
  const dictationDay = currentDictationDay();
  if (dictationDay) return dictationDay.lessonIds.flatMap((lessonId) => WORDS_BY_LESSON[lessonId] || []);
  return WORDS_BY_LESSON[state.scope];
}

function lessonScopeFromChoice() {
  return $("lesson-number")?.value || DEFAULT_SCOPE;
}

function populateLessonSelector() {
  const select = $("lesson-number");
  if (!select || select.options.length) return;
  select.innerHTML = LESSONS.map((lesson) => `<option value="${lesson.id}">${lesson.title}</option>`).join("");
}

function buildDeck(words) {
  if (state.mode === "translate") {
    return shuffle([
      ...words.map((word) => ({ ...word, task: "ar-ru" })),
      ...words.map((word) => ({ ...word, task: "ru-ar-choice" }))
    ]);
  }
  return shuffle(words).map((word) => ({ ...word, task: "spell" }));
}

function saveHardWords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.hardWordIds]));
  $("scope-hard-count").textContent = `${state.hardWordIds.size} выбрано`;
}

function updateMeta() {
  const total = state.deck.length || 1;
  const progress = !state.started ? 0 : state.finished ? 100 : ((state.index + (state.answered ? 1 : 0)) / total) * 100;
  $("question-number").textContent = state.started
    ? `Задание ${Math.min(state.index + 1, total)} из ${total}`
    : state.scope === "hard"
      ? "Выбери трудные слова"
      : "Перед началом теста";
  $("progress-percent").textContent = `${Math.round(progress)}%`;
  $("progress-bar").style.width = `${progress}%`;
  $("score").textContent = state.score;
  $("streak").textContent = state.streak;
}

function setButtons() {
  $("mode-translate").classList.toggle("active", state.mode === "translate");
  $("mode-spell").classList.toggle("active", state.mode === "spell");
  populateLessonSelector();
  const lessonChoice = lessonScopeFromChoice();
  $("lesson-number").value = LESSONS.some((lesson) => lesson.id === state.scope) ? state.scope : lessonChoice;
  $("scope-lesson-group").classList.toggle("active", state.scope.startsWith("lesson-"));
  const currentLesson = LESSONS.find((lesson) => lesson.id === $("lesson-number").value) || LESSONS[0];
  $("scope-lesson-group").querySelector("strong").textContent = currentLesson ? currentLesson.title : "Уроков пока нет";
  $("scope-all").classList.toggle("active", state.scope === "all");
  $("scope-hard").classList.toggle("active", state.scope === "hard");
  $("scope-dictation").classList.toggle("active", Boolean(currentDictationDay()));
  $("mode-translate").parentElement.hidden = state.scope === "hard";
}

function renderPreview() {
  if (!LESSONS.length) {
    $("question-block").innerHTML = `
      <div class="lesson-preview empty-lessons">
        <p class="eyebrow">Список очищен</p>
        <h2>Уроков и слов пока нет</h2>
        <p class="preview-intro">Игра готова к новому списку. После добавления слов здесь снова появятся уроки и тесты.</p>
      </div>`;
    return;
  }

  const dictationDay = currentDictationDay();
  const lessons = state.scope === "all"
    ? LESSONS
    : dictationDay
      ? LESSONS.filter((lesson) => dictationDay.lessonIds.includes(lesson.id))
      : LESSONS.filter((lesson) => lesson.id === state.scope);
  const previewTitle = dictationDay
    ? `${dictationDay.title}: подготовка к диктанту`
    : state.scope === "all"
      ? "Все уроки для повторения"
      : lessons[0].title;
  const previewIntro = dictationDay
    ? dictationDay.description
    : state.scope === "all"
      ? "Здесь показан весь набор слов из 1 тома. Можно пройти всё подряд или перейти к личному тесту."
      : lessons[0].summary;

  $("question-block").innerHTML = `
      <div class="lesson-preview">
      <p class="eyebrow">Сначала посмотри список слов</p>
      <h2>${previewTitle}</h2>
      <p class="preview-intro">${previewIntro}</p>
      ${dictationDay ? `
        <div class="dictation-days" aria-label="Выбор дня подготовки">
          ${DICTATION_DAYS.map((day) => {
            const wordCount = day.lessonIds.reduce((total, lessonId) => total + (WORDS_BY_LESSON[lessonId]?.length || 0), 0);
            return `<button class="dictation-day-button ${day.id === state.scope ? "active" : ""}" data-scope="${day.id}">
              <strong>${day.title}</strong>
              <span>${wordCount} слов</span>
            </button>`;
          }).join("")}
        </div>` : ""}
      <div class="preview-groups">
        ${lessons.map((lesson) => `
          <section class="preview-group">
            <h3>${lesson.title} · ${lesson.words.length} слов</h3>
            <div class="preview-word-grid">
              ${lesson.words.map((word) => `
                <div class="preview-word">
                  <span dir="rtl" lang="ar">${word.arabic}</span>
                  <small>${word.russian}</small>
                </div>
              `).join("")}
            </div>
          </section>
        `).join("")}
      </div>
      <button class="start-test-button" id="start-test">${dictationDay ? `Начать тренировку · ${activeWords().length} слов` : "Начать тест"} →</button>
    </div>`;

  document.querySelectorAll(".dictation-day-button").forEach((button) => {
    button.addEventListener("click", () => reset(state.mode, button.dataset.scope));
  });

  $("start-test").addEventListener("click", () => {
    state.started = true;
    state.deck = buildDeck(activeWords());
    state.index = 0;
    state.score = 0;
    state.streak = 0;
    state.answered = false;
    state.finished = false;
    state.mistakes = [];
    render();
  });
}

function renderResult() {
  const percent = Math.round((state.score / state.deck.length) * 100);
  const grade = percent >= 90 ? 5 : percent >= 70 ? 4 : percent >= 50 ? 3 : 2;
  const message = grade === 5
    ? "Отлично! Слова уже хорошо закрепились."
    : grade === 4
      ? "Очень хорошо. Ещё одно повторение укрепит результат."
      : grade === 3
        ? "Хорошее начало. Повтори слова и попробуй ещё раз."
        : "Ничего страшного. Повторение быстро поможет запомнить слова.";

  $("question-block").innerHTML = `
    <div class="result-screen">
      <p class="eyebrow">Тест завершён</p>
      <h2>${message}</h2>
      <div class="result-stats">
        <div><strong>${state.score}<span>/${state.deck.length}</span></strong><small>правильных ответов</small></div>
        <div><strong>${percent}%</strong><small>результат</small></div>
        <div><strong>${state.mistakes.length}</strong><small>слов повторить</small></div>
      </div>
      <div class="mistakes-review ${state.mistakes.length ? "has-mistakes" : "no-mistakes"}">
        <h3>${state.mistakes.length ? "Слова с ошибками" : "Без ошибок — отлично!"}</h3>
        ${state.mistakes.length ? `<div class="mistake-list">${state.mistakes.map((word) => `
          <div class="mistake-word">
            <span dir="rtl" lang="ar">${word.arabic}</span>
            <small>${word.russian}</small>
          </div>
        `).join("")}</div>` : ""}
      </div>
      <button class="result-restart" id="result-restart">↻ Пройти ещё раз</button>
    </div>`;

  $("result-restart").addEventListener("click", () => reset());
}

function feedback(correct, current) {
  const box = document.createElement("div");
  box.className = `feedback ${correct ? "feedback-good" : "feedback-bad"}`;
  box.innerHTML = `
    <div class="feedback-icon" aria-hidden="true">${correct ? "✓" : "↺"}</div>
    <div>
      <strong>${correct ? "Верно!" : "Почти. Правильный ответ:"}</strong>
      <p><span dir="rtl" lang="ar">${current.arabic}</span> — ${current.russian}${current.note ? `<br><span class="word-meta">${current.note}</span>` : ""}</p>
    </div>
    <button id="next-question">${state.index === state.deck.length - 1 ? "Посмотреть результат" : "Дальше →"}</button>`;
  $("question-block").append(box);
  $("next-question").addEventListener("click", next);
}

function grade(correct) {
  if (state.answered) return;
  state.answered = true;
  playAnswerSound(correct);
  const current = state.deck[state.index];
  if (correct) {
    state.score += 1;
    state.streak += 1;
  } else {
    state.streak = 0;
    if (!state.mistakes.some((word) => word.uid === current.uid)) state.mistakes.push(current);
    state.hardWordIds.add(current.uid);
    saveHardWords();
  }
  updateMeta();
  feedback(correct, current);
}

function renderTranslate(current) {
  const pool = state.scope === "hard" ? ALL_WORDS : activeWords();
  const options = shuffle([current, ...shuffle(pool.filter((word) => word.uid !== current.uid)).slice(0, 3)]);
  $("question-block").innerHTML = `
    <p class="prompt">Выбери правильный перевод</p>
    <div class="arabic-word" dir="rtl" lang="ar">${current.arabic}</div>
    <button class="reveal-answers" id="reveal-word-answers">Показать варианты ответов</button>
    <div class="answer-grid" id="word-answer-grid" hidden>
      ${options.map((word, i) => `
        <button class="answer-option" data-answer="${word.uid}">
          <span>${i + 1}</span>${word.russian}
        </button>
      `).join("")}
    </div>`;

  $("reveal-word-answers").addEventListener("click", () => {
    $("reveal-word-answers").hidden = true;
    $("word-answer-grid").hidden = false;
  });

  document.querySelectorAll(".answer-option").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.answered) return;
      const correct = button.dataset.answer === current.uid;
      document.querySelectorAll(".answer-option").forEach((option) => {
        option.disabled = true;
        if (option.dataset.answer === current.uid) option.classList.add("right");
      });
      if (!correct) button.classList.add("wrong");
      grade(correct);
    });
  });
}

function renderArabicChoice(current) {
  const pool = state.scope === "hard" ? ALL_WORDS : activeWords();
  const options = shuffle([current, ...shuffle(pool.filter((word) => word.uid !== current.uid)).slice(0, 3)]);
  $("question-block").innerHTML = `
    <p class="prompt">Выбери арабское слово</p>
    <div class="russian-word">${current.russian}</div>
    <button class="reveal-answers" id="reveal-word-answers">Показать варианты ответов</button>
    <div class="answer-grid" id="word-answer-grid" hidden>
      ${options.map((word, i) => `
        <button class="answer-option arabic-option" data-answer="${word.uid}">
          <span>${i + 1}</span><b dir="rtl" lang="ar">${word.arabic}</b>
        </button>
      `).join("")}
    </div>`;

  $("reveal-word-answers").addEventListener("click", () => {
    $("reveal-word-answers").hidden = true;
    $("word-answer-grid").hidden = false;
  });

  document.querySelectorAll(".answer-option").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.answered) return;
      const correct = button.dataset.answer === current.uid;
      document.querySelectorAll(".answer-option").forEach((option) => {
        option.disabled = true;
        if (option.dataset.answer === current.uid) option.classList.add("right");
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
      <div class="arabic-keyboard" aria-label="Экранная клавиатура">
        <div class="keyboard-label"><span>Клавиатура</span><small>Можно дописывать вручную</small></div>
        <div class="keyboard-row diacritics-row" dir="rtl">
          ${["َ", "ِ", "ُ", "ً", "ٍ", "ٌ", "ْ", "ّ"].map((key) => `<button type="button" data-key="${key}">${key}</button>`).join("")}
        </div>
        ${[
          ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د", "ذ"],
          ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
          ["ئ", "ء", "ؤ", "ر", "ى", "ة", "و", "ز", "ظ"]
        ].map((row) => `<div class="keyboard-row" dir="rtl">${row.map((key) => `<button type="button" data-key="${key}">${key}</button>`).join("")}</div>`).join("")}
        <div class="keyboard-tools">
          <button type="button" id="clear-input">Очистить</button>
          <button type="button" id="backspace">⌫ Удалить</button>
        </div>
      </div>
      <div class="spell-actions">
        <button class="hint-button" id="hint">Показать первую букву</button>
        <button class="check-button" id="check" disabled>Проверить</button>
      </div>
    </div>`;

  const input = $("arabic-answer");
  const check = $("check");
  input.focus();
  input.addEventListener("input", () => {
    check.disabled = !input.value.trim();
  });
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
  $("hint").addEventListener("click", () => {
    $("hint").textContent = `Начало: ${current.arabic.slice(0, 1)}`;
  });

  const checkAnswer = () => {
    if (state.answered || !input.value.trim()) return;
    const correct = stripMarks(input.value) === stripMarks(current.arabic);
    input.disabled = true;
    input.classList.add(correct ? "input-right" : "input-wrong");
    document.querySelector(".spell-actions").remove();
    grade(correct);
  };

  check.addEventListener("click", checkAnswer);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") checkAnswer();
  });
}

function renderHardSelector() {
  $("question-block").innerHTML = `
    <div class="hard-selector">
      <p class="eyebrow">Свой набор для повторения</p>
      <h2>Выбери трудные слова</h2>
      <p class="preview-intro">Каждое выбранное слово встретится два раза: арабский → русский и русский → арабский.</p>
      <div class="hard-tools">
        <button type="button" id="select-all-hard">Выбрать все</button>
        <button type="button" id="clear-hard">Очистить</button>
        <strong id="hard-selected-count">Выбрано: ${state.hardWordIds.size}</strong>
      </div>
      <div class="hard-word-groups">
        ${LESSONS.map((lesson) => `
          <section class="hard-word-group">
            <h3>${lesson.title}</h3>
            <div class="hard-word-grid">
              ${lesson.words.map((word, index) => {
                const uid = `${lesson.id}:${index}`;
                const selected = state.hardWordIds.has(uid);
                return `
                  <label class="hard-word ${selected ? "selected" : ""}">
                    <input type="checkbox" value="${uid}" ${selected ? "checked" : ""}>
                    <span dir="rtl" lang="ar">${word.arabic}</span>
                    <small>${word.russian}</small>
                    <i aria-hidden="true">✓</i>
                  </label>`;
              }).join("")}
            </div>
          </section>
        `).join("")}
      </div>
      <button class="start-hard-test" id="start-hard-test" ${state.hardWordIds.size ? "" : "disabled"}>Начать тест · <span>${state.hardWordIds.size * 2}</span> заданий →</button>
    </div>`;

  const updateSelection = () => {
    $("hard-selected-count").textContent = `Выбрано: ${state.hardWordIds.size}`;
    $("start-hard-test").disabled = state.hardWordIds.size === 0;
    $("start-hard-test").innerHTML = `Начать тест · <span>${state.hardWordIds.size * 2}</span> заданий →`;
    saveHardWords();
  };

  document.querySelectorAll(".hard-word input").forEach((input) => input.addEventListener("change", () => {
    input.checked ? state.hardWordIds.add(input.value) : state.hardWordIds.delete(input.value);
    input.closest(".hard-word").classList.toggle("selected", input.checked);
    updateSelection();
  }));

  $("select-all-hard").addEventListener("click", () => {
    ALL_WORDS.forEach((word) => state.hardWordIds.add(word.uid));
    renderHardSelector();
    saveHardWords();
  });

  $("clear-hard").addEventListener("click", () => {
    state.hardWordIds.clear();
    renderHardSelector();
    saveHardWords();
  });

  $("start-hard-test").addEventListener("click", () => {
    const words = selectedHardWords();
    if (!words.length) return;
    state.deck = buildDeck(words);
    state.index = 0;
    state.score = 0;
    state.streak = 0;
    state.answered = false;
    state.mistakes = [];
    state.finished = false;
    state.started = true;
    render();
  });
}

function renderLessonDeck() {
  if (!state.started) {
    if (state.scope === "hard") {
      renderHardSelector();
    } else {
      renderPreview();
    }
    return;
  }

  const current = state.deck[state.index];
  if (state.mode === "translate") {
    current.task === "ru-ar-choice" ? renderArabicChoice(current) : renderTranslate(current);
  } else {
    renderSpell(current);
  }
}

function renderWordList() {
  const q = state.query.trim().toLowerCase();
  const filteredLessons = LESSONS.map((lesson) => ({
    ...lesson,
    words: WORDS_BY_LESSON[lesson.id].filter((word) => {
      if (!q) return true;
      const haystack = `${word.arabic} ${word.russian} ${word.note || ""} ${lesson.title}`.toLowerCase();
      return haystack.includes(q);
    })
  })).filter((lesson) => lesson.words.length > 0);

  $("word-list").innerHTML = filteredLessons.map((lesson) => `
    <section>
      <div class="lesson-list-label">
        <span>${lesson.title}</span>
        <small>${lesson.words.length} слов</small>
      </div>
      <div class="word-grid">
        ${lesson.words.map((word) => `
          <label class="word-row">
            <input type="checkbox" class="hard-toggle" data-uid="${word.uid}" ${state.hardWordIds.has(word.uid) ? "checked" : ""} hidden>
            <span class="word-index">${String(Number(word.uid.split(":")[1]) + 1).padStart(2, "0")}</span>
            <span class="word-russian">${word.russian}</span>
            <span class="word-arabic" dir="rtl" lang="ar">${word.arabic}</span>
            ${word.note ? `<span class="word-meta">${word.note}</span>` : ""}
          </label>
        `).join("")}
      </div>
    </section>
  `).join("") || `<p class="preview-intro">Слов пока нет.</p>`;

  document.querySelectorAll(".hard-toggle").forEach((input) => input.addEventListener("change", () => {
    input.checked ? state.hardWordIds.add(input.dataset.uid) : state.hardWordIds.delete(input.dataset.uid);
    saveHardWords();
  }));
}

function reset(nextMode = state.mode, nextScope = state.scope) {
  state.mode = nextScope === "hard" ? "translate" : nextMode;
  state.scope = nextScope;
  state.deck = nextScope === "hard" ? [] : buildDeck(activeWords());
  state.index = 0;
  state.score = 0;
  state.streak = 0;
  state.answered = false;
  state.started = false;
  state.finished = false;
  state.mistakes = [];
  setButtons();
  updateMeta();
  renderLessonDeck();
}

function next() {
  if (state.index >= state.deck.length - 1) {
    state.finished = true;
    state.answered = false;
    updateMeta();
    renderResult();
    return;
  }
  state.index += 1;
  state.answered = false;
  renderLessonDeck();
}

function openDictionary() {
  $("dictionary-backdrop").hidden = false;
  $("dictionary-search").value = state.query;
  renderWordList();
}

function closeDictionary() {
  $("dictionary-backdrop").hidden = true;
}

function resetFromScope(scope) {
  if (state.scope === scope) return;
  reset(state.mode, scope);
}

$("lesson-count").textContent = String(LESSONS.length);
$("word-count").textContent = String(ALL_WORDS.length);

$("mode-translate").addEventListener("click", () => reset("translate", state.scope));
$("mode-spell").addEventListener("click", () => reset("spell", state.scope));
$("restart").addEventListener("click", () => reset());
$("scope-all").addEventListener("click", () => reset(state.mode, "all"));
$("scope-hard").addEventListener("click", () => reset(state.mode, "hard"));
$("scope-dictation").addEventListener("click", () => reset("spell", DICTATION_DAYS[0].id));
$("scope-lesson-group").addEventListener("click", (event) => {
  if (event.target === $("lesson-number")) return;
  reset(state.mode, lessonScopeFromChoice());
});
$("lesson-number").addEventListener("change", (event) => {
  reset(state.mode, event.target.value);
});
$("open-dictionary").addEventListener("click", openDictionary);
$("close-dictionary").addEventListener("click", closeDictionary);
$("dictionary-backdrop").addEventListener("click", (event) => {
  if (event.target === $("dictionary-backdrop")) closeDictionary();
});

$("dictionary-search").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderWordList();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDictionary();
});

function render() {
  setButtons();
  updateMeta();
  renderLessonDeck();
}

saveHardWords();
reset("translate", DEFAULT_SCOPE);

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js?v=13", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {});
  });
}
