import {normaliseCourseDefinitions,COURSE_CATEGORY_LABELS} from './course-definitions.mjs';

const LANGUAGES=['fr','en','ja'];
const FALLBACK_IMAGE='/wp-content/themes/ecolelesage/assets/img/logo-lesage.svg';
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const keyValid=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,39}$/.test(value);
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const finitePrice=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1000000;
const text=(value,max=160)=>typeof value==='string'&&value.trim()&&value.trim().length<=max?value.trim():'';
export const canonicalCourseKey=value=>({'2579':'needle','3726':'hook'}[String(value)]||String(value));
function safeUrl(value){
  if(typeof value!=='string'||value.length>2000||/[\u0000-\u0020]/.test(value)||value.startsWith('//'))return '';
  if(!value.startsWith('/')&&!/^https?:\/\//i.test(value))return '';
  try{const url=new URL(value,'https://catalog.invalid');return ['http:','https:'].includes(url.protocol)?value:'';}catch{return '';}
}
const duration=(hours,lang)=>lang==='ja'?hours+' 時間':hours+' '+(lang==='en'?'hour'+(hours===1?'':'s'):'heure'+(hours===1?'':'s'));
const productRoute=(key,lang)=>`/${lang}/boutique/?cours=${encodeURIComponent(key)}`;
function courseFromProduct(product){
  const sourceKey=String(product.key??''),key=canonicalCourseKey(sourceKey);if(!keyValid(key))return null;
  const variant=record(product.variants?.fr)?product.variants.fr:record(product.variants?.en)?product.variants.en:{};
  const category=keyValid(product.category)?product.category:'initiation';
  const hours=Number(product.hours)||Number(String(variant.duration||'').match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',','.'))||3;
  return {key,title:text(variant.name)||text(product.name)||'Cours de broderie',category,label:text(product.label,80)||COURSE_CATEGORY_LABELS[category]||'Formation',price:finitePrice(product.price)?product.price:finitePrice(variant.price)?variant.price:0,sessions:integer(product.sessions,1,400)?product.sessions:Math.max(1,Math.min(400,Math.ceil(hours/3))),validityMonths:integer(product.validityMonths,1,120)?product.validityMonths:category==='initiation'?6:12,...(integer(product.capacity,1,50)?{capacity:product.capacity}:{}),...(integer(product.leadDays,0,365)?{leadDays:product.leadDays}:{}),...(integer(product.level,0,100)?{level:product.level}:{}),...(record(product.spacing)?{spacing:Object.fromEntries(['minHours','maxPerDay','maxPerWeek'].filter(key=>integer(product.spacing[key],0,8760)).map(key=>[key,product.spacing[key]]))}:{}),...(integer(product.purchaseLeadHours,72,8760)?{purchaseLeadHours:product.purchaseLeadHours}:{}),active:product.advertised!==false,custom:false};
}
function savedByCanonicalKey(saved){
  const values=new Map();
  for(const value of Array.isArray(saved)?saved.slice(0,200):[]){
    if(!record(value)||!keyValid(String(value.key??'')))continue;
    const key=canonicalCourseKey(value.key);
    if(!values.has(key)||value.key===key)values.set(key,{...value,key});
  }
  return values;
}
function publicContent(value){
  if(typeof value==='string')return value.slice(0,50000);
  if(!record(value))return undefined;
  return Object.fromEntries(LANGUAGES.filter(lang=>typeof value[lang]==='string').map(lang=>[lang,value[lang].slice(0,50000)]));
}

/** Public fields only: no staff identities, enrolments, rosters or private settings. */
export function projectPublicCourseCatalog(baseCatalog,savedCourses,{legacy={}}={}){
  const products=(Array.isArray(baseCatalog)?baseCatalog:[]).filter(record).slice(0,200),baseByKey=new Map(),catalog=[];
  for(const product of products){const course=courseFromProduct(product);if(!course||baseByKey.has(course.key))continue;baseByKey.set(course.key,product);catalog.push(course);}
  const saved=savedByCanonicalKey(savedCourses),definitions=normaliseCourseDefinitions([...saved.values()],{catalog,legacy});
  return definitions.filter(course=>course.active).map(course=>{
    const base=baseByKey.get(course.key),sourceKey=base&&keyValid(String(base.key))?String(base.key):course.key,hours=course.sessions*3;
    const originalName=text(base?.variants?.fr?.name)||text(base?.name),savedTitle=text(saved.get(course.key)?.title),renamed=!!savedTitle&&savedTitle!==originalName;
    const image=safeUrl(base?.image)||safeUrl(base?.variants?.fr?.image)||FALLBACK_IMAGE;
    const variants=Object.fromEntries(LANGUAGES.map(lang=>{
      const variant=record(base?.variants?.[lang])?base.variants[lang]:{};
      return [lang,{id:keyValid(String(variant.id??''))?String(variant.id):sourceKey,route:safeUrl(variant.route)||productRoute(sourceKey,lang),name:!base||renamed||lang==='fr'?course.title:text(variant.name)||course.title,price:course.price,image:safeUrl(variant.image)||image,duration:duration(hours,lang)}];
    }));
    const ids=[...new Set([sourceKey,course.key,...(Array.isArray(base?.ids)?base.ids.map(String).filter(keyValid):[])])];
    const output={key:sourceKey,ids,variants,routes:[...new Set([...(Array.isArray(base?.routes)?base.routes.map(safeUrl).filter(Boolean):[]),...LANGUAGES.map(lang=>variants[lang].route)])],advertised:true,name:course.title,category:course.category,label:course.label,price:course.price,image,hours,sessions:course.sessions,sessionMinutes:180,validityMonths:course.validityMonths,capacity:course.capacity,leadDays:course.leadDays};
    if(integer(course.level,0,100))output.level=course.level;
    output.purchaseLeadHours=course.purchaseLeadHours;
    if(record(course.spacing))output.spacing=Object.fromEntries(['minHours','maxPerDay','maxPerWeek'].filter(key=>Number.isFinite(course.spacing[key])&&course.spacing[key]>=0).map(key=>[key,course.spacing[key]]));
    for(const kind of ['descriptionHtml','techniquesHtml','informationHtml']){const value=publicContent(base?.[kind]);if(value!==undefined)output[kind]=value;}
    return output;
  });
}
