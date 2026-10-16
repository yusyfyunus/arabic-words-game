const JUZ_DATA = {
  28: [
    [58, "Аль-Муджадиля", "المجادلة", 22], [59, "Аль-Хашр", "الحشر", 24],
    [60, "Аль-Мумтахана", "الممتحنة", 13], [61, "Ас-Сафф", "الصف", 14],
    [62, "Аль-Джумуа", "الجمعة", 11], [63, "Аль-Мунафикун", "المنافقون", 11],
    [64, "Ат-Тагабун", "التغابن", 18], [65, "Ат-Таляк", "الطلاق", 12],
    [66, "Ат-Тахрим", "التحريم", 12]
  ],
  29: [
    [67, "Аль-Мульк", "الملك", 30], [68, "Аль-Калям", "القلم", 52],
    [69, "Аль-Хакка", "الحاقة", 52], [70, "Аль-Мааридж", "المعارج", 44],
    [71, "Нух", "نوح", 28], [72, "Аль-Джинн", "الجن", 28],
    [73, "Аль-Муззаммиль", "المزمل", 20], [74, "Аль-Муддассир", "المدثر", 56],
    [75, "Аль-Кыяма", "القيامة", 40], [76, "Аль-Инсан", "الإنسان", 31],
    [77, "Аль-Мурсалят", "المرسلات", 50]
  ],
  30: [
    [78, "Ан-Наба", "النبأ", 40], [79, "Ан-Назиат", "النازعات", 46],
    [80, "Абаса", "عبس", 42], [81, "Ат-Таквир", "التكوير", 29],
    [82, "Аль-Инфитар", "الانفطار", 19], [83, "Аль-Мутаффифин", "المطففين", 36],
    [84, "Аль-Иншикак", "الانشقاق", 25], [85, "Аль-Бурудж", "البروج", 22],
    [86, "Ат-Тарик", "الطارق", 17], [87, "Аль-Аля", "الأعلى", 19],
    [88, "Аль-Гашия", "الغاشية", 26], [89, "Аль-Фаджр", "الفجر", 30],
    [90, "Аль-Балад", "البلد", 20], [91, "Аш-Шамс", "الشمس", 15],
    [92, "Аль-Лейль", "الليل", 21], [93, "Ад-Духа", "الضحى", 11],
    [94, "Аш-Шарх", "الشرح", 8], [95, "Ат-Тин", "التين", 8],
    [96, "Аль-Аляк", "العلق", 19], [97, "Аль-Кадр", "القدر", 5],
    [98, "Аль-Баййина", "البينة", 8], [99, "Аз-Зальзаля", "الزلزلة", 8],
    [100, "Аль-Адият", "العاديات", 15], [101, "Аль-Кариа", "القارعة", 11],
    [102, "Ат-Такасур", "التكاثر", 8], [103, "Аль-Аср", "العصر", 3],
    [104, "Аль-Хумаза", "الهمزة", 9], [105, "Аль-Филь", "الفيل", 5],
    [106, "Курайш", "قريش", 4], [107, "Аль-Маун", "الماعون", 7],
    [108, "Аль-Каусар", "الكوثر", 3], [109, "Аль-Кафирун", "الكافرون", 6],
    [110, "Ан-Наср", "النصر", 3], [111, "Аль-Масад", "المسد", 5],
    [112, "Аль-Ихляс", "الإخلاص", 4], [113, "Аль-Фаляк", "الفلق", 5],
    [114, "Ан-Нас", "الناس", 6]
  ]
};

const REMOTE_AUDIO = "https://everyayah.com/data/Ayman_Sowaid_64kbps/";
const LOCAL_FROM_SURAH = 101;
const arabicDigits = new Intl.NumberFormat("ar-EG", { useGrouping: false });
const refs = {
  audio: document.querySelector("#audio"), play: document.querySelector("#play"), playIcon: document.querySelector("#play-icon"),
  previous: document.querySelector("#previous"), next: document.querySelector("#next"), seek: document.querySelector("#seek"),
  elapsed: document.querySelector("#elapsed"), duration: document.querySelector("#duration"), autoplay: document.querySelector("#autoplay"),
  speed: document.querySelector("#speed"), status: document.querySelector("#status"), surahList: document.querySelector("#surah-list"),
  ayahPicker: document.querySelector("#ayah-picker"), surahName: document.querySelector("#surah-name"),
  surahArabic: document.querySelector("#surah-arabic"), ayahLabel: document.querySelector("#ayah-label"),
  ayahNumber: document.querySelector("#ayah-number"), panelTitle: document.querySelector("#surah-panel-title"),
  surahCount: document.querySelector("#surah-count"), pickerSummary: document.querySelector("#picker-summary")
};

const saved = JSON.parse(localStorage.getItem("ayman-juz-player") || "{}");
let currentJuz = [28, 29, 30].includes(saved.juz) ? saved.juz : 30;
let currentSurahIndex = Math.max(0, Number(saved.surahIndex) || 0);
let currentAyah = Math.max(1, Number(saved.ayah) || 1);
let triedRemoteFallback = false;

function fileId(surah, ayah) {
  return `${String(surah).padStart(3, "0")}${String(ayah).padStart(3, "0")}.mp3`;
}

function audioUrl(surah, ayah, forceRemote = false) {
  const file = fileId(surah, ayah);
  return !forceRemote && surah >= LOCAL_FROM_SURAH ? `../audio/ayman-suwaid/${file}` : `${REMOTE_AUDIO}${file}`;
}

function activeSurah() {
  const list = JUZ_DATA[currentJuz];
  currentSurahIndex = Math.min(currentSurahIndex, list.length - 1);
  return list[currentSurahIndex];
}

function saveState() {
  localStorage.setItem("ayman-juz-player", JSON.stringify({ juz: currentJuz, surahIndex: currentSurahIndex, ayah: currentAyah }));
}

function formatTime(value) {
  if (!Number.isFinite(value)) return "0:00";
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

function renderTabs() {
  document.querySelectorAll("[data-juz]").forEach((button) => {
    const active = Number(button.dataset.juz) === currentJuz;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function renderSurahs() {
  const surahs = JUZ_DATA[currentJuz];
  refs.panelTitle.textContent = `Суры ${currentJuz}-го джуза`;
  refs.surahCount.textContent = `${surahs.length} сур`;
  refs.surahList.innerHTML = surahs.map(([number, name, arabic, count], index) => `
    <button class="surah-button${index === currentSurahIndex ? " active" : ""}" data-surah-index="${index}">
      <span class="surah-number">${number}</span>
      <span class="surah-copy"><strong>${name}</strong><small>${count} аятов</small></span>
      <span lang="ar" dir="rtl">${arabic}</span>
    </button>`).join("");
}

function renderAyahs() {
  const count = activeSurah()[3];
  refs.pickerSummary.textContent = `${count} аятов`;
  refs.ayahPicker.innerHTML = Array.from({ length: count }, (_, index) => {
    const ayah = index + 1;
    return `<button class="${ayah === currentAyah ? "active" : ""}" data-ayah="${ayah}" aria-label="Аят ${ayah}">${ayah}</button>`;
  }).join("");
}

function updateSource({ keepPlaying = false, forceRemote = false } = {}) {
  const [surah, name, arabic, count] = activeSurah();
  currentAyah = Math.min(Math.max(1, currentAyah), count);
  const wasPlaying = keepPlaying || !refs.audio.paused;
  triedRemoteFallback = forceRemote;
  refs.audio.src = audioUrl(surah, currentAyah, forceRemote);
  refs.audio.playbackRate = Number(refs.speed.value);
  refs.surahName.textContent = name;
  refs.surahArabic.textContent = arabic;
  refs.ayahLabel.textContent = `Аят ${currentAyah} из ${count} · сура ${surah}`;
  refs.ayahNumber.textContent = arabicDigits.format(currentAyah);
  refs.seek.value = 0;
  refs.elapsed.textContent = "0:00";
  refs.duration.textContent = "0:00";
  refs.status.classList.remove("error");
  refs.status.textContent = "Запись готова к воспроизведению.";
  renderAyahs();
  renderSurahs();
  saveState();
  if (wasPlaying) playAudio();
}

async function playAudio() {
  try {
    await refs.audio.play();
    refs.status.classList.remove("error");
    refs.status.textContent = "Воспроизведение аята.";
  } catch (error) {
    refs.status.classList.add("error");
    refs.status.textContent = "Не удалось включить запись. Проверь интернет и нажми ▶ ещё раз.";
  }
}

function moveAyah(step, autoplay = false) {
  const surahs = JUZ_DATA[currentJuz];
  let count = activeSurah()[3];
  currentAyah += step;
  if (currentAyah > count) {
    if (currentSurahIndex < surahs.length - 1) {
      currentSurahIndex += 1;
      currentAyah = 1;
    } else {
      currentAyah = count;
      refs.status.textContent = `Джуз ${currentJuz} прослушан до конца.`;
      return;
    }
  } else if (currentAyah < 1) {
    if (currentSurahIndex > 0) {
      currentSurahIndex -= 1;
      count = activeSurah()[3];
      currentAyah = count;
    } else {
      currentAyah = 1;
      return;
    }
  }
  updateSource({ keepPlaying: autoplay });
}

document.querySelector(".juz-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-juz]");
  if (!button) return;
  refs.audio.pause();
  currentJuz = Number(button.dataset.juz);
  currentSurahIndex = 0;
  currentAyah = 1;
  renderTabs();
  updateSource();
});

refs.surahList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-surah-index]");
  if (!buttn) return;
  refs.audio.pause();
  currentSurahIndex = Number(button.dataset.surahIndex);
  currentAyah = 1;
  updateSource();
  if (window.innerWidth < 761) document.querySelector(".player-card").scrollIntoView({ behavior: "smooth", block: "start" });
});

refs.ayahPicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-ayah]");
  if (!buttn) return;
  const wasPlaying = !refs.audio.paused;
  currentAyah = Number(button.dataset.ayah);
  updateSource({ keepPlaying: wasPlaying });
});

refs.play.addEventListener("click", () => refs.audio.paused ? playAudio() : refs.audio.pause());
refs.previous.addEventListener("click", () => moveAyah(-1, !refs.audio.paused));
refs.next.addEventListener("click", () => moveAyah(1, !refs.audio.paused));
refs.speed.addEventListener("change", () => { refs.audio.playbackRate = Number(refs.speed.value); });
refs.seek.addEventListener("input", () => {
  if (Number.isFinite(refs.audio.duration)) refs.audio.currentTime = (Number(refs.seek.value) / 100) * refs.audio.duration;
});

refs.audio.addEventListener("play", () => { refs.playIcon.textContent = "◤"; });
refs.audio.addEventListener("pause", () => { refs.playIcon.textContent = "▶"; });
refs.audio.addEventListener("loadedmetadata", () => { refs.duration.textContent = formatTime(refs.audio.duration); });
refs.audio.addEventListener("timeupdate", () => {
  refs.elapsed.textContent = formatTime(refs.audio.currentTime);
  refs.seek.value = refs.audio.duration ? (refs.audio.currentTime / refs.audio.duration) * 100 : 0;
});
refs.audio.addEventListener("ended", () => {
  refs.playIcon.textContent = "▶";
  if (refs.autoplay.checked) moveAyah(1, true);
  else refs.status.textContent = "Аят прослушан. Выбери следующий или включи повтор.";
});
refs.audio.addEventListener("error", () => {
  const surah = activeSurah()[0];
  if (surah >= LOCAL_FROM_SURAH && !triedRemoteFallback) {
    updateSource({ keepPlaying: true, forceRemote: true });
    return;
  }
  refs.status.classList.add("error");
  refs.status.textContent = "Запись не загрузилась. Проверь подключение к интернету.";
});

renderTabs();
renderSurahs();
updateSource();
