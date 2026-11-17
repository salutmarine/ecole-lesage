import {mountShop} from './shop.mjs';
import {localizeSiteExtras,siteRoutes} from './site-shell.mjs';
import {getPublicCatalogStore,goToPortal,portalUrl,portalDestination,portalCartQuantity,rewritePortalLinks,stagePortalCart,watchPortal} from './portal-entry.mjs';
const main=document.querySelector('#platform-main'),loading=document.querySelector('#app-loading');
const lang=()=>location.pathname.match(/^\/(fr|en|ja)(?:\/|$)/)?.[1]||'fr';
const publicViews=new Set(['catalog','product']);
let store,cleanup;
const dictionary={fr:{account:'Mon compte & mes réservations',cart:'Panier',school:'L’école',courses:'Les cours',seminars:'Les séminaires',workspace:'Mes cours & réservations'},en:{account:'My account',cart:'Cart',school:'The school',courses:'The courses',seminars:'Seminars',workspace:'My courses & bookings'},ja:{account:'マイアカウント',cart:'カート',school:'スクール',courses:'コース',seminars:'セミナー',workspace:'受講コース・予約'}};
function urlFor(view,params={},language=lang()){
 if(view==='shop')view='catalog';
 if(!publicViews.has(view))return portalUrl(view,params,language);
 const query=new URLSearchParams();
 if(view==='product'&&params.productKey)query.set('cours',params.productKey);
 if(params.category&&params.category!=='all')query.set('category',params.category);
 for(const [key,defaultValue] of [['query',''],['duration','all'],['sort','recommended']])if(params[key]&&params[key]!==defaultValue)query.set(key,params[key]);
 if(params.gift)query.set('gift','1');
 return `/${language}/boutique/${query.size?'?'+query:''}`;
}
function current(){
 const query=new URLSearchParams(location.search);let path;try{path=decodeURIComponent(location.pathname);}catch{path=location.pathname;}
 let view;
 if(/\/(boutique|shop)\/?$/.test(path))view=query.has('cours')?'product':'catalog';
 else if(/\/(panier|cart|カート)\/?$/.test(path))view=query.has('checkout')?'checkout':'cart';
 else if(/\/(commande|checkout|チェックアウト)\/?$/.test(path))view='checkout';
 else view=query.get('view')||'';
 return {lang:lang(),view,gift:query.get('gift')==='1',productKey:query.get('cours'),category:query.get('category')??undefined,query:query.get('query')??undefined,duration:query.get('duration')??undefined,sort:query.get('sort')??undefined,returnView:query.get('returnView')||undefined};
}
function header(){
 const language=lang(),t=dictionary[language],view=current().view;document.documentElement.lang=language;
 localizeSiteExtras(language);
 document.querySelectorAll('[data-label]').forEach(el=>{if(t[el.dataset.label])el.textContent=t[el.dataset.label];});
 const labels={school:t.school,catalog:t.courses,seminars:t.seminars,courses:t.workspace};
 document.querySelectorAll('.main-navigation [data-nav],.main-navigation [data-static]').forEach(el=>{const label=labels[el.dataset.nav||el.dataset.static];if(label)el.textContent=label;});
 document.querySelectorAll('[data-nav]').forEach(anchor=>{
  const kind=anchor.dataset.nav;anchor.href=kind==='catalog'?urlFor('catalog'):portalUrl(kind==='cart'?'cart':'');
  if(kind==='catalog'&&publicViews.has(view))anchor.setAttribute('aria-current','page');else anchor.removeAttribute('aria-current');
 });
 document.querySelectorAll('[data-lang]').forEach(anchor=>{anchor.href=urlFor(view,current(),anchor.dataset.lang);if(anchor.dataset.lang===language)anchor.setAttribute('aria-current','page');else anchor.removeAttribute('aria-current');});
 document.querySelectorAll('[data-static]').forEach(anchor=>{const route=siteRoutes(language)[anchor.dataset.static];if(route)anchor.href=route;});
 for(const selector of ['.lesage-wordmark','.footer-brand']){const anchor=document.querySelector(selector);if(anchor)anchor.href=`/${language}/`;}
 const count=portalCartQuantity();document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=count);document.querySelector('.bag-link')?.setAttribute('aria-label',`${t.cart} (${count})`);
 rewritePortalLinks();
}
function render({focus=false}={}){
 const options=current();
 if(!publicViews.has(options.view)){goToPortal(options.view,options,options.lang,true);return;}
 const releaseLoading=window.LesageLoading?.begin();cleanup?.();cleanup=null;header();
 try{
  cleanup=mountShop(main,store,options);loading.hidden=true;
  document.title=`${options.view==='product'?(store.product(options.productKey)?.variants[options.lang]?.name||dictionary[options.lang].courses):dictionary[options.lang].courses} — École Lesage`;
  if(focus){window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});}
 }catch(error){showError(error);}
 finally{releaseLoading?.();window.LesageLoading?.ready();}
}
function showError(error){
 console.error(error);loading.hidden=true;
 const existing=main.querySelector('[data-shop-error]');
 if(existing){existing.textContent=error.message;existing.hidden=false;existing.scrollIntoView({block:'nearest',behavior:'smooth'});return;}
 main.replaceChildren();const box=document.createElement('div');box.className='platform-error';const title=document.createElement('h1');title.textContent='Le catalogue est momentanément indisponible';const text=document.createElement('p');text.textContent=error.message;const link=document.createElement('a');link.href=`/${lang()}/`;link.textContent='Revenir à l’accueil';box.append(title,text,link);main.append(box);
}
// Handoff before any legacy shop handler can modify its separate demo ledger.
document.addEventListener('click',event=>{
 const element=event.target instanceof Element?event.target:null;
 if(!element||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const action=element.closest('[data-shop-action="add"],[data-shop-action="add-detail"],[data-shop-action="gift-detail"]');
 if(action&&main.contains(action)){
  event.preventDefault();event.stopImmediatePropagation();
  try{
   const product=store?.product(action.dataset.productKey);if(!product)throw new Error('Ce cours n’est plus disponible.');
   const qty=action.dataset.shopAction==='add'?1:main.querySelector('[data-shop-product-quantity]')?.value||1;
   stagePortalCart(String(product.key),qty);
   window.dispatchEvent(new CustomEvent('lesage:conversion',{detail:{name:'add_to_cart',productKey:product.key,quantity:Math.max(1,Math.min(3,Math.round(Number(qty)||1)))}}));
   goToPortal(action.dataset.shopAction==='gift-detail'?'checkout':'cart',{gift:action.dataset.shopAction==='gift-detail'||current().gift});
  }catch(error){showError(error);}
  return;
 }
 const anchor=element.closest('a[href]'),destination=anchor&&portalDestination(anchor.href);
 if(destination){event.preventDefault();event.stopImmediatePropagation();location.assign(destination);return;}
 const target=element.closest('[data-nav],[data-lang]');
 if(target){event.preventDefault();history.pushState(null,'',target.href);render({focus:true});}
},true);
window.addEventListener('lesage:navigate',event=>{
 const {view,params={}}=event.detail||{};
 if(!publicViews.has(view)&&view!=='shop'){goToPortal(view,params);return;}
 history.pushState(null,'',urlFor(view,params));render({focus:true});
});
window.addEventListener('popstate',()=>{if(store)render({focus:true});});
window.addEventListener('lesage:shop-filters',()=>header());
watchPortal(()=>{if(store)header();});
const initial=current();
if(!publicViews.has(initial.view))goToPortal(initial.view,initial,initial.lang,true);
else try{store=await getPublicCatalogStore();window.LesagePlatform={store,navigate:(view,params)=>store.navigate(view,params),urlFor};render();}
catch(error){showError(error);window.LesageLoading?.ready();}
