/* Browser-local drafts and catalogue preferences, isolated by demonstration profile. */
const PREFIX='lesage.shop.ux.v1.';
const fields=['firstName','lastName','email','phone','country','address','postcode','city','giftFirstName','giftLastName','giftEmail'];
const defaults={category:'all',query:'',duration:'all',sort:'recommended'};
const storage=()=>{try{return globalThis.localStorage;}catch{return null;}};
const key=(type,id)=>`${PREFIX}${type}.${encodeURIComponent(String(id))}`;
const read=(type,id,target)=>{try{const value=JSON.parse((target??storage())?.getItem(key(type,id))||'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}};
const write=(type,id,value,target)=>{try{(target??storage())?.setItem(key(type,id),JSON.stringify(value));}catch{/* A disabled browser store must not block shopping. */}};

export function normalizeFilters(value={}){
 return {category:['all','initiation','advanced','specialisation'].includes(value.category)?value.category:'all',query:typeof value.query==='string'?value.query.slice(0,250):'',duration:['all','short','medium','long'].includes(value.duration)?value.duration:'all',sort:['recommended','ascending','descending','shortest'].includes(value.sort)?value.sort:'recommended'};
}
export function readShopFilters(studentId,target){return normalizeFilters(read('filters',studentId,target));}
export function saveShopFilters(studentId,value,target){const result=normalizeFilters(value);write('filters',studentId,result,target);return result;}
export function filterParams(value){const normalized=normalizeFilters(value);return Object.fromEntries(Object.entries(normalized).filter(([name,v])=>v!==defaults[name]));}
export function readCheckoutDraft(studentId,target){
 const draft=read('checkout',studentId,target),result={};
 for(const name of fields)if(typeof draft[name]==='string')result[name]=draft[name].slice(0,500);
 if(['self','gift'].includes(draft.recipient))result.recipient=draft.recipient;
 return result;
}
export function saveCheckoutDraft(studentId,value,target){
 const result={};for(const name of fields)if(typeof value[name]==='string')result[name]=value[name].slice(0,500);
 result.recipient=value.recipient==='gift'?'gift':'self';write('checkout',studentId,result,target);return result;
}
export function clearCheckoutDraft(studentId,target){try{(target??storage())?.removeItem(key('checkout',studentId));}catch{}}
