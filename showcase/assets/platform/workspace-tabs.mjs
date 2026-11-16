const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={
 fr:{navigation:'Votre espace',courses:'Mes cours',agenda:'Mes rendez-vous',staffAgenda:'Agenda',students:'Élèves',today:'Aujourd’hui',organisation:'Organisation',journal:'Journal',rules:'Règles',emails:'Messages',integrations:'Achats',profile:'Mon profil'},
 en:{navigation:'Your space',courses:'My courses',agenda:'My bookings',staffAgenda:'Calendar',students:'Students',today:'Today',organisation:'Organisation',journal:'Change log',rules:'Rules',emails:'Messages',integrations:'Purchases',profile:'My profile'},
 ja:{navigation:'マイスペース',courses:'マイコース',agenda:'予約一覧',staffAgenda:'カレンダー',students:'受講生',today:'今日',organisation:'運営',journal:'変更履歴',rules:'ルール',emails:'メッセージ',integrations:'購入',profile:'プロフィール'}
};
export function renderWorkspaceTabs(lang='fr',view='courses',role='student'){
 const t=labels[lang]||labels.fr,active=role==='student'&&view==='agenda'?'bookings':['student','followup'].includes(view)?'students':view;
 const items=role==='admin'?['today','agenda','students','organisation','journal','rules','emails','integrations','profile']:role==='teacher'?['agenda','students','profile']:['courses','bookings','profile'];
 return `<nav class="ws-subnav bo-nav lesage-tabs" data-tab-group="${escape(role)}" aria-label="${escape(t.navigation)}"><div class="ls-tabs-viewport"><div class="ls-tabs-track"><span class="ls-tabs-hover" aria-hidden="true"></span><span class="ls-tabs-indicator" aria-hidden="true"></span>${items.map(key=>`<button type="button" data-action="workspace-view" data-view="${key}" ${active===key?'aria-current="page"':''}>${escape(key==='bookings'?t.agenda:key==='agenda'&&role!=='student'?t.staffAgenda:t[key])}</button>`).join('')}</div></div></nav>`;
}

const installations=new WeakMap();
export function setupWorkspaceTabs(doc=globalThis.document){
 if(!doc?.body)return()=>{};
 if(installations.has(doc))return installations.get(doc);
 const win=doc.defaultView,states=new Map(),previous=new Map();
 let frame=0,destroyed=false;
 const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)');
 function bounds(element,track){const box=element.getBoundingClientRect(),parent=track.getBoundingClientRect();return {left:box.left-parent.left,width:box.width};}
 function position(element,value){element.style.left=`${value.left}px`;element.style.width=`${value.width}px`;}
 function selected(state){return state.nav.querySelector('button[aria-current="page"]');}
 function draw(){
  frame=0;if(destroyed)return;
  for(const [nav,state]of states)if(!nav.isConnected){resize?.unobserve(nav);states.delete(nav);}
  for(const nav of doc.querySelectorAll('.lesage-tabs')){
   let state=states.get(nav);
   if(!state){
    const track=nav.querySelector('.ls-tabs-track'),indicator=nav.querySelector('.ls-tabs-indicator'),hover=nav.querySelector('.ls-tabs-hover');
    if(!track||!indicator||!hover)continue;
    state={nav,track,indicator,hover,viewport:nav.querySelector('.ls-tabs-viewport'),reveal:true};states.set(nav,state);resize?.observe(nav);
    const before=previous.get(nav.dataset.tabGroup),active=selected(state);
    if(active){position(indicator,before&&!reduced?.matches?before:bounds(active,track));}
    nav.classList.add('ls-tabs-ready');
    // Give the newly mounted navigation an initial frame before moving its underline.
    schedule();continue;
   }
   const active=selected(state);
   state.indicator.hidden=!active;
   if(active){const value=bounds(active,state.track);position(state.indicator,value);previous.set(nav.dataset.tabGroup,value);if(state.reveal&&state.viewport){const left=state.viewport.scrollLeft,right=left+state.viewport.clientWidth;if(value.left<left)state.viewport.scrollLeft=value.left;else if(value.left+value.width>right)state.viewport.scrollLeft=value.left+value.width-state.viewport.clientWidth;}state.reveal=false;}
  }
 }
 function schedule(){if(!destroyed&&!frame)frame=win.requestAnimationFrame(draw);}
 function hover(event){
  const button=event.target.closest?.('.lesage-tabs button[data-view]');if(!button)return;
  const state=states.get(button.closest('.lesage-tabs'));if(!state)return;
  position(state.hover,bounds(button,state.track));state.hover.style.opacity='1';
 }
 function leave(event){
  const nav=event.target.closest?.('.lesage-tabs');if(!nav||nav.contains(event.relatedTarget))return;
  const state=states.get(nav);if(state)state.hover.style.opacity='0';
 }
 function keyboard(event){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const button=event.target.closest?.('.lesage-tabs button[data-view]');if(!button)return;
  const nav=button.closest('.lesage-tabs'),buttons=[...nav.querySelectorAll('button[data-view]')];
  const index=buttons.indexOf(button),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
  event.preventDefault();buttons[next].focus({preventScroll:true});buttons[next].scrollIntoView({block:'nearest',inline:'nearest',behavior:reduced?.matches?'instant':'smooth'});
 }
 function resized(){for(const state of states.values())state.reveal=true;schedule();}
 const resize=win.ResizeObserver?new win.ResizeObserver(entries=>{for(const entry of entries){const state=states.get(entry.target);if(state)state.reveal=true;}schedule();}):null;
 const observer=new win.MutationObserver(schedule);observer.observe(doc.body,{childList:true,subtree:true});
 doc.addEventListener('pointerover',hover);doc.addEventListener('pointerout',leave);doc.addEventListener('focusin',hover);doc.addEventListener('focusout',leave);doc.addEventListener('keydown',keyboard);
 win.addEventListener('resize',resized,{passive:true});doc.fonts?.ready?.then(schedule);schedule();
 const cleanup=()=>{if(destroyed)return;destroyed=true;observer.disconnect();resize?.disconnect();if(frame)win.cancelAnimationFrame(frame);doc.removeEventListener('pointerover',hover);doc.removeEventListener('pointerout',leave);doc.removeEventListener('focusin',hover);doc.removeEventListener('focusout',leave);doc.removeEventListener('keydown',keyboard);win.removeEventListener('resize',resized);installations.delete(doc);};
 installations.set(doc,cleanup);return cleanup;
}
