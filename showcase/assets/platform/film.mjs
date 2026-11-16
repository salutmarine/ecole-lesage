const translations={
 fr:{unavailable:'Le film ne peut pas être chargé pour le moment. Vous pouvez réessayer.',playFailed:'Le film n’a pas pu démarrer. Réessayez ou utilisez les commandes du lecteur.'},
 en:{unavailable:'The film is currently unavailable. Please try again.',playFailed:'The film could not start. Please try again or use the player controls.'},
 ja:{unavailable:'現在、映像を読み込めません。もう一度お試しください。',playFailed:'映像を再生できませんでした。もう一度お試しいただくか、プレーヤーの操作ボタンをご利用ください。'}
};
const ja={Play:'再生',Pause:'一時停止',Mute:'消音',Unmute:'消音を解除','Seek backward':'戻る','Seek forward':'進む','Enter fullscreen mode':'全画面表示','Exit fullscreen mode':'全画面表示を終了','Enter picture in picture mode':'ピクチャーインピクチャー','Exit picture in picture mode':'ピクチャーインピクチャーを終了','video player':'ビデオプレーヤー',volume:'音量',seek:'再生位置','playback time':'再生時間',play:'再生',pause:'一時停止',mute:'消音',unmute:'消音を解除','enter fullscreen mode':'全画面表示','exit fullscreen mode':'全画面表示を終了','enter picture in picture mode':'ピクチャーインピクチャー','exit picture in picture mode':'ピクチャーインピクチャーを終了','seek back {seekOffset} seconds':'{seekOffset}秒戻る','seek forward {seekOffset} seconds':'{seekOffset}秒進む',hour:'時間',hours:'時間',minute:'分',minutes:'分',second:'秒',seconds:'秒','{currentTime} of {totalTime}':'{totalTime}中{currentTime}','{time} remaining':'残り{time}','video not loaded, unknown time.':'映像を読み込んでいます。','media loading':'読み込み中'};
let chromeReady;
async function loadChrome(lang){
 if(!chromeReady)chromeReady=(async()=>{
  const i18n=await import('./vendor/media-chrome/utils/i18n.js');
  if(lang==='fr')await import('./vendor/media-chrome/lang/fr.js');
  if(lang==='ja')i18n.addTranslation('ja',ja);i18n.setLanguage(lang);
  await Promise.all([
   import('./vendor/media-chrome/media-controller.js'),import('./vendor/media-chrome/media-control-bar.js'),import('./vendor/media-chrome/media-play-button.js'),
   import('./vendor/media-chrome/media-seek-backward-button.js'),import('./vendor/media-chrome/media-seek-forward-button.js'),import('./vendor/media-chrome/media-time-range.js'),
   import('./vendor/media-chrome/media-time-display.js'),import('./vendor/media-chrome/media-mute-button.js'),import('./vendor/media-chrome/media-volume-range.js'),
   import('./vendor/media-chrome/media-pip-button.js'),import('./vendor/media-chrome/media-fullscreen-button.js')
  ]);
 })();return chromeReady;
}
async function enhanceFilm(section){
 const video=section.querySelector('video'),controller=section.querySelector('[data-film-controller]'),controls=section.querySelector('[data-film-controls]'),start=section.querySelector('[data-film-start]'),feedback=section.querySelector('[data-film-feedback]'),message=section.querySelector('[data-film-message]');
 const lang=translations[section.dataset.filmLanguage]?section.dataset.filmLanguage:'fr',t=translations[lang];let played=false;
 controller.setAttribute('gesturesdisabled','');
 const fail=text=>{message.textContent=text;feedback.hidden=false;};
 const clear=()=>{feedback.hidden=true;};
 video.addEventListener('error',()=>fail(t.unavailable));video.addEventListener('loadeddata',clear);
 section.querySelector('[data-film-retry]').addEventListener('click',()=>{clear();video.load();start.hidden=false;});
 if(video.error)fail(t.unavailable);
 try{
  await loadChrome(lang);
  if(!section.isConnected)return;
  controls.hidden=false;controller.classList.add('is-enhanced');video.controls=false;controller.removeAttribute('gesturesdisabled');start.hidden=!video.paused;
  const sync=()=>{start.hidden=played&&!video.ended;};
  video.addEventListener('playing',()=>{const fromStart=document.activeElement===start;played=true;clear();sync();if(fromStart)controls.querySelector('media-play-button')?.focus({preventScroll:true});});video.addEventListener('ended',sync);
  start.addEventListener('click',()=>{clear();video.play().catch(()=>fail(t.playFailed));});
 }catch{
  // HTML video controls remain a complete, keyboard-accessible fallback.
  video.controls=true;controls.hidden=true;start.hidden=true;controller.classList.remove('is-enhanced');controller.setAttribute('gesturesdisabled','');
 }
}
document.querySelectorAll('[data-film-section]').forEach(section=>{enhanceFilm(section);});
