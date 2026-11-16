// Explicit page surfaces keep the navigation legible without sampling image pixels.
const mounted=new WeakMap();
const heightProperty='--home-header-height';

export function headerTheme(surfaces,headerHeight,previous='photo'){
  const height=Math.max(0,Number(headerHeight)||0);
  const covers=(rect,theme)=>{
    const margin=previous===theme?0:4;
    const topLimit=theme==='photo'?0:-margin;
    return rect&&Number.isFinite(rect.top)&&Number.isFinite(rect.bottom)&&rect.top<=topLimit&&rect.bottom>=height+margin;
  };
  if(covers(surfaces.hero,'photo'))return 'photo';
  if((surfaces.dark||[]).some(rect=>covers(rect,'dark')))return 'dark';
  return 'light';
}

export function setupHomeHeader(root=typeof document==='undefined'?null:document.querySelector('.home-page')){
  if(!root)return ()=>{};
  if(mounted.has(root))return mounted.get(root);
  const doc=root.ownerDocument,view=doc?.defaultView,body=doc?.body,html=doc?.documentElement;
  const header=doc?.querySelector?.('.lesage-header'),hero=root.querySelector?.('.home-hero');
  if(!view||!body||!html||!header||!hero)return ()=>{};
  const darkSurfaces=[...root.querySelectorAll('.home-seminars,.home-school')];
  const previousTheme=header.getAttribute('data-home-header-theme');
  const previousClass=body.classList.contains('home-immersive-header');
  const originalStyles=[body,html].map(element=>({element,value:element.style.getPropertyValue(heightProperty),priority:element.style.getPropertyPriority(heightProperty)}));
  let theme=previousTheme||'photo',frame=0,destroyed=false,suspended=false,observing=false,resizeObserver;

  function draw(){
    frame=0;
    if(destroyed||suspended||doc.hidden)return;
    const height=Math.ceil(header.getBoundingClientRect().height);
    const next=headerTheme({hero:hero.getBoundingClientRect(),dark:darkSurfaces.map(element=>element.getBoundingClientRect())},height,theme);
    // Both values are needed: body inherits them into the hero, html uses them for scroll padding.
    for(const {element}of originalStyles)if(element.style.getPropertyValue(heightProperty)!==`${height}px`)element.style.setProperty(heightProperty,`${height}px`);
    if(next!==theme||!header.hasAttribute('data-home-header-theme')){theme=next;header.setAttribute('data-home-header-theme',next);}
  }
  function schedule(){
    if(destroyed||suspended||doc.hidden||frame)return;
    frame=view.requestAnimationFrame?.(draw)||0;
    if(!view.requestAnimationFrame)draw();
  }
  function stop(){
    if(frame){view.cancelAnimationFrame?.(frame);frame=0;}
    if(!observing)return;
    observing=false;view.removeEventListener('scroll',schedule);view.removeEventListener('resize',schedule);resizeObserver?.disconnect();
  }
  function start(){
    if(destroyed||suspended||doc.hidden||observing)return;
    observing=true;view.addEventListener('scroll',schedule,{passive:true});view.addEventListener('resize',schedule);
    resizeObserver?.observe(header);resizeObserver?.observe(root);draw();
  }
  function visibilityChanged(){if(doc.hidden)stop();else start();}
  function pageHidden(event){if(event.persisted){suspended=true;stop();}else cleanup();}
  function pageShown(event){if(event.persisted){suspended=false;start();}}
  function cleanup(){
    if(destroyed)return;
    destroyed=true;stop();doc.removeEventListener('visibilitychange',visibilityChanged);view.removeEventListener('pagehide',pageHidden);view.removeEventListener('pageshow',pageShown);
    body.classList.toggle('home-immersive-header',previousClass);
    if(previousTheme===null)header.removeAttribute('data-home-header-theme');else header.setAttribute('data-home-header-theme',previousTheme);
    for(const {element,value,priority}of originalStyles){if(value)element.style.setProperty(heightProperty,value,priority);else element.style.removeProperty(heightProperty);}
    mounted.delete(root);
  }
  if(typeof view.ResizeObserver==='function')resizeObserver=new view.ResizeObserver(schedule);
  body.classList.add('home-immersive-header');
  doc.addEventListener('visibilitychange',visibilityChanged);view.addEventListener('pagehide',pageHidden);view.addEventListener('pageshow',pageShown);
  mounted.set(root,cleanup);start();return cleanup;
}
