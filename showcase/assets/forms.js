/* Local interaction adapters for the editable Lesage reference copy.
 * No appointment, subscription, login or contact data is sent to the original site.
 */
(() => {
  'use strict';
  const lang = location.pathname.split('/')[1];
  const dictionary = {
    en: {
      prototype:'Prototype — no information is sent to École Lesage.', type:'Type of appointment', choose:'Please select your type of appointment', onsite:'On site appointment', phoneCall:'Telephone call', date:'Select a date', time:'Select a time', personal:'Personal information', name:'Full name', first:'First name', last:'Last name', email:'Email', phone:'Phone', country:'Country', message:'Additional information', submit:'Submit', cancel:'Cancel', close:'Close', previous:'Previous month', next:'Next month', required:'Fields marked * are required.', selectSlot:'Please choose a date and a time.', appointmentDone:'Your appointment request has been previewed. This is a prototype: no appointment has been booked.', newsletter:'Subscribe to the newsletter', subscribe:'Subscribe', newsletterDone:'Subscription preview complete. No subscription has been created.', consent:'I agree to the privacy policy.', course:'Course', professional:'Professional option', contactDone:'Your request has been previewed. This is a prototype: no message has been sent.', loginDone:'Local account preview opened. No real account has been authenticated.', registerDone:'Registration preview complete. No real account has been created.', logout:'Log out', lost:'Password reset preview. No reset email has been sent.', weekdays:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], locale:'en-GB'
    },
    fr: {
      prototype:'Prototype — aucune information n’est envoyée à École Lesage.', type:'Type de rendez-vous', choose:'Veuillez choisir votre type de rendez-vous', onsite:'RDV à l’école', phoneCall:'RDV téléphonique', date:'Choisissez une date', time:'Choisissez un horaire', personal:'Informations personnelles', name:'Prénom NOM', first:'Prénom', last:'Nom', email:'E-mail', phone:'Téléphone', country:'Pays', message:'Informations complémentaires', submit:'Envoyer', cancel:'Annuler', close:'Fermer', previous:'Mois précédent', next:'Mois suivant', required:'Les champs marqués * sont obligatoires.', selectSlot:'Veuillez choisir une date et un horaire.', appointmentDone:'Votre demande de rendez-vous a été prévisualisée. Ceci est un prototype : aucun rendez-vous n’a été réservé.', newsletter:'S’inscrire à la newsletter', subscribe:'S’inscrire', newsletterDone:'Prévisualisation de l’inscription terminée. Aucune inscription n’a été créée.', consent:'J’accepte la politique de confidentialité.', course:'Cours', professional:'Option professionnelle', contactDone:'Votre demande a été prévisualisée. Ceci est un prototype : aucun message n’a été envoyé.', loginDone:'Aperçu du compte local ouvert. Aucun compte réel n’a été authentifié.', registerDone:'Prévisualisation de l’inscription terminée. Aucun compte réel n’a été créé.', logout:'Se déconnecter', lost:'Aperçu de réinitialisation du mot de passe. Aucun e-mail n’a été envoyé.', weekdays:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], locale:'fr-FR'
    },
    ja: {
      prototype:'プロトタイプ — 情報はエコール・ルサージュに送信されません。', type:'予約の種類', choose:'予約の種類を選択してください', onsite:'学校での予約', phoneCall:'電話での予約', date:'日付を選択', time:'時間を選択', personal:'個人情報', name:'氏名', first:'名', last:'姓', email:'メールアドレス', phone:'電話番号', country:'国', message:'その他の情報', submit:'送信', cancel:'キャンセル', close:'閉じる', previous:'前の月', next:'次の月', required:'*は必須項目です。', selectSlot:'日付と時間を選択してください。', appointmentDone:'予約リクエストのプレビューが完了しました。プロトタイプのため、予約は行われていません。', newsletter:'ニュースレター登録', subscribe:'登録', newsletterDone:'登録のプレビューが完了しました。実際の登録は行われていません。', consent:'プライバシーポリシーに同意します。', course:'コース', professional:'プロフェッショナルコース', contactDone:'リクエストのプレビューが完了しました。メッセージは送信されていません。', loginDone:'ローカルアカウントのプレビューを開きました。実際の認証は行われていません。', registerDone:'登録のプレビューが完了しました。実際のアカウントは作成されていません。', logout:'ログアウト', lost:'パスワード再設定のプレビューです。メールは送信されていません。', weekdays:['月','火','水','木','金','土','日'], locale:'ja-JP'
    }
  };
  const t = dictionary[lang] || dictionary.en;
  const contactLabels = {
    en:{heading:'Your enquiry',message:'Your message',placeholder:'Tell us about your project or your question.'},
    fr:{heading:'Votre demande',message:'Votre message',placeholder:'Présentez-nous votre projet ou votre question.'},
    ja:{heading:'お問い合わせ',message:'お問い合わせ内容',placeholder:'ご希望やご質問をご記入ください。'}
  };
  const privacyRoutes = {fr:'/fr/politique-de-confidentialite/',en:'/en/privacy-policy/',ja:'/ja/個人情報の取り扱いについて/'};
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label = (name,text,type='text',required=true,extra='') => `<div class="form-group local-field"><label for="local-${name}">${text}${required?' *':''}</label><input id="local-${name}" class="form-control input-text" name="${name}" type="${type}" ${required?'required':''} ${extra}></div>`;
  const notice = () => `<p class="local-prototype-note">${t.prototype}</p>`;
  function adviceToday(date=new Date()){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),part=name=>parts.find(value=>value.type===name)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  function adviceDateRules(){return {min:adviceToday(),weekdays:[1,2,3,4,5]};}
  function validAdviceDate(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value&&value>=adviceToday()&&date.getUTCDay()!==0&&date.getUTCDay()!==6;
  }
  async function mountAdvicePicker(form){
    if(form._lesageAdvicePicker){form._lesageAdvicePicker.refresh();return;}
    try{const {createDatePickers}=await import('/assets/platform/date-picker.mjs');if(form.isConnected===false)return;form._lesageAdvicePicker=createDatePickers({root:form,document,window,locale:t.locale,today:adviceToday,getAvailability:input=>input.hasAttribute('data-advice-date')?adviceDateRules():null});}catch{/* The native date field and its validation remain usable. */}
  }
  function status(container,text) {
    let box=container.querySelector('.local-form-status');
    if(!box){box=document.createElement('div');box.className='local-form-status woocommerce-message';box.setAttribute('role','status');container.append(box);}
    box.textContent=text;box.hidden=false;box.scrollIntoView({block:'nearest'});
  }
  function style() {
    const el=document.createElement('style');
    el.textContent=`.local-prototype-note{font-size:12px!important;line-height:1.45!important;color:#666;margin:18px 0!important}.local-field{margin-bottom:20px!important}.local-field label{display:block;margin-bottom:5px!important}.local-field .form-control{border-radius:0;border:0;border-bottom:1px solid #979797;background:#fff;box-shadow:none;padding:8px 0;height:auto;min-height:38px}.local-field textarea.form-control{width:100%;border:1px solid #aaa;padding:10px}.local-form-actions{display:flex;gap:12px;margin:22px 0}.local-form-actions button{background:#fff;border:1px solid #8d8d8d;border-radius:3px;padding:9px 20px;color:#282828}.local-form-status{margin:20px 0;padding:18px;border:1px solid #bbb;line-height:1.6}.local-consent{display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:1.5}.local-consent input{width:auto;flex:none;margin-top:4px}.local-consent a{text-decoration:underline!important}#rendez-vous.local-panel{position:fixed!important;top:0!important;right:0!important;left:auto;width:508px;min-width:0!important;max-width:100vw;overflow-y:auto;height:100dvh;padding-bottom:36px}#rendez-vous .local-appointment-form{max-width:100%}#rendez-vous .local-calendar{margin:20px 0}#rendez-vous .local-calendar-header{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #c8c8c8}#rendez-vous .local-calendar-header button{border:0;background:none;font-size:24px;padding:0 10px}#rendez-vous .local-calendar table{width:100%;table-layout:fixed;border:0;text-align:center;margin:12px 0}#rendez-vous .local-calendar th{font-size:12px;padding:5px 0;font-weight:400}#rendez-vous .local-calendar td{padding:3px 0;border:0}#rendez-vous .local-calendar td button{border:0;background:#fff;color:#282828;padding:6px;width:32px;height:32px;border-radius:50%}#rendez-vous .local-calendar td button:disabled{opacity:.25;cursor:default}#rendez-vous .local-calendar td button[aria-pressed=true]{background:#282828;color:#fff}#rendez-vous .local-time-slots{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 24px}#rendez-vous .local-time-slots button{border:1px solid #aaa;background:#fff;color:#282828;padding:7px 12px;border-radius:2px}#rendez-vous .local-time-slots button[aria-pressed=true]{background:#282828;color:#fff}#rendez-vous .cross{float:right}#rendez-vous .local-appointment-form h3{font-size:21px;margin:25px 0 12px}#popupNewsletter .local-newsletter-form{padding:35px 28px 22px}#popupNewsletter .local-newsletter-form h2{font-size:25px;font-weight:700;margin-bottom:25px}.local-news-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1040}.nf-form-cont .local-contact-form{max-width:900px;margin:30px auto}.local-contact-form h3{font-size:26px}.local-contact-form .local-field{margin:28px 0!important}.local-account-demo{border:1px solid #ccc;padding:30px;margin:25px 0}.local-account-demo button{background:#fff;border:1px solid #aaa;padding:10px 20px}@media(max-width:600px){#rendez-vous.local-panel{width:100vw;padding:22px}.local-newsletter-form{padding:28px 18px!important}}`;
    document.head.append(el);
  }
  function appointment() {
    const panel=document.querySelector('#rendez-vous'), host=document.querySelector('#rv-form');
    if(!panel||!host)return;
    host.querySelectorAll('.ea-bootstrap,.ea-standard,#ea-loader').forEach(el=>el.remove());
    const form=document.createElement('form');form.className='local-appointment-form ea-form-v2';
    form.innerHTML=`${notice()}<div class="form-group local-field"><label for="local-location">${t.type} *</label><select id="local-location" class="form-control" name="location" required><option value="">${t.choose}</option><option value="onsite">${t.onsite}</option><option value="phone">${t.phoneCall}</option></select></div><section class="local-appointment-details" hidden><div class="form-group local-field"><label for="local-appointment-date">${t.date} *</label><input id="local-appointment-date" class="form-control" type="date" name="date" data-advice-date min="${adviceToday()}" required></div><h3>${t.time}</h3><div class="local-time-slots"></div><input type="hidden" name="time"><h3>${t.personal}</h3><p style="font-size:12px">${t.required}</p>${label('appointment-name',t.name,'text',true,'autocomplete="name" minlength="3"')}${label('appointment-email',t.email,'email',true,'autocomplete="email"')}${label('appointment-country',t.country,'text',false,'autocomplete="country-name"')}${label('appointment-phone',t.phone,'tel',true,'autocomplete="tel" minlength="3"')}<div class="local-field"><label for="local-appointment-message">${t.message}</label><textarea id="local-appointment-message" name="message" class="form-control" rows="3"></textarea></div><div class="local-form-actions"><button type="submit">${t.submit}</button><button type="button" data-local-cancel>${t.cancel}</button></div></section>`;
    host.append(form);
    let selected='',selectedTime='';const times=['09:30','10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00','15:30','16:00','16:30'],dateInput=form.querySelector('[data-advice-date]');
    function slots(){form.querySelector('.local-time-slots').innerHTML=selected?times.map(v=>`<button type="button" data-time="${v}" aria-pressed="${selectedTime===v}">${v}</button>`).join(''):'';}
    dateInput.addEventListener('change',()=>{selected=validAdviceDate(dateInput.value)?dateInput.value:'';if(!selected)dateInput.value='';selectedTime='';form.elements.time.value='';slots();});
    void mountAdvicePicker(form);
    form.querySelector('select[name=location]').addEventListener('change',e=>{form.querySelector('.local-appointment-details').hidden=!e.target.value;});
    form.addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button)return;
      if(button.disabled)return;
      if(button.dataset.time&&validAdviceDate(selected)&&dateInput.value===selected&&times.includes(button.dataset.time)){selectedTime=button.dataset.time;form.elements.time.value=selectedTime;slots();}
      if(button.hasAttribute('data-local-cancel'))closePanel();
    });
    form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();if(!validAdviceDate(selected)||dateInput.value!==selected||!times.includes(selectedTime)){status(form,t.selectSlot);return;}if(!form.reportValidity())return;status(form,`${t.appointmentDone} ${selected} · ${selectedTime}`);});
    let opener;
    function closePanel(){form._lesageAdvicePicker?.close();panel.style.display='none';panel.setAttribute('aria-hidden','true');document.querySelectorAll('#open-rv,#mini-rv').forEach(el=>el.style.display='block');opener?.focus();}
    function openPanel(el){opener=el;panel.classList.add('local-panel');panel.style.display='block';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-hidden','false');document.querySelectorAll('#open-rv,#mini-rv').forEach(el=>el.style.display='none');panel.querySelector('.cross')?.focus();}
    document.querySelectorAll('#open-rv,#mini-rv').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openPanel(el);},true);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPanel(el);}});});
    const close=panel.querySelector('.cross');if(close){close.tabIndex=0;close.setAttribute('role','button');close.setAttribute('aria-label',t.close);close.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();closePanel();},true);close.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();closePanel();}});}
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.style.display==='block')closePanel();});
    document.addEventListener('pointerdown',e=>{const popup=e.target.closest?.('.ls-date-popover');if(popup&&form.querySelector(`[aria-controls="${popup.id}"]`))return;if(panel.style.display==='block'&&!panel.contains(e.target)&&!e.target.closest('#open-rv,#mini-rv'))closePanel();});
    const scrolled=()=>document.querySelector('#open-rv')?.classList.toggle('mini',window.scrollY>=20);window.addEventListener('scroll',scrolled,{passive:true});scrolled();
  }
  function newsletter(){
    const modal=document.querySelector('#popupNewsletter');if(!modal)return;
    const host=modal.querySelector('[class*=klaviyo-form]')||modal.querySelector('.modal-content');if(!host)return;
    host.innerHTML=`<form class="local-newsletter-form"><h2>${t.newsletter}</h2>${label('newsletter-email',t.email,'email',true,'autocomplete="email"')}<label class="local-consent"><input type="checkbox" required><span>${t.consent}</span></label><div class="local-form-actions"><button type="submit">${t.subscribe}</button></div>${notice()}</form>`;
    const form=host.querySelector('form');let backdrop,opener;
    function hide(){modal.style.display='none';modal.classList.remove('show');modal.setAttribute('aria-hidden','true');backdrop?.remove();document.body.classList.remove('modal-open');opener?.focus();}
    function show(el){opener=el;modal.style.display='block';modal.classList.add('show');modal.setAttribute('aria-hidden','false');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');document.body.classList.add('modal-open');backdrop=document.createElement('div');backdrop.className='local-news-backdrop';backdrop.addEventListener('click',hide);document.body.append(backdrop);form.querySelector('input').focus();}
    document.addEventListener('click',e=>{const trigger=e.target.closest('[data-target="#popupNewsletter"],#go-news');if(trigger){e.preventDefault();e.stopImmediatePropagation();show(trigger);return;}if(e.target.closest('#popupNewsletter [data-dismiss="modal"]')||e.target===modal){e.preventDefault();e.stopImmediatePropagation();hide();}},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.style.display==='block')hide();});
    form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();if(!form.reportValidity())return;status(form,t.newsletterDone);});
  }
  function contact(){
    const course=(new URLSearchParams(location.search).get('cours')||'').trim();
    const words=contactLabels[lang]||contactLabels.en;
    const privacy=privacyRoutes[lang]||privacyRoutes.en;
    document.querySelectorAll('.nf-form-cont').forEach(host=>{
      host.innerHTML=`<form class="local-contact-form"><h3>${course?t.professional:words.heading}</h3><p>${t.required}</p>${label('course',t.course,'text',false)}${label('first-name',t.first,'text',true,'autocomplete="given-name"')}${label('last-name',t.last,'text',true,'autocomplete="family-name"')}${label('contact-email',t.email,'email',true,'autocomplete="email"')}${label('contact-phone',t.phone,'tel',true,'autocomplete="tel" minlength="3"')}<div class="local-field"><label for="local-contact-message">${words.message} *</label><textarea id="local-contact-message" name="message" class="form-control" rows="6" placeholder="${esc(words.placeholder)}" required></textarea></div><label class="local-consent"><input type="checkbox" required><span><a href="${privacy}">${t.consent}</a></span></label><div class="local-form-actions"><button type="submit">${t.submit}</button></div>${notice()}</form>`;
      const form=host.querySelector('form');form.elements.course.value=course;form.elements.course.readOnly=Boolean(course);
      form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();if(!form.reportValidity())return;status(form,t.contactDone);},true);
    });
  }
  function account(){
    document.querySelectorAll('form.woocommerce-form-login,form.woocommerce-form-register,form.lost_reset_password').forEach(form=>{
      if(form.closest('#primary')===null)return;
      form.querySelectorAll('input[name=username],input[name=password],input[type=email]').forEach(el=>el.required=true);
      const note=document.createElement('p');note.className='local-prototype-note';note.textContent=t.prototype;form.prepend(note);
      form.addEventListener('submit',e=>{
        e.preventDefault();e.stopImmediatePropagation();if(!form.reportValidity())return;
        form.querySelectorAll('input[type=password]').forEach(el=>el.value='');
        if(form.classList.contains('lost_reset_password')){status(form,t.lost);return;}
        if(form.classList.contains('woocommerce-form-register')){status(form,t.registerDone);return;}
        let box=form.parentElement.querySelector('.local-account-demo');
        if(!box){box=document.createElement('div');box.className='local-account-demo';form.insertAdjacentElement('afterend',box);}
        box.innerHTML=`<p>${t.loginDone}</p><button type="button">${t.logout}</button>`;form.hidden=true;box.hidden=false;
        box.querySelector('button').addEventListener('click',()=>{box.hidden=true;form.hidden=false;form.reset();});
      },true);
    });
  }
  function init(){style();appointment();newsletter();contact();account();window.dispatchEvent(new Event('lesage:forms-ready'));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
