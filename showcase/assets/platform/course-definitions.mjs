import {courseReservationPreset,normaliseReservationSpacing,reservationSpacingError,MIN_PURCHASE_LEAD_HOURS} from './reservation-policy.mjs';

export const MAX_COURSE_DEFINITIONS=50;
export const COURSE_CATEGORY_LABELS={initiation:'Initiation',advanced:'Perfectionnement',specialisation:'Spécialisation'};
const validKey=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,39}$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const price=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1000000&&Math.abs(value*100-Math.round(value*100))<0.000001;

export function courseDefinitionError(course,{courses=[],ignoreKey=''}={}){
  if(!course||typeof course!=='object'||Array.isArray(course))return 'Renseignez les informations du cours.';
  if(!validKey(course.key))return 'L’identifiant du cours est invalide.';
  if(!text(course.title,160))return 'Renseignez un titre de 160 caractères maximum.';
  if(!validKey(course.category)||!text(course.label,80))return 'Choisissez un niveau de cours valide.';
  if(!price(course.price))return 'Le prix doit être compris entre 0 et 1 000 000 €, avec deux décimales au maximum.';
  if(!integer(course.sessions,1,400))return 'Le cours doit comprendre entre 1 et 400 séances de 3 heures.';
  if(!integer(course.validityMonths,1,120))return 'La validité doit être comprise entre 1 et 120 mois.';
  if(!integer(course.capacity,1,50))return 'La capacité doit être un nombre entier compris entre 1 et 50.';
  if(!integer(course.leadDays,0,365))return 'Le délai de réservation doit être un nombre entier compris entre 0 et 365 jours.';
  if(course.level!==undefined&&!integer(course.level,0,100))return 'Le niveau doit être un entier compris entre 0 et 100 ; 0 utilise le titre du cours.';
  if(course.purchaseLeadHours!==undefined&&!integer(course.purchaseLeadHours,MIN_PURCHASE_LEAD_HOURS,8760))return 'Le délai après achat doit être compris entre 72 et 8 760 heures.';
  if(course.spacing!==undefined){const spacingError=reservationSpacingError(course.spacing);if(spacingError)return spacingError;}
  if(course.teacherId!==undefined&&course.teacherId!==''&&!validKey(course.teacherId))return 'L’identifiant du professeur référent est invalide.';
  if(typeof course.active!=='boolean'||typeof course.custom!=='boolean')return 'Choisissez un état valide pour le cours.';
  const others=(Array.isArray(courses)?courses:[]).filter(item=>item?.key!==ignoreKey);
  if(others.some(item=>item?.key===course.key))return 'Cet identifiant de cours est déjà utilisé.';
  if(!ignoreKey&&others.length>=MAX_COURSE_DEFINITIONS)return 'Le catalogue accepte cinquante cours au maximum.';
  return '';
}
function legacyDefaults(legacy){
  const value=legacy&&typeof legacy==='object'?legacy:{},principal=(Array.isArray(value.workshops)?value.workshops.find(room=>room?.id==='main'):null)||value.principal||value.workshop||{};
  const capacity=value.capacity??principal.capacity??value.organisation?.capacity,teacherId=value.teacherId??principal.teacherId,leadHours=value.leadHours??value.booking?.leadHours;
  return {capacity:integer(capacity,1,50)?capacity:12,teacherId:validKey(teacherId)?teacherId:'',leadDays:typeof leadHours==='number'&&Number.isFinite(leadHours)&&leadHours>=0&&leadHours<=8760?Math.ceil(leadHours/24):3};
}
function normalizeRecord(value,fallback,defaults,custom,{deferPolicy=false}={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||!validKey(value.key))return null;
  const base=fallback||{},category=validKey(value.category)?value.category:base.category||'initiation';
  const record={key:value.key,title:text(value.title,160)?value.title.trim():base.title,category,label:text(value.label,80)?value.label.trim():base.label||COURSE_CATEGORY_LABELS[category]||'Formation',price:price(value.price)?value.price:base.price,sessions:integer(value.sessions,1,400)?value.sessions:base.sessions,validityMonths:integer(value.validityMonths,1,120)?value.validityMonths:base.validityMonths??(category==='initiation'?6:12),capacity:integer(value.capacity,1,50)?value.capacity:base.capacity??defaults.capacity,teacherId:value.teacherId===''||validKey(value.teacherId)?value.teacherId:base.teacherId??defaults.teacherId,leadDays:integer(value.leadDays,0,365)?value.leadDays:base.leadDays??defaults.leadDays,active:typeof value.active==='boolean'?value.active:base.active!==false,custom};
  const recommended=courseReservationPreset({...record,level:integer(value.level,0,100)?value.level:base.level});
  record.level=recommended.level;
  record.purchaseLeadHours=integer(value.purchaseLeadHours,MIN_PURCHASE_LEAD_HOURS,8760)?value.purchaseLeadHours:integer(base.purchaseLeadHours,MIN_PURCHASE_LEAD_HOURS,8760)?base.purchaseLeadHours:MIN_PURCHASE_LEAD_HOURS;
  const inherited=value.spacingInherited===true,source=inherited?base.spacing:value.spacing;
  record.spacing=normaliseReservationSpacing(source,normaliseReservationSpacing(base.spacing,recommended.spacing));
  // A first pass may run before the bundled catalogue is available. Defer its
  // authoritative spacing instead of serializing inferred zeros over it.
  if(deferPolicy&&!custom&&(inherited||value.spacing===undefined))record.spacingInherited=true;
  return courseDefinitionError(record)?null:record;
}

/** Keeps catalogue identities and custom courses, without serializing images or mutable booking data. */
export function normaliseCourseDefinitions(saved,{catalog=[],legacy={}}={}){
  const defaults=legacyDefaults(legacy),raw=Array.isArray(saved)?saved.slice(0,200):[],savedByKey=new Map(),result=[],seen=new Set();
  for(const value of raw)if(value&&validKey(value.key)&&!savedByKey.has(value.key))savedByKey.set(value.key,value);
  for(const value of Array.isArray(catalog)?catalog.slice(0,MAX_COURSE_DEFINITIONS):[]){
    if(!value||seen.has(value.key))continue;
    const base=normalizeRecord(value,null,defaults,value.custom===true);if(!base)continue;
    const record=normalizeRecord({...base,...savedByKey.get(base.key)},base,defaults,base.custom);result.push(record||base);seen.add(base.key);
  }
  for(const value of raw){
    if(result.length>=MAX_COURSE_DEFINITIONS)break;if(!value||seen.has(value.key))continue;
    const record=normalizeRecord(value,null,defaults,value.custom===true||String(value.key).startsWith('course-'),{deferPolicy:!Array.isArray(catalog)||!catalog.some(entry=>entry?.key===value.key)});if(record){result.push(record);seen.add(record.key);}
  }
  return result;
}

/** Session snapshots and explicit overrides take precedence over defaults for future sessions. */
export function courseSessionConfig(course={},session={}){
  course=course||{};session=session||{};
  return {capacity:session.capacityOverride??session.capacity??course.capacity,leadDays:session.leadDaysOverride??session.leadDays??course.leadDays,teacherId:session.teacherId||course.teacherId};
}
