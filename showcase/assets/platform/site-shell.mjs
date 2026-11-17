import {portalUrl,portalCartQuantity,rewritePortalLinks,watchPortal} from './portal-entry.mjs';
import {setupResponsiveNavigation,localizeNavigation} from './navigation.mjs';
import {setupControls} from './controls.mjs';
import {setupHomeParallax} from './home-parallax.mjs';
import {setupHomeHeader} from './home-header.mjs';
import {setupHomeMotion} from './home-motion.mjs';
import {setupHomeConversion} from './home-conversion.mjs';
import {setupConversionMetrics} from './conversion-metrics.mjs';
import {setupWorkspaceTabs} from './workspace-tabs.mjs';
const language=()=>location.pathname.match(/^\/(fr|en|ja)(?:\/|$)/)?.[1]||'en';
const words={fr:{school:'L’école',courses:'Les cours',seminars:'Les séminaires',contact:'Contact',account:'Mon compte & mes réservations',workspace:'Mes cours & réservations',cart:'Panier',demo:'Démonstration — aucun paiement ni e-mail réel',profile:'Changer de profil',role:'Profil de démonstration',student:'Élève',admin:'Administrateur',teacher:'Professeur',hint:'Les profils partagent les données fictives de cette démonstration sur ce navigateur.',newsletter:'S’inscrire à la newsletter',appointment:'Prendre rendez-vous',privacy:'Confidentialité',legal:'Mentions légales',terms:'Conditions de vente',heritage:'L’art de la broderie, transmis depuis 1992.'},en:{school:'The school',courses:'The courses',seminars:'Seminars',contact:'Contact',account:'My account',workspace:'My courses & bookings',cart:'Cart',demo:'Demonstration — no real payments or emails',profile:'Change demo profile',role:'Demo profile',student:'Student',admin:'Administrator',teacher:'Teacher',hint:'These demo profiles share fictional data in this browser.',newsletter:'Subscribe to the newsletter',appointment:'Make an appointment',privacy:'Privacy policy',legal:'Legal notice',terms:'Terms of sale',heritage:'The art of embroidery, passed on since 1992.'},ja:{school:'スクール',courses:'コース',seminars:'セミナー',contact:'お問い合わせ',account:'マイアカウント',workspace:'受講コース・予約',cart:'カート',demo:'デモ — 実際の支払い・メール送信は行われません',profile:'デモプロフィール変更',role:'デモプロフィール',student:'受講生',admin:'管理者',teacher:'講師',hint:'このブラウザー内で架空のデモデータを共有します。',newsletter:'ニュースレター登録',appointment:'ご相談の予約',privacy:'プライバシーポリシー',legal:'法的通知',terms:'販売条件',heritage:'1992年から受け継がれる刺繍の芸術。'}};
export function siteRoutes(lang=language()) {return {school:lang==='en'?'/en/lecole/history/':`/${lang}/lecole/histoire/`,seminars:`/${lang}/${lang==='en'?'seminars':'seminaires'}/`,contact:`/${lang}/contact/`,legal:`/${lang}/${lang==='fr'?'mentions-legales':lang==='en'?'legal-mentions':'法的通知'}/`,privacy:`/${lang}/${lang==='fr'?'politique-de-confidentialite':lang==='en'?'privacy-policy':'個人情報の取り扱いについて'}/`,terms:`/${lang}/${lang==='fr'?'conditions-generales-de-vente':'terms'}/`};}
export function localizeSiteExtras(lang=language()){
 localizeNavigation(lang);
 const t=words[lang];document.querySelectorAll('[data-site-label]').forEach(el=>{if(t[el.dataset.siteLabel])el.textContent=t[el.dataset.siteLabel];});
 document.querySelectorAll('.site-dialogs .cross,.site-dialogs [data-dismiss="modal"]').forEach(el=>el.setAttribute('aria-label',lang==='fr'?'Fermer':lang==='ja'?'閉じる':'Close'));document.querySelector('#rendez-vous')?.setAttribute('aria-label',t.appointment);
 document.querySelectorAll('[data-static="contact"]').forEach(el=>{el.href=siteRoutes(lang).contact;el.textContent=t.contact;});
 document.querySelectorAll('.footer-legal [data-static]').forEach(el=>{if(t[el.dataset.static])el.textContent=t[el.dataset.static];});
 document.querySelector('.lesage-footer small')?.replaceChildren(t.heritage);
 document.querySelectorAll('.footer-certifications a[href*="boutique"]').forEach(el=>el.href=`/${lang}/boutique/?cours=1680`);
}
function initExtras(){
 document.addEventListener('click',event=>{const trigger=event.target.closest('[data-open-appointment]');if(trigger){event.preventDefault();document.querySelector('#open-rv')?.click();}});
 document.querySelectorAll('.mentions-header').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-expanded','false');});
 function accordion(el){const body=el.parentElement.querySelector('.mentions-text-block');if(!body)return;const open=el.getAttribute('aria-expanded')!=='true';el.setAttribute('aria-expanded',String(open));el.classList.toggle('open-header',open);body.classList.toggle('visible-text-block',open);}
 document.addEventListener('click',event=>{const target=event.target.closest('.mentions-header');if(target){event.preventDefault();accordion(target);}});
 document.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('.mentions-header')){event.preventDefault();accordion(event.target);}});
 const search=document.querySelector('[data-glossary-search]');search?.addEventListener('input',()=>{const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();const query=normalize(search.value.trim());let count=0;document.querySelectorAll('[data-glossary-entry]').forEach(el=>{el.hidden=!normalize(el.dataset.glossaryName||el.textContent).includes(query);if(!el.hidden)count++;});const counter=document.querySelector('[data-glossary-count]');if(counter)counter.textContent=count;const empty=document.querySelector('[data-glossary-empty]');if(empty)empty.hidden=count>0;});
 if(new URLSearchParams(location.search).has('appointment')){let opened=false;const show=()=>{if(opened)return;opened=true;document.querySelector('#open-rv')?.click();};window.addEventListener('lesage:forms-ready',show,{once:true});if(document.readyState==='complete')show();else window.addEventListener('load',show,{once:true});}
}
initExtras();
setupResponsiveNavigation();
setupControls();
setupHomeParallax();
setupHomeHeader();
setupHomeMotion();
setupHomeConversion();
setupConversionMetrics();
setupWorkspaceTabs();
if(document.body.classList.contains('editorial-site')){
 const lang=language(),t=words[lang],routes=siteRoutes(lang);
 function update(){
  localizeSiteExtras(lang);document.querySelectorAll('[data-label]').forEach(el=>{if(t[el.dataset.label])el.textContent=t[el.dataset.label];});
  document.querySelectorAll('[data-nav]').forEach(el=>{el.href=el.dataset.nav==='catalog'?`/${lang}/boutique/`:portalUrl(el.dataset.nav==='cart'?'cart':'',{},lang);if(el.closest('.main-navigation'))el.textContent=t[el.dataset.nav==='catalog'?'courses':'workspace'];});
  document.querySelectorAll('[data-static]').forEach(el=>{if(routes[el.dataset.static])el.href=routes[el.dataset.static];if(el.closest('.main-navigation')){el.textContent=t[el.dataset.static];if(el.dataset.static===document.body.dataset.section)el.setAttribute('aria-current','page');}});
  const count=portalCartQuantity();document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=count);document.querySelector('.bag-link')?.setAttribute('aria-label',`${t.cart} (${count})`);
  rewritePortalLinks();
 }
 watchPortal(update);update();
}

