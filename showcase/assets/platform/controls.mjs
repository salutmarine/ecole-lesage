/* Native form values, with one consistent, keyboard-accessible presentation. */
const installations = new WeakMap();
let sequence = 0;
const words = {
  fr:{choose:'Choisir une option',search:'Rechercher une option',searchPlaceholder:'Rechercher…',empty:'Aucun résultat',options:'Options disponibles'},
  en:{choose:'Choose an option',search:'Search options',searchPlaceholder:'Search…',empty:'No results',options:'Available options'},
  ja:{choose:'選択してください',search:'選択肢を検索',searchPlaceholder:'検索…',empty:'該当する項目はありません',options:'選択できる項目'}
};
const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase();
export function matchingOptions(options, query='') {
  const needle=normalize(query.trim());
  return options.filter(option=>!needle||normalize(option.label).includes(needle));
}
export function menuPlacement(rect, viewport, preferredHeight=350) {
  const margin=12,gap=6,width=Math.min(Math.max(rect.width,220),Math.max(0,viewport.width-margin*2));
  const below=viewport.height-margin-rect.bottom-gap,above=rect.top-margin-gap;
  const direction=below>=Math.min(preferredHeight,240)||below>=above?'below':'above';
  const maxHeight=Math.max(80,Math.min(preferredHeight,direction==='below'?below:above));
  const left=Math.max(margin,Math.min(rect.left,viewport.width-margin-width));
  const top=direction==='below'?rect.bottom+gap:Math.max(margin,rect.top-gap-maxHeight);
  return {left,top,width,maxHeight,direction};
}

export function setupControls(doc=globalThis.document) {
  if(!doc?.body)return ()=>{};
  if(installations.has(doc))return installations.get(doc);
  const win=doc.defaultView,controls=new Map();
  let openControl=null,scheduled=false,destroyed=false;
  const locale=()=>words[doc.documentElement.lang?.slice(0,2)]||words.fr;
  const eligible=select=>!select.multiple&&!select.hasAttribute('data-native-select')&&!!select.closest('.lesage-shop,.ls-workspace,.demo-profile,.editorial-body,.site-dialogs');
  const make=(tag,className)=>{const el=doc.createElement(tag);if(className)el.className=className;return el;};
  const chevron='<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 8 5 5 5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const check='<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4.5 10 3.5 3.5 7.5-7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function nameFor(select){
    if(select.getAttribute('aria-label'))return select.getAttribute('aria-label');
    const ids=select.getAttribute('aria-labelledby')?.split(/\s+/)||[];
    const labelled=ids.map(id=>doc.getElementById(id)?.textContent||'').join(' ').trim();
    if(labelled)return labelled;
    const label=select.labels?.[0];
    if(label){const direct=[...label.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim();return direct||label.querySelector(':scope > span')?.textContent?.trim()||locale().choose;}
    return locale().choose;
  }
  function enhance(select){
    if(controls.has(select)||!eligible(select))return;
    const wrapper=make('div','ui-select'),trigger=make('button','ui-select-trigger'),value=make('span','ui-select-value');
    const menu=make('div','ui-select-menu'),searchWrap=make('div','ui-select-search'),search=make('input'),list=make('div','ui-select-options'),empty=make('p','ui-select-empty'),validation=make('p','ui-select-validation');
    const id=`lesage-select-${++sequence}`,original={tabindex:select.getAttribute('tabindex'),ariaHidden:select.getAttribute('aria-hidden')};
    menu.id=`${id}-menu`;list.id=`${id}-options`;validation.id=`${id}-error`;
    trigger.type='button';trigger.id=`${id}-trigger`;trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-controls',list.id);trigger.setAttribute('aria-expanded','false');
    trigger.append(value);trigger.insertAdjacentHTML('beforeend',chevron);
    search.type='search';search.autocomplete='off';search.spellcheck=false;searchWrap.append(search);
    list.setAttribute('role','listbox');empty.setAttribute('role','status');validation.setAttribute('role','alert');validation.hidden=true;
    menu.append(searchWrap,list,empty);menu.hidden=true;validation.hidden=true;
    const popover=typeof menu.showPopover==='function';
    if(popover){menu.setAttribute('popover','auto');trigger.setAttribute('popovertarget',menu.id);}
    select.before(wrapper);wrapper.append(select,trigger,menu,validation);select.classList.add('ui-select-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    let fingerprint='',options=[],visible=[],active=-1,isOpen=false,wasPointerOpen=false;
    const disabled=()=>select.disabled||select.matches(':disabled');
    function resetValidation(){validation.hidden=true;validation.textContent='';trigger.removeAttribute('aria-invalid');const described=select.getAttribute('aria-describedby');if(described)trigger.setAttribute('aria-describedby',described);else trigger.removeAttribute('aria-describedby');}
    function position(){
      if(!isOpen||!select.isConnected)return;
      const rect=trigger.getBoundingClientRect(),visual=win.visualViewport;
      const viewport={width:visual?.width||win.innerWidth,height:visual?.height||win.innerHeight};
      const placement=menuPlacement(rect,viewport,Math.min(380,visible.length*46+(searchWrap.hidden?12:70)));
      Object.assign(menu.style,{position:'fixed',inset:'auto',margin:'0',left:`${placement.left}px`,top:`${placement.top}px`,width:`${placement.width}px`,maxHeight:`${placement.maxHeight}px`});
      list.style.maxHeight=`${Math.max(48,placement.maxHeight-(searchWrap.hidden?12:70))}px`;
      menu.dataset.direction=placement.direction;
      if(placement.direction==='above'){
        const measured=menu.getBoundingClientRect().height;
        if(measured>0)menu.style.top=`${Math.max(12,rect.top-6-Math.min(measured,placement.maxHeight))}px`;
      }
    }
    function setActive(index,focus=false){
      const enabled=visible.map((option,i)=>!option.disabled?i:-1).filter(i=>i>=0);
      if(!enabled.length){active=-1;trigger.removeAttribute('aria-activedescendant');return;}
      active=enabled.includes(index)?index:enabled[0];
      [...list.children].forEach((button,i)=>{button.dataset.active=String(i===active);});
      const option=list.children[active];trigger.setAttribute('aria-activedescendant',option.id);
      if(focus){option.focus({preventScroll:true});revealActive();}
    }
    function revealActive(center=false){
      const option=list.children[active];if(!option||!list.clientHeight)return;
      const item=option.getBoundingClientRect(),container=list.getBoundingClientRect();
      const top=item.top-container.top,bottom=item.bottom-container.top;
      if(center)list.scrollTop+=top-(list.clientHeight-item.height)/2;
      else if(top<0)list.scrollTop+=top;
      else if(bottom>list.clientHeight)list.scrollTop+=bottom-list.clientHeight;
    }
    function renderOptions(){
      visible=matchingOptions(options,search.value);list.replaceChildren();
      for(const option of visible){
        const button=make('button','ui-select-option'),label=make('span');button.type='button';button.tabIndex=-1;button.id=`${id}-option-${option.index}`;button.disabled=option.disabled;
        button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.index===select.selectedIndex));label.textContent=option.label;button.append(label);button.insertAdjacentHTML('beforeend',check);
        button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();choose(option);});list.append(button);
      }
      empty.hidden=visible.length>0;empty.textContent=locale().empty;
      setActive(visible.findIndex(option=>option.index===select.selectedIndex));
      position();revealActive();
    }
    function close(restore=false){
      isOpen=false;menu.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-activedescendant');
      if(popover&&menu.matches(':popover-open'))menu.hidePopover();
      menu.hidden=true;if(openControl===control)openControl=null;
      if(restore&&trigger.isConnected)trigger.focus({preventScroll:true});
    }
    function open(query=''){
      if(disabled()||!select.isConnected)return;
      if(openControl&&openControl!==control)openControl.close();
      sync();search.value=query;isOpen=true;openControl=control;menu.hidden=false;menu.classList.add('is-open');trigger.setAttribute('aria-expanded','true');renderOptions();
      if(popover&&!menu.matches(':popover-open')){try{menu.showPopover();}catch{/* A browser without working popovers uses the fixed-position fallback. */}}
      position();revealActive(true);if(!searchWrap.hidden)search.focus({preventScroll:true});else trigger.focus({preventScroll:true});
    }
    function choose(option){
      if(option.disabled||disabled())return;
      const descriptor={id:select.id,name:select.name,control:select.dataset.control,formId:select.form?.id,formType:select.form?.dataset.form,dialog:!!select.closest('dialog')};
      const changed=select.selectedIndex!==option.index;select.selectedIndex=option.index;close(true);resetValidation();sync();
      if(changed){
        select.dispatchEvent(new win.Event('input',{bubbles:true}));select.dispatchEvent(new win.Event('change',{bubbles:true}));if(select.isConnected)sync();
        // A dependent field can rebuild its whole dialog. Restore the same
        // logical control after the observer has enhanced the new markup.
        queueMicrotask(()=>{
          if(destroyed)return;
          const candidates=[...controls.values()].filter(candidate=>{
            const element=candidate.select;
            if(!element.isConnected||candidate.trigger.disabled)return false;
            if(select.isConnected)return element===select;
            if(!!element.closest('dialog')!==descriptor.dialog)return false;
            if(descriptor.id)return element.id===descriptor.id;
            return (descriptor.name||descriptor.control)&&element.name===descriptor.name&&element.dataset.control===descriptor.control&&element.form?.id===descriptor.formId&&element.form?.dataset.form===descriptor.formType;
          });
          if(candidates.length===1)candidates[0].trigger.focus({preventScroll:true});
        });
      }
    }
    function sync(){
      if(!select.isConnected)return;
      const t=locale(),label=nameFor(select),snapshot=JSON.stringify([doc.documentElement.lang,label,select.disabled,select.required,...[...select.options].map(option=>[option.label,option.value,option.disabled,option.parentElement?.disabled])]);
      trigger.disabled=disabled();trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-required',String(select.required));list.setAttribute('aria-label',label||t.options);search.placeholder=t.searchPlaceholder;search.setAttribute('aria-label',`${t.search} · ${label}`);
      value.textContent=select.selectedOptions[0]?.label||t.choose;
      if(!select.willValidate||select.validity.valid)resetValidation();
      if(snapshot!==fingerprint){fingerprint=snapshot;options=[...select.options].map((option,index)=>({label:option.label,value:option.value,index,disabled:option.disabled||!!option.closest('optgroup')?.disabled}));searchWrap.hidden=options.length<=8;if(isOpen)renderOptions();}
      else if(isOpen){[...list.children].forEach((button,index)=>button.setAttribute('aria-selected',String(visible[index]?.index===select.selectedIndex)));}
    }
    function move(direction){const enabled=visible.map((option,index)=>!option.disabled?index:-1).filter(index=>index>=0);if(!enabled.length)return;const at=enabled.indexOf(active);setActive(direction==='first'?enabled[0]:direction==='last'?enabled.at(-1):enabled[(at+direction+enabled.length)%enabled.length],true);}
    function keydown(event){
      if(event.target===select)return;
      if(event.key==='Escape'&&isOpen){event.preventDefault();event.stopPropagation();close(true);return;}
      if(event.key==='Tab'&&isOpen){close(true);return;}
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();event.stopPropagation();const opened=isOpen;if(!isOpen)open();
        if(event.key==='Home')move('first');else if(event.key==='End')move('last');else if(opened)move(event.key==='ArrowDown'?1:-1);else setActive(active,true);return;
      }
      if(event.key==='Enter'&&isOpen){event.preventDefault();event.stopPropagation();if(visible[active])choose(visible[active]);return;}
      if(event.key===' '&&isOpen&&event.target!==search){event.preventDefault();event.stopPropagation();if(visible[active])choose(visible[active]);return;}
      if(event.target===trigger&&event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key!==' '){event.preventDefault();open(searchWrap.hidden?'':event.key);if(searchWrap.hidden){const match=options.findIndex(option=>!option.disabled&&normalize(option.label).startsWith(normalize(event.key)));setActive(match,true);}return;}
    }
    const control={select,wrapper,trigger,menu,sync,close,position,get open(){return isOpen;},destroy(){close();select.classList.remove('ui-select-native');for(const [name,v]of [['tabindex',original.tabindex],['aria-hidden',original.ariaHidden]]){if(v===null)select.removeAttribute(name);else select.setAttribute(name,v);}if(wrapper.isConnected){wrapper.before(select);wrapper.remove();}controls.delete(select);}};
    controls.set(select,control);
    trigger.addEventListener('pointerdown',()=>{wasPointerOpen=isOpen;});
    trigger.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const closing=wasPointerOpen||isOpen;wasPointerOpen=false;if(closing)close(true);else open();});
    wrapper.addEventListener('keydown',keydown);
    search.addEventListener('input',()=>renderOptions());
    select.addEventListener('change',sync);
    select.addEventListener('focus',()=>trigger.focus({preventScroll:true}));
    select.addEventListener('invalid',event=>{event.preventDefault();validation.textContent=select.validationMessage;validation.hidden=false;trigger.setAttribute('aria-invalid','true');trigger.setAttribute('aria-describedby',[select.getAttribute('aria-describedby'),validation.id].filter(Boolean).join(' '));open();});
    menu.addEventListener('beforetoggle',event=>{if(event.newState==='closed'){isOpen=false;menu.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-activedescendant');if(openControl===control)openControl=null;}});
    sync();
  }
  function scan(node){if(node?.nodeType!==1)return;if(node.matches('select'))enhance(node);for(const select of node.querySelectorAll('select'))enhance(select);}
  function refresh(){
    scheduled=false;if(destroyed)return;
    if(openControl&&!openControl.select.isConnected)openControl.close();
    for(const [select,control]of controls){if(!select.isConnected){control.destroy();continue;}if(!eligible(select)){control.destroy();continue;}control.sync();}
  }
  const schedule=()=>{if(!scheduled){scheduled=true;queueMicrotask(refresh);}};
  const observer=new win.MutationObserver(records=>{
    let relevant=false;
    for(const record of records){
      if(record.target.closest?.('.ui-select-menu,.ui-select-trigger,.ui-select-validation'))continue;
      if(record.type==='childList'){for(const node of record.addedNodes)scan(node);if(record.removedNodes.length)relevant=true;}
      if(record.target.nodeName==='SELECT'||record.target.closest?.('select')||record.type==='attributes'&&record.target===doc.documentElement)relevant=true;
    }
    if(relevant)schedule();
  });
  scan(doc.body);observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','required','aria-label','aria-labelledby','selected','label','value','lang']});
  const outside=event=>{if(openControl&&!openControl.wrapper.contains(event.target))openControl.close();};
  const reposition=()=>openControl?.position();
  const scrolled=event=>{if(openControl&&!openControl.menu.contains(event.target))openControl.close();};
  const reset=()=>queueMicrotask(()=>{for(const control of controls.values())control.sync();});
  doc.addEventListener('pointerdown',outside,true);doc.addEventListener('scroll',scrolled,true);doc.addEventListener('reset',reset);win.addEventListener('resize',reposition);win.visualViewport?.addEventListener('resize',reposition);
  const teardown=()=>{destroyed=true;observer.disconnect();doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('scroll',scrolled,true);doc.removeEventListener('reset',reset);win.removeEventListener('resize',reposition);win.visualViewport?.removeEventListener('resize',reposition);for(const control of [...controls.values()])control.destroy();installations.delete(doc);};
  installations.set(doc,teardown);return teardown;
}
