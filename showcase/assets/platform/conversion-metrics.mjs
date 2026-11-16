/* An anonymous, browser-local aid for testing the demonstration purchase journey. */
export const CONVERSION_METRICS_KEY='lesage.conversion.tests.v1';
const SESSION_KEY='lesage.conversion.session.v1';
export const CONVERSION_STAGES=['landing','catalog','product','add_to_cart','begin_checkout','purchase'];
const ACTIONS=['hero_courses','finder_open','finder_complete','finder_course','featured_course','gift','advice'];
const EVENTS=new Set([...CONVERSION_STAGES,...ACTIONS]);
const MAX_SESSIONS=100,MAX_AGE=90*86400000;
const mounts=new WeakMap();
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localStore=()=>{try{return globalThis.localStorage;}catch{return null;}};
const empty=()=>({version:1,sessions:[],purchases:[]});
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(value);

export function normalizeConversionMetrics(value,now=Date.now()){
 if(value?.version!==1)return empty();
 const sessions=(Array.isArray(value.sessions)?value.sessions:[]).filter(s=>validId(s?.id)&&Number.isFinite(s.at)&&s.at>=now-MAX_AGE&&s.at<=now+60000&&['mobile','desktop'].includes(s.device)).map(s=>({id:s.id,at:s.at,device:s.device,stages:Object.fromEntries([...EVENTS].filter(key=>s.stages?.[key]===true).map(key=>[key,true]))})).filter(s=>Object.keys(s.stages).length).sort((a,b)=>a.at-b.at).slice(-MAX_SESSIONS);
 const purchases=[...new Set((Array.isArray(value.purchases)?value.purchases:[]).filter(token=>typeof token==='string'&&/^[a-z0-9]{1,16}$/.test(token)))].slice(-200);
 return {version:1,sessions,purchases};
}
function purchaseToken(value){
 if(typeof value!=='string'||!value.trim()||value.length>500)return null;
 // Only a one-way fingerprint is retained; no order number or other event detail is stored.
 let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
 return (hash>>>0).toString(36);
}
export function recordConversionMetric(value,event,{sessionId,device='desktop',now=Date.now()}={}){
 const state=normalizeConversionMetrics(value,now);
 if(!EVENTS.has(event?.name)||!validId(sessionId))return state;
 if(event.name==='purchase'){
  const token=purchaseToken(event.orderId);if(!token||state.purchases.includes(token))return state;
  state.purchases.push(token);state.purchases=state.purchases.slice(-200);
 }
 let session=state.sessions.find(item=>item.id===sessionId);
 if(!session){session={id:sessionId,at:now,device:device==='mobile'?'mobile':'desktop',stages:{}};state.sessions.push(session);state.sessions=state.sessions.slice(-MAX_SESSIONS);}
 session.stages[event.name]=true;
 return state;
}
export function readConversionMetrics(storage=localStore(),now=Date.now()){
 try{return normalizeConversionMetrics(JSON.parse(storage?.getItem(CONVERSION_METRICS_KEY)||'null'),now);}catch{return empty();}
}
export function summarizeConversionMetrics(value,now=Date.now()){
 const state=normalizeConversionMetrics(value,now),totals={};
 for(const name of EVENTS)totals[name]={all:0,mobile:0,desktop:0};
 for(const session of state.sessions)for(const name of EVENTS)if(session.stages[name]){totals[name].all++;totals[name][session.device]++;}
 return {sessions:state.sessions.length,totals};
}
const copy={
 fr:{eyebrow:'Recette du parcours d’achat',title:'Parcours testés sur ce navigateur',intro:'Démonstration locale · jusqu’à 100 parcours conservés pendant 90 jours. Ces chiffres ne représentent pas les visiteurs du site partagé.',table:'Étapes atteintes pendant les tests',stage:'Étape',all:'Parcours',mobile:'Mobile',desktop:'Ordinateur',stages:['Accueil','Catalogue','Fiche cours','Ajout au panier','Commande commencée','Achat simulé confirmé'],help:'Chaque colonne compte les parcours de test ayant atteint l’étape, une fois par onglet. Les étapes peuvent être consultées dans un ordre différent ; aucun taux de conversion n’est calculé.',empty:'Aucun parcours commercial testé ici pour le moment.',finder:'Guide terminé',gift:'Option cadeau',advice:'Accès au conseil',reset:'Effacer ces statistiques',confirm:'Confirmer l’effacement',resetHelp:'Les statistiques de test de ce navigateur seront effacées.',cleared:'Statistiques de test effacées.',unavailable:'Le navigateur ne peut pas enregistrer ces statistiques. Elles restent disponibles pour cette page.'},
 en:{eyebrow:'Purchase journey testing',title:'Journeys tested in this browser',intro:'Local demonstration · up to 100 journeys kept for 90 days. These figures do not represent visitors to the shared website.',table:'Stages reached during tests',stage:'Stage',all:'Journeys',mobile:'Mobile',desktop:'Desktop',stages:['Home','Catalogue','Course page','Added to basket','Checkout started','Simulated purchase confirmed'],help:'Each column counts test journeys reaching the stage, once per tab. Stages can be visited in a different order; no conversion rate is calculated.',empty:'No shopping journey has been tested here yet.',finder:'Guide completed',gift:'Gift option',advice:'Advice opened',reset:'Clear these statistics',confirm:'Confirm clearing',resetHelp:'The test statistics in this browser will be cleared.',cleared:'Test statistics cleared.',unavailable:'This browser cannot save these statistics. They remain available for this page.'},
 ja:{eyebrow:'購入フローのテスト',title:'このブラウザーで試した購入フロー',intro:'ローカルデモ · 最大100件を90日間保存します。共有サイトの訪問者数を示すものではありません。',table:'テストで到達した段階',stage:'段階',all:'テスト数',mobile:'モバイル',desktop:'パソコン',stages:['ホーム','カタログ','コース詳細','カートに追加','注文開始','模擬購入完了'],help:'各列は、その段階に到達したテストをタブごとに1回数えます。段階の順序は異なる場合があるため、コンバージョン率は計算しません。',empty:'このブラウザーでは、まだ購入フローを試していません。',finder:'ガイド完了',gift:'ギフトの選択',advice:'相談を開く',reset:'統計を消去',confirm:'消去を確定',resetHelp:'このブラウザーのテスト統計を消去します。',cleared:'テスト統計を消去しました。',unavailable:'このブラウザーでは統計を保存できません。このページ内でのみ利用できます。'}
};
export function renderConversionMetrics(lang='fr',value=readConversionMetrics(),{message=''}={}){
 if(!copy[lang])lang='fr';const t=copy[lang],summary=summarizeConversionMetrics(value);
 return `<section class="bo-panel conversion-metrics" data-conversion-panel data-conversion-lang="${lang}" aria-labelledby="conversion-metrics-title"><header><p class="ws-eyebrow">${esc(t.eyebrow)}</p><h2 id="conversion-metrics-title">${esc(t.title)}</h2><p>${esc(t.intro)}</p></header>${summary.sessions?`<div class="conversion-metrics-scroll" tabindex="0" role="region" aria-label="${esc(t.table)}"><table><caption>${esc(t.table)}</caption><thead><tr><th scope="col">${esc(t.stage)}</th><th scope="col">${esc(t.all)}</th><th scope="col">${esc(t.mobile)}</th><th scope="col">${esc(t.desktop)}</th></tr></thead><tbody>${CONVERSION_STAGES.map((name,index)=>`<tr><th scope="row">${esc(t.stages[index])}</th><td>${summary.totals[name].all}</td><td>${summary.totals[name].mobile}</td><td>${summary.totals[name].desktop}</td></tr>`).join('')}</tbody></table></div><p class="conversion-metrics-help">${esc(t.help)}</p><dl class="conversion-metrics-actions">${[['finder_complete','finder'],['gift','gift'],['advice','advice']].map(([event,label])=>`<div><dt>${esc(t[label])}</dt><dd>${summary.totals[event].all}</dd></div>`).join('')}</dl><details class="conversion-metrics-reset"><summary>${esc(t.reset)}</summary><p>${esc(t.resetHelp)}</p><button type="button" class="ws-button ws-button--secondary" data-conversion-reset>${esc(t.confirm)}</button></details>`:`<p class="bo-empty">${esc(t.empty)}</p>`}<p class="conversion-metrics-status" role="status">${esc(message)}</p></section>`;
}
export function conversionRoute(location){
 const path=location?.pathname||'',query=new URLSearchParams(location?.search||'');
 if(/^\/(?:fr|en|ja)\/?$/.test(path)||path==='/')return 'landing';
 if(/^\/(?:fr|en|ja)\/(?:boutique|shop)\/?$/.test(path))return query.has('cours')?'product':'catalog';
 return null;
}
export function setupConversionMetrics({document:doc=globalThis.document,window:view=globalThis.window,storage=localStore(),sessionStorage:sessionStore,now=()=>Date.now()}={}){
 if(!doc||!view)return()=>{};if(mounts.has(doc))return mounts.get(doc);
 if(sessionStore===undefined)try{sessionStore=view.sessionStorage;}catch{}
 let sessionId;try{sessionId=sessionStore?.getItem(SESSION_KEY);}catch{}
 if(!validId(sessionId)){sessionId=view.crypto?.randomUUID?.()||`test_${now()}_${Math.random().toString(36).slice(2)}`;try{sessionStore?.setItem(SESSION_KEY,sessionId);}catch{}}
 const device=view.matchMedia?.('(max-width: 800px)').matches?'mobile':'desktop';let state=readConversionMetrics(storage,now()),disposed=false,storageError=false;
 const panels=()=>[...doc.querySelectorAll('[data-conversion-panel]')];
 function refresh(message=''){for(const panel of panels()){const lang=copy[panel.dataset.conversionLang]?panel.dataset.conversionLang:'fr';panel.outerHTML=renderConversionMetrics(lang,state,{message:message||(storageError?copy[lang].unavailable:'')});}}
 function save(){try{if(!storage)throw Error('Unavailable');storage.setItem(CONVERSION_METRICS_KEY,JSON.stringify(state));storageError=false;}catch{storageError=true;}}
 function record(detail){if(disposed)return;const saved=storage&&!storageError?readConversionMetrics(storage,now()):state;state=recordConversionMetric(saved,detail,{sessionId,device,now:now()});save();refresh();}
 function route(){const name=conversionRoute(view.location);if(name)record({name});}
 function deferredRoute(){(view.queueMicrotask||globalThis.queueMicrotask)(()=>{if(!disposed)route();});}
 function onEvent(event){if(EVENTS.has(event.detail?.name))record(event.detail);}
 function onClick(event){const reset=event.target.closest?.('[data-conversion-reset]');if(reset){const panel=reset.closest('[data-conversion-panel]');if(!panel)return;event.preventDefault();const lang=copy[panel.dataset.conversionLang]?panel.dataset.conversionLang:'fr';state=empty();save();refresh(copy[lang].cleared);return;}if(event.button>0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;if(event.target.closest?.('[data-nav],[data-lang]'))deferredRoute();const target=event.target.closest?.('[data-conversion]');if(!target)return;const name=target.dataset.conversion;if(EVENTS.has(name))record({name});}
 function onStorage(event){if(event.key!==CONVERSION_METRICS_KEY)return;state=readConversionMetrics(storage,now());refresh();}
 doc.addEventListener('click',onClick);view.addEventListener('lesage:conversion',onEvent);view.addEventListener('lesage:navigate',deferredRoute);view.addEventListener('popstate',deferredRoute);view.addEventListener('pageshow',deferredRoute);view.addEventListener('storage',onStorage);
 const cleanup=()=>{disposed=true;doc.removeEventListener('click',onClick);view.removeEventListener('lesage:conversion',onEvent);view.removeEventListener('lesage:navigate',deferredRoute);view.removeEventListener('popstate',deferredRoute);view.removeEventListener('pageshow',deferredRoute);view.removeEventListener('storage',onStorage);mounts.delete(doc);};mounts.set(doc,cleanup);route();return cleanup;
}
