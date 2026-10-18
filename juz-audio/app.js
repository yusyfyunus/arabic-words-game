const JUZ_META = {
  28:[[58,"Аль-Муджадиля","المجادلة",22],[59,"Аль-Хашр","الحشر",24],[60,"Аль-Мумтахана","الممتحنة",13],[61,"Ас-Сафф","الصف",14],[62,"Аль-Джумуа","الجمعة",11],[63,"Аль-Мунафикун","المنافقون",11],[64,"Ат-Тагабун","التغابن",18],[65,"Ат-Таляк","الطلاق",12],[66,"Ат-Тахрим","التحريم",12]],
  29:[[67,"Аль-Мульк","الملك",30],[68,"Аль-Калям","القلم",52],[69,"Аль-Хакка","الحاقة",52],[70,"Аль-Мааридж","المعارج",44],[71,"Нух","نوح",28],[72,"Аль-Джинн","الجن",28],[73,"Аль-Муззаммиль","المزمل",20],[74,"Аль-Муддассир","المدثر",56],[75,"Аль-Кыяма","القيامة",40],[76,"Аль-Инсан","الإنسان",31],[77,"Аль-Мурсалят","المرسلات",50]],
  30:[[78,"Ан-Наба","النبأ",40],[79,"Ан-Назиат","النازعات",46],[80,"Абаса","عبس",42],[81,"Ат-Таквир","التكوير",29],[82,"Аль-Инфитар","الانفطار",19],[83,"Аль-Мутаффифин","المطففين",36],[84,"Аль-Иншикак","الانشقاق",25],[85,"Аль-Бурудж","البروج",22],[86,"Ат-Тарик","الطارق",17],[87,"Аль-Аля","الأعلى",19],[88,"Аль-Гашия","الغاشية",26],[89,"Аль-Фаджр","الفجر",30],[90,"Аль-Балад","البلد",20],[91,"Аш-Шамс","الشمس",15],[92,"Аль-Лейль","الليل",21],[93,"Ад-Духа","الضحى",11],[94,"Аш-Шарх","الشرح",8],[95,"Ат-Тин","التين",8],[96,"Аль-Аляк","العلق",19],[97,"Аль-Кадр","القدر",5],[98,"Аль-Баййина","البينة",8],[99,"Аз-Зальзаля","الزلزلة",8],[100,"Аль-Адият","العاديات",11],[101,"Аль-Кариа","القارعة",11],[102,"Ат-Такасур","التكاثر",8],[103,"Аль-Аср","العصر",3],[104,"Аль-Хумаза","الهمزة",9],[105,"Аль-Филь","الفيل",5],[106,"Курайш","قريش",4],[107,"Аль-Маун","الماعون",7],[108,"Аль-Каусар","الكوثر",3],[109,"Аль-Кафирун","الكافرون",6],[110,"Ан-Наср","النصر",3],[111,"Аль-Масад","المسد",5],[112,"Аль-Ихляс","الإخلاص",4],[113,"Аль-Фаляк","الفلق",5],[114,"Ан-Нас","الناس",6]]
};

const API_BASES=["https://api.alquran.cloud/v1","https://alquran.api.alislam.ru/v1"];
const AUDIO_BASE="https://everyayah.com/data/Ayman_Sowaid_64kbps/";
const LOCAL_AUDIO_FROM_SURAH=101;
const CACHE_VERSION=3;
const praiseAudio=new Audio("../audio/feedback/mashaallah.wav");
praiseAudio.preload="auto";
const ids=["juz-screen","loading-screen","practice-screen","finish-screen","setup-note","loading-title","loading-copy","cancel-loading","exit-practice","practice-title","score-label","progress-label","progress-fill","phase-label","surah-label","cue-kind","cue-arabic","cue-russian","audio","play-cue","repeat-cue","answer-panel","voice-status","speak-button","heard-panel","heard-text","feedback","manual-panel","manual-answer","check-manual","answer-reveal","answer-number","answer-arabic","show-answer","next-question","finish-copy","repeat-juz","choose-juz"];
const refs=Object.fromEntries(ids.map((id)=>[id.replaceAll("-","_"),document.getElementById(id)]));
const state={juz:30,surahs:[],deck:[],index:0,score:0,errors:0,answered:false,recognition:null,listening:false,audioRemote:false,loadToken:0,noSpeechCount:0,nextTimer:null,retryTimer:null};

function showScreen(name){["juz","loading","practice","finish"].forEach((key)=>{refs[`${key}_screen`].hidden=key!==name;});window.scrollTo({top:0,behavior:"smooth"});}
function shuffle(items){const copy=[...items];for(let i=copy.length-1;i>0;i-=1){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
function cacheKey(juz){return `continue-juz-${juz}-v${CACHE_VERSION}`;}
function readCache(juz){try{const value=JSON.parse(localStorage.getItem(cacheKey(juz))||"null");return value?.length?value:null;}catch(error){return null;}}
function writeCache(juz,data){try{localStorage.setItem(cacheKey(juz),JSON.stringify(data));}catch(error){/* приватный режим */}}

function groupAyahs(juz,ayahs){
  const surahs=JUZ_META[juz].map(([number,name,arabicName,count])=>({number,name,arabicName,count,ayahs:[]}));
  const map=new Map(surahs.map((surah)=>[surah.number,surah]));
  ayahs.forEach((ayah)=>{const surah=map.get(ayah.surah?.number);if(surah)surah.ayahs.push({number:ayah.numberInSurah,text:ayah.text});});
  if(surahs.some((surah)=>surah.ayahs.length!==surah.count))throw new Error("Получен неполный текст джуза");
  return surahs;
}

async function fetchJuz(juz){
  const cached=readCache(juz);if(cached)return cached;
  let lastError=null;
  for(const base of API_BASES){try{const response=await fetch(`${base}/juz/${juz}/quran-uthmani`);if(!response.ok)throw new Error(`HTTP ${response.status}`);const payload=await response.json();const grouped=groupAyahs(juz,payload?.data?.ayahs||[]);writeCache(juz,grouped);return grouped;}catch(error){lastError=error;}}
  throw lastError||new Error("Не удалось загрузить аяты");
}

function buildDeck(surahs){
  const lanes=surahs.map((surah)=>{
    const first=surah.ayahs[0];
    const start={surahNumber:surah.number,surahName:surah.name,surahArabicName:surah.arabicName,isStart:true,fromNumber:0,fromText:surah.arabicName,nextNumber:first.number,nextText:first.text};
    const transitions=surah.ayahs.slice(0,-1).map((ayah,index)=>({surahNumber:surah.number,surahName:surah.name,surahArabicName:surah.arabicName,isStart:false,fromNumber:ayah.number,fromText:ayah.text,nextNumber:surah.ayahs[index+1].number,nextText:surah.ayahs[index+1].text}));
    return{surahNumber:surah.number,items:shuffle([start,...transitions])};
  });
  const deck=[];let previous=null;
  while(lanes.some((lane)=>lane.items.length)){
    let available=lanes.filter((lane)=>lane.items.length&&lane.surahNumber!==previous);if(!available.length)available=lanes.filter((lane)=>lane.items.length);
    const lane=available[Math.floor(Math.random()*available.length)];deck.push(lane.items.pop());previous=lane.surahNumber;
  }
  return deck;
}

async function startJuz(juz){
  stopEverything();unlockPraise();state.juz=Number(juz);const token=++state.loadToken;refs.loading_title.textContent=`Загружаю ${state.juz}-й джуз…`;refs.loading_copy.textContent="После подсказки Safari один раз запросит доступ к микрофону, затем занятие продолжится автоматически.";showScreen("loading");
  try{const surahs=await fetchJuz(state.juz);if(token!==state.loadToken)return;state.surahs=surahs;state.deck=buildDeck(surahs);state.index=0;state.score=0;state.errors=0;refs.practice_title.textContent=`${state.juz}-й джуз`;showScreen("practice");renderQuestion();playCue();}
  catch(error){if(token!==state.loadToken)return;refs.loading_title.textContent="Не удалось загрузить аяты";refs.loading_copy.textContent="Проверь интернет и нажми на джуз ещё раз.";}
}

function current(){return state.deck[state.index];}
function fileId(surah,ayah){return `${String(surah).padStart(3,"0")}${String(ayah).padStart(3,"0")}.mp3`;}
function audioUrl(surah,ayah,remote=false){const file=fileId(surah,ayah);return !remote&&surah>=LOCAL_AUDIO_FROM_SURAH?`../audio/ayman-suwaid/${file}`:`${AUDIO_BASE}${file}`;}

function renderQuestion(){
  stopRecognition();clearTimeout(state.nextTimer);clearTimeout(state.retryTimer);const item=current();state.answered=false;state.audioRemote=false;state.noSpeechCount=0;
  refs.score_label.textContent=`Верно ${state.score} · Ошибки ${state.errors}`;refs.progress_label.textContent=`Задание ${state.index+1} из ${state.deck.length}`;refs.progress_fill.style.width=`${((state.index+1)/state.deck.length)*100}%`;
  refs.surah_label.textContent=`Сура ${item.surahNumber} · ${item.surahName}`;refs.phase_label.textContent="Слушай подсказку";
  refs.cue_kind.textContent=item.isStart?"Начни суру с первого аята":`Айман читает аят ${item.fromNumber}`;
  refs.cue_arabic.textContent=item.isStart?item.surahArabicName:item.fromText;refs.cue_russian.textContent=item.isStart?`Начни суру «${item.surahName}»`:"После записи произнеси следующий аят.";
  refs.answer_panel.hidden=true;refs.heard_panel.hidden=true;refs.feedback.hidden=true;refs.feedback.classList.remove("error");refs.manual_panel.hidden=true;refs.manual_answer.value="";refs.answer_reveal.hidden=true;refs.next_question.hidden=true;refs.show_answer.hidden=false;refs.play_cue.disabled=false;refs.play_cue.textContent=item.isStart?"▶ Назвать суру":"▶ Прослушать подсказку";
  if(!item.isStart)refs.audio.src=audioUrl(item.surahNumber,item.fromNumber);
}

function speakRussian(text,onEnd){
  if(!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window)){onEnd?.();return;}
  window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang="ru-RU";utterance.rate=.87;utterance.onend=()=>onEnd?.();utterance.onerror=()=>onEnd?.();window.speechSynthesis.speak(utterance);
}

async function playCue(){
  stopRecognition();const item=current();refs.answer_panel.hidden=true;refs.phase_label.textContent="Слушай подсказку";refs.play_cue.disabled=true;refs.play_cue.textContent="Идёт подсказка…";
  if(item.isStart){speakRussian(`Начни суру ${item.surahName}`,beginAnswer);return;}
  try{refs.audio.currentTime=0;await refs.audio.play();}catch(error){refs.play_cue.disabled=false;refs.play_cue.textContent="▶ Попробовать снова";showFeedback("Не удалось включить запись. Проверь интернет и попробуй снова.",true);}
}

function beginAnswer(){refs.phase_label.textContent="Теперь продолжи";refs.play_cue.disabled=false;refs.play_cue.textContent=current().isStart?"▶ Назвать суру снова":"▶ Слушать снова";refs.answer_panel.hidden=false;refs.voice_status.textContent="Подсказка закончилась. Автоматически включаю микрофон…";refs.speak_button.textContent="Включаю микрофон…";refs.speak_button.classList.remove("listening");clearTimeout(state.retryTimer);state.retryTimer=setTimeout(startRecognition,650);}

function normalizeArabic(text){return String(text||"").toLowerCase().normalize("NFD").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/ـ/g,"").replace(/[^\u0600-\u06FF\s]/g," ").replace(/\s+/g," ").trim();}
function similarity(spoken,expected){const spokenWords=normalizeArabic(spoken).split(" ").filter(Boolean);const expectedWords=normalizeArabic(expected).split(" ").filter(Boolean);if(!spokenWords.length||!expectedWords.length)return 0;const spokenSet=new Set(spokenWords),expectedSet=new Set(expectedWords);const coverage=expectedWords.filter((word)=>spokenSet.has(word)).length/expectedWords.length;const precision=spokenWords.filter((word)=>expectedSet.has(word)).length/spokenWords.length;return coverage*.72+precision*.28;}
function showFeedback(message,error=false){refs.feedback.hidden=false;refs.feedback.classList.toggle("error",error);refs.feedback.textContent=message;}

function unlockPraise(){
  praiseAudio.muted=true;
  const attempt=praiseAudio.play();
  if(attempt?.then)attempt.then(()=>{praiseAudio.pause();praiseAudio.currentTime=0;praiseAudio.muted=false;}).catch(()=>{praiseAudio.muted=false;});
  else praiseAudio.muted=false;
}

function playPraise(onEnd){
  let finished=false;const finish=()=>{if(finished)return;finished=true;clearTimeout(watchdog);praiseAudio.onended=null;praiseAudio.onerror=null;onEnd?.();};
  const watchdog=setTimeout(finish,4200);praiseAudio.onended=finish;praiseAudio.onerror=finish;praiseAudio.muted=false;praiseAudio.currentTime=0;
  const attempt=praiseAudio.play();if(attempt?.catch)attempt.catch(finish);
}

function evaluateAnswer(text){
  if(state.answered)return;const expected=current().nextText;const short=normalizeArabic(expected).split(" ").length<=3;const score=similarity(text,expected);const passed=score>=(short?0.58:0.48);state.answered=true;
  if(passed){state.score+=1;showFeedback("МашаАллах! Продолжение верное. Перехожу дальше…");}else{state.errors+=1;showFeedback("Пока не всё совпало. Показываю продолжение и перехожу дальше…",true);}
  refs.score_label.textContent=`Верно ${state.score} · Ошибки ${state.errors}`;refs.next_question.hidden=false;clearTimeout(state.nextTimer);
  if(passed)playPraise(()=>{state.nextTimer=setTimeout(nextQuestion,300);});
  else{revealAnswer(false);state.nextTimer=setTimeout(nextQuestion,3200);}
}

function startRecognition(){
  if(state.answered)return;refs.heard_panel.hidden=true;refs.feedback.hidden=true;const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){refs.voice_status.textContent="Этот браузер не распознаёт арабскую речь. Используй поле ручной проверки.";refs.manual_panel.hidden=false;return;}
  stopRecognition();const recognition=new Recognition();state.recognition=recognition;recognition.lang="ar-SA";recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=3;let bestText="",bestScore=0;
    recognition.onstart=()=>{state.listening=true;refs.speak_button.classList.add("listening");refs.speak_button.textContent="Слушаю…";refs.voice_status.textContent="Читай следующий аят. Когда закончишь, немного помолчи.";};
    recognition.onresult=(event)=>{for(let i=event.resultIndex;i<event.results.length;i+=1){for(let a=0;a<event.results[i].length;a+=1){const text=event.results[i][a].transcript.trim(),score=similarity(text,current().nextText);if(score>=bestScore){bestText=text;bestScore=score;}}}refs.heard_panel.hidden=false;refs.heard_text.textContent=bestText;};
    let recognitionFailed=false;
    recognition.onerror=(event)=>{recognitionFailed=true;state.listening=false;refs.speak_button.classList.remove("listening");refs.speak_button.textContent="Повторный запуск…";if(event.error==="no-speech"&&state.noSpeechCount<2){state.noSpeechCount+=1;refs.voice_status.textContent="Пока не услышала ответ. Продолжаю слушать автоматически…";clearTimeout(state.retryTimer);state.retryTimer=setTimeout(startRecognition,900);return;}const messages={"not-allowed":"Разреши микрофон для этого сайта в настройках Safari.","no-speech":"Я не услышала продолжение. Используй запасную кнопку или ручную проверку.","network":"Для распознавания речи нужен интернет."};refs.voice_status.textContent=messages[event.error]||"Не удалось проверить речь. Используй запасную кнопку.";refs.speak_button.textContent="Говорить";refs.manual_panel.hidden=false;};
    recognition.onend=()=>{state.listening=false;refs.speak_button.classList.remove("listening");refs.speak_button.textContent="Говорить ещё раз";if(recognitionFailed)return;if(bestText){evaluateAnswer(bestText);return;}if(state.noSpeechCount<2){state.noSpeechCount+=1;refs.voice_status.textContent="Текст не распознан. Слушаю ещё раз автоматически…";clearTimeout(state.retryTimer);state.retryTimer=setTimeout(startRecognition,900);}else{refs.voice_status.textContent="Safari не передал текст. Используй запасную кнопку или ручную проверку.";refs.manual_panel.hidden=false;}};
  try{recognition.start();}catch(error){refs.voice_status.textContent="Микрофон уже запускается. Подожди секунду.";}
}

function stopRecognition(){const recognition=state.recognition;state.recognition=null;state.listening=false;refs.speak_button?.classList.remove("listening");if(!recognition)return;recognition.onstart=null;recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{recognition.abort();}catch(error){/* уже остановлен */}}
function revealAnswer(countError=true){if(countError&&!state.answered){state.answered=true;state.errors+=1;refs.score_label.textContent=`Верно ${state.score} · Ошибки ${state.errors}`;}refs.answer_number.textContent=current().nextNumber;refs.answer_arabic.textContent=current().nextText;refs.answer_reveal.hidden=false;refs.next_question.hidden=false;refs.show_answer.hidden=true;}
function nextQuestion(){if(!state.answered){revealAnswer(true);return;}if(state.index>=state.deck.length-1){finishSession();return;}state.index+=1;renderQuestion();playCue();}
function finishSession(){stopEverything();refs.finish_copy.textContent=`${state.juz}-й джуз: верно ${state.score}, ошибок ${state.errors}, всего ${state.deck.length} заданий.`;showScreen("finish");}
function stopEverything(){stopRecognition();clearTimeout(state.nextTimer);clearTimeout(state.retryTimer);state.nextTimer=null;state.retryTimer=null;window.speechSynthesis?.cancel();try{refs.audio.pause();refs.audio.currentTime=0;praiseAudio.pause();praiseAudio.currentTime=0;}catch(error){/* аудио не загружено */}}

document.querySelector(".juz-grid").addEventListener("click",(event)=>{const button=event.target.closest("[data-juz]");if(button)startJuz(button.dataset.juz);});
refs.cancel_loading.addEventListener("click",()=>{state.loadToken+=1;showScreen("juz");});
refs.exit_practice.addEventListener("click",()=>{stopEverything();showScreen("juz");});
refs.play_cue.addEventListener("click",playCue);refs.repeat_cue.addEventListener("click",playCue);
refs.speak_button.addEventListener("click",()=>state.listening?stopRecognition():startRecognition());
refs.check_manual.addEventListener("click",()=>{const text=refs.manual_answer.value.trim();if(text)evaluateAnswer(text);});
refs.show_answer.addEventListener("click",()=>revealAnswer(true));refs.next_question.addEventListener("click",nextQuestion);
refs.repeat_juz.addEventListener("click",()=>startJuz(state.juz));refs.choose_juz.addEventListener("click",()=>showScreen("juz"));
refs.audio.addEventListener("ended",beginAnswer);
refs.audio.addEventListener("error",()=>{const item=current();if(item&&!state.audioRemote&&item.surahNumber>=LOCAL_AUDIO_FROM_SURAH){state.audioRemote=true;refs.audio.src=audioUrl(item.surahNumber,item.fromNumber,true);playCue();return;}refs.play_cue.disabled=false;refs.play_cue.textContent="▶ Попробовать снова";showFeedback("Запись не загрузилась. Проверь интернет.",true);});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")stopEverything();});
