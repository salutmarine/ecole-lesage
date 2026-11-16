// Once-only motion progressively enhances visible content; no pending CSS hides it.
const mounts=new WeakMap();
const stateAttribute='data-home-motion-state';
const easing='cubic-bezier(.22,.61,.36,1)';

export function setupHomeMotion(root=typeof document==='undefined'?null:document.querySelector('.home-page')){
  if(!root)return()=>{};
  if(mounts.has(root))return mounts.get(root);
  const doc=root.ownerDocument,view=doc?.defaultView;
  if(!view)return()=>{};
  const lines=[...root.querySelectorAll('[data-home-title-line]')];
  const targets=[...root.querySelectorAll('[data-home-motion="card"],[data-home-motion="thread"]')];
  const previous=new Map([...lines,...targets].map(element=>[element,element.getAttribute(stateAttribute)]));
  const pending=new Set(targets),animations=new Set(),byElement=new Map();
  const motion=view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let observer,brandObserver,brandTimer,heroDone=false,destroyed=false;
  const narrow=()=>view.innerWidth<=650;
  const mark=element=>element.setAttribute(stateAttribute,'shown');

  function stopAnimation(record){
    if(!animations.delete(record))return;
    view.clearTimeout(record.timer);
    byElement.delete(record.element);
    try{record.animation.cancel();}catch{}
  }
  function finishAnimations(){for(const record of [...animations])stopAnimation(record);}
  function animate(element,frames,options){
    if(destroyed||doc.hidden||motion?.matches||typeof element.animate!=='function')return;
    try{
      const animation=element.animate(frames,{easing,fill:'backwards',...options});
      const record={element,animation,timer:null};
      animations.add(record);byElement.set(element,record);
      record.timer=view.setTimeout(()=>stopAnimation(record),options.duration+(options.delay||0)+160);
      animation.finished?.then(()=>stopAnimation(record),()=>stopAnimation(record));
    }catch{ /* Static content remains visible if motion is unavailable. */ }
  }
  function stopBrandWatch(){brandObserver?.disconnect();view.clearTimeout(brandTimer);brandTimer=null;}
  function settleHero(){heroDone=true;stopBrandWatch();lines.forEach(mark);}
  function revealTarget(element,{instant=false}={}){
    if(!instant&&doc.documentElement.hasAttribute('data-brand-state'))return;
    if(!pending.delete(element)){
      if(instant){const target=element.dataset.homeMotion==='thread'?element.querySelector('path'):element;const record=byElement.get(target);if(record)stopAnimation(record);}
      return;
    }
    observer?.unobserve(element);mark(element);
    if(instant||motion?.matches||doc.hidden)return;
    if(element.dataset.homeMotion==='thread'){
      const path=element.querySelector('path');
      if(path)animate(path,[{strokeDashoffset:'1'},{strokeDashoffset:'0'}],{duration:narrow()?600:850});
    }else{
      const order=Math.max(0,Math.min(2,Number(element.dataset.homeMotionOrder)||0));
      animate(element,[{opacity:0,transform:`translateY(${narrow()?8:12}px)`},{opacity:1,transform:'translateY(0)'}],{duration:narrow()?360:500,delay:narrow()?0:order*70});
    }
  }
  function settleAll(){
    settleHero();observer?.disconnect();
    for(const element of [...pending])revealTarget(element,{instant:true});
    finishAnimations();
  }
  function revealVisible(){
    if(doc.hidden||destroyed)return;
    const height=view.innerHeight||doc.documentElement.clientHeight;
    for(const element of [...pending]){const box=element.getBoundingClientRect();if(box.height>0&&box.bottom>0&&box.top<height+24)revealTarget(element);}
  }
  function revealHero(){
    if(heroDone||destroyed||doc.hidden)return;
    if(doc.documentElement.hasAttribute('data-brand-state'))return;
    settleHero();
    if(motion?.matches)return;
    revealVisible();
    const hero=root.querySelector('.home-hero'),box=hero?.getBoundingClientRect();
    if(box&&(box.bottom<=0||box.top>=(view.innerHeight||doc.documentElement.clientHeight)))return;
    lines.forEach((element,index)=>animate(element,[{opacity:0,transform:`translateY(${narrow()?8:12}px)`},{opacity:1,transform:'translateY(0)'}],{duration:narrow()?360:500,delay:index*(narrow()?50:80)}));
  }
  function visibilityChanged(){if(doc.hidden)finishAnimations();else{revealHero();revealVisible();}}
  function preferenceChanged(){if(motion?.matches)settleAll();}
  function focusEntered(event){const card=event.target?.closest?.('[data-home-motion="card"]');if(card&&root.contains(card))revealTarget(card,{instant:true});}
  function pageHidden(event){if(event.persisted)settleAll();else cleanup();}
  function pageShown(event){if(event.persisted)settleAll();}
  function cleanup(){
    if(destroyed)return;destroyed=true;stopBrandWatch();observer?.disconnect();finishAnimations();
    motion?.removeEventListener?.('change',preferenceChanged);
    doc.removeEventListener('visibilitychange',visibilityChanged);root.removeEventListener('focusin',focusEntered);
    view.removeEventListener('pagehide',pageHidden);view.removeEventListener('pageshow',pageShown);
    for(const [element,value]of previous){if(value===null)element.removeAttribute(stateAttribute);else element.setAttribute(stateAttribute,value);}
    mounts.delete(root);
  }
  mounts.set(root,cleanup);
  motion?.addEventListener?.('change',preferenceChanged);
  doc.addEventListener('visibilitychange',visibilityChanged);root.addEventListener('focusin',focusEntered);
  view.addEventListener('pagehide',pageHidden);view.addEventListener('pageshow',pageShown);
  if(motion?.matches||typeof view.IntersectionObserver!=='function'||![...lines,...targets].some(element=>typeof element.animate==='function')){settleAll();return cleanup;}
  try{
    observer=new view.IntersectionObserver(entries=>{
      if(doc.hidden||destroyed)return;
      for(const entry of entries)if(entry.isIntersecting)revealTarget(entry.target);
    },{threshold:0,rootMargin:'0px 0px 24px 0px'});
    for(const element of targets)observer.observe(element);
    if(doc.documentElement.hasAttribute('data-brand-state')){
      if(typeof view.MutationObserver==='function'){
        brandObserver=new view.MutationObserver(revealHero);
        brandObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-brand-state']});
        // A delayed or interrupted intro must never keep title work pending forever.
        brandTimer=view.setTimeout(settleAll,2800);
      }else settleHero();
    }else revealHero();
  }catch{settleAll();}
  return cleanup;
}
