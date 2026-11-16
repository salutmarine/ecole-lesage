let menu;
export function dismissResponsiveNavigation(){menu?.dismiss?.();}
const copy={fr:{menu:'Menu',open:'Ouvrir le menu',close:'Fermer le menu',explore:'Explorer l’École Lesage',school:'Découvrir l’école',history:'Histoire',team:'Équipe',partners:'Partenariats',glossary:'Lexique',languages:'Langues'},en:{menu:'Menu',open:'Open menu',close:'Close menu',explore:'Explore École Lesage',school:'Discover the school',history:'History',team:'The team',partners:'Partnerships',glossary:'Glossary',languages:'Languages'},ja:{menu:'メニュー',open:'メニューを開く',close:'メニューを閉じる',explore:'エコール・ルサージュ',school:'スクールについて',history:'歴史',team:'チーム',partners:'パートナーシップ',glossary:'用語集',languages:'言語'}};
Object.assign(copy.fr,{craft:'Savoir-faire'});Object.assign(copy.en,{craft:'Craftsmanship'});Object.assign(copy.ja,{craft:'サヴォアフェール'});
export function localizeNavigation(language){
 if(!menu)return;const lang=copy[language]?language:'en',t=copy[lang];
 menu.toggle.setAttribute('aria-label',t.open);menu.toggle.querySelector('span').textContent=t.menu;menu.close.setAttribute('aria-label',t.close);menu.close.querySelector('span').textContent=t.menu;menu.dialog.setAttribute('aria-label',t.menu);menu.school.textContent=t.school;menu.languages.setAttribute('aria-label',t.languages);
 const routes={history:`/${lang}/lecole/${lang==='en'?'history':'histoire'}/`,team:`/${lang}/lecole/${lang==='en'?'team':'equipe'}/`,partners:`/${lang}/lecole/${lang==='en'?'partnerships':'partenariats'}/`,craft:`/${lang}/lecole/${lang==='en'?'craftsmanship':'savoir-faire'}/`,glossary:`/${lang}/${lang==='en'?'glossary':'lexique'}/`};
 menu.secondary.querySelectorAll('[data-menu-page]').forEach(a=>{a.textContent=t[a.dataset.menuPage];a.href=routes[a.dataset.menuPage];});
 menu.languages.querySelectorAll('[data-lang]').forEach(a=>{if(a.dataset.lang===lang)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}
export function setupResponsiveNavigation(){
 if(menu)return;const header=document.querySelector('.lesage-header'),top=header?.querySelector('.header-top'),nav=header?.querySelector('.main-navigation'),languages=header?.querySelector('.header-language');if(!top||!nav||!languages)return;
 const dialog=document.createElement('dialog');if(typeof dialog.showModal!=='function')return;
 dialog.id='site-menu';dialog.className='site-menu-dialog';
 dialog.innerHTML=`<div class="site-menu-head"><button type="button" class="site-menu-close" autofocus><span>Menu</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div><div class="site-menu-content"><div class="site-menu-primary"></div><section class="site-menu-school"><h3></h3><nav aria-labelledby="site-menu-school-label"><a data-menu-page="history"></a><a data-menu-page="team"></a><a data-menu-page="partners"></a><a data-menu-page="glossary"></a></nav></section><div class="site-menu-languages"></div><p class="site-menu-note">École Lesage · Paris</p></div>`;
 const toggle=document.createElement('button');toggle.type='button';toggle.className='site-menu-toggle';toggle.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',dialog.id);toggle.setAttribute('aria-haspopup','dialog');toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg><span>Menu</span>';
 const navAnchor=document.createComment('desktop-navigation'),languageAnchor=document.createComment('desktop-languages');nav.before(navAnchor);languages.before(languageAnchor);top.prepend(toggle);document.body.append(dialog);
 const school=dialog.querySelector('.site-menu-school h3');school.id='site-menu-school-label';
 menu={dialog,toggle,nav,languages,close:dialog.querySelector('.site-menu-close'),school,secondary:dialog.querySelector('.site-menu-school nav')};
 const craft=document.createElement('a');craft.dataset.menuPage='craft';menu.secondary.insertBefore(craft,menu.secondary.lastElementChild);
 const compact=window.matchMedia('(max-width: 1100px)');let reason='dismiss';
 function unlock(){document.documentElement.classList.remove('site-menu-open');document.body.classList.remove('site-menu-open');toggle.setAttribute('aria-expanded','false');}
 function close(why='dismiss'){reason=why;if(dialog.open)dialog.close();else unlock();}
 menu.dismiss=()=>close('navigate');
 function open(){if(!compact.matches||dialog.open)return;reason='dismiss';dialog.showModal();toggle.setAttribute('aria-expanded','true');document.documentElement.classList.add('site-menu-open');document.body.classList.add('site-menu-open');menu.close.focus({preventScroll:true});}
 function layout(){const active=document.activeElement,inside=nav.contains(active)||languages.contains(active)||dialog.contains(active)||active===toggle;
  if(compact.matches){header.classList.add('has-compact-navigation');toggle.hidden=false;dialog.querySelector('.site-menu-primary').append(nav);dialog.querySelector('.site-menu-languages').append(languages);if(inside&&!dialog.open)toggle.focus({preventScroll:true});}
  else{close('resize');navAnchor.after(nav);languageAnchor.after(languages);header.classList.remove('has-compact-navigation');toggle.hidden=true;if(inside)(nav.querySelector('[aria-current="page"]')||header.querySelector('.lesage-wordmark')).focus({preventScroll:true});}
 }
 toggle.addEventListener('click',open);menu.close.addEventListener('click',()=>close());dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const items=[...dialog.querySelectorAll('a[href],button:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.hidden),first=items[0],last=items.at(-1),active=document.activeElement;if((event.shiftKey&&(active===first||!dialog.contains(active)))||(!event.shiftKey&&(active===last||!dialog.contains(active)))){event.preventDefault();(event.shiftKey?last:first)?.focus();}});
 dialog.addEventListener('close',()=>{if(dialog.open)return;unlock();if(reason==='dismiss'&&compact.matches)toggle.focus({preventScroll:true});});
 dialog.addEventListener('click',event=>{if(event.target.closest('a[href]')&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){close('navigate');return;}if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
 window.addEventListener('popstate',()=>close('navigate'));window.addEventListener('lesage:navigate',()=>close('navigate'));
 compact.addEventListener('change',layout);layout();localizeNavigation(location.pathname.match(/^\/(fr|en|ja)(?:\/|$)/)?.[1]||'en');
}
