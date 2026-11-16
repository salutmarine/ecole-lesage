(() => {
 const lang=location.pathname.split('/')[1]||'en',fr=lang==='fr',ja=lang==='ja';
 function init(){
  if(location.hash==='#appointment')document.querySelector('#open-rv,#mini-rv')?.click();
  // Local cookie preferences replace the production consent and analytics SDK.
  if(!localStorage.getItem('lesage-cookie-preferences')){
   const overlay=document.createElement('div');overlay.className='replica-cookie-overlay';
   const box=document.createElement('section');box.className='replica-cookie';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',fr?'Cookies sur ecolelesage.com':ja?'クッキーの設定':'Cookies on ecolelesage.com');
   box.innerHTML=`<h2>${fr?'COOKIES SUR ECOLELESAGE.COM':ja?'ECOLELESAGE.COM のクッキー':'COOKIES ON ECOLELESAGE.COM'}</h2><p>${fr?'École Lesage utilise des cookies pour personnaliser le contenu et vous proposer une expérience adaptée. Vous pouvez gérer vos préférences et en savoir plus en cliquant sur « Paramètres des cookies » et à tout moment dans la':ja?'École Lesage はクッキーを使用します。設定からクッキーの使用を管理できます。':'Ecole Lesage uses cookies to personalise content and offer you a tailored experience. You can manage your preferences and learn more by clicking on ‘Cookie settings’ and at any time in the'} <a href="/${lang}/${fr?'politique-de-confidentialite':ja?'個人情報の取り扱いについて':'privacy-policy'}/">${fr?'Politique de confidentialité':ja?'プライバシーポリシー':'Privacy policy'}</a>.</p><div class="buttons"><button data-choice="necessary">${fr?'ACCEPTER LES COOKIES NÉCESSAIRES':ja?'必要なクッキーのみ許可':'ACCEPT NECESSARY COOKIES'}</button><button data-choice="all">${fr?'TOUT ACCEPTER':ja?'すべて許可':'ACCEPT ALL'}</button></div><button class="settings">${fr?'Paramètres des cookies':ja?'クッキーの設定':'Cookies Settings'}</button>`;
   document.body.append(overlay,box);
   box.addEventListener('click',e=>{const choice=e.target.closest('[data-choice]');if(choice){localStorage.setItem('lesage-cookie-preferences',choice.dataset.choice);overlay.remove();box.remove();}if(e.target.closest('.settings')&&!box.querySelector('.settings-panel')){const panel=document.createElement('div');panel.className='settings-panel';panel.innerHTML=`<label><input type="checkbox" checked disabled>${fr?'Cookies strictement nécessaires':ja?'必須クッキー':'Strictly necessary cookies'}</label><label><input type="checkbox">${fr?'Cookies de mesure d’audience':ja?'分析クッキー':'Analytics cookies'}</label><button data-choice="custom">${fr?'Enregistrer mes préférences':ja?'設定を保存':'Save my preferences'}</button>`;box.append(panel);}});
  }
  // Escape closes the site's original Bootstrap modals and glossary overlays.
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){window.jQuery?.('.modal.show').modal('hide');document.querySelectorAll('.filter-container').forEach(x=>x.remove());document.querySelectorAll('.blur-bground').forEach(x=>x.classList.remove('blur-bground'));}});
 }
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
