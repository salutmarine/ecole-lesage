export const MIN_PURCHASE_LEAD_HOURS=72;
export const RESERVATION_POLICY_PRESETS={auto:'Selon le cours', 'initiation-short':'Initiation · jusqu’à 6 h', 'initiation-daily':'Initiation · 12 à 18 h', 'ribbon-2':'Broderie au ruban · niveau 2', 'advanced-daily':'Perfectionnement · niveaux 1 à 4', 'advanced-5':'Perfectionnement · niveau 5 et plus',specialisation:'Spécialisation'};
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const fieldLimits={minHours:8760,maxPerDay:400,maxPerWeek:400};
export function courseLevel(course={}){
  if(integer(course.level,1,100))return course.level;
  const match=String(course.title||course.name||'').match(/(?:niveau|level)\s*(\d{1,3})/i);
  return match&&integer(Number(match[1]),1,100)?Number(match[1]):0;
}
/** Recommended initial rules; saved explicit spacing always has precedence. */
export function courseReservationPreset(course={},requested='auto'){
  const level=courseLevel(course),title=String(course.title||course.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),hours=Number(course.sessions)*3||Number(course.hours)||0;
  let preset=requested;
  if(!Object.hasOwn(RESERVATION_POLICY_PRESETS,preset))preset='auto';
  if(preset==='auto'){
    if(course.category==='initiation')preset=/(?:ruban|ribbon)/.test(title)&&level===2?'ribbon-2':hours<=6?'initiation-short':'initiation-daily';
    else if(course.category==='advanced')preset=level>=5?'advanced-5':'advanced-daily';
    else if(course.category==='specialisation')preset='specialisation';
  }
  const spacing={minHours:0,maxPerDay:0,maxPerWeek:0};
  if(['initiation-daily','ribbon-2','advanced-daily','advanced-5','specialisation'].includes(preset))spacing.maxPerDay=1;
  if(preset==='ribbon-2')spacing.minHours=48;
  if(preset==='advanced-5'){spacing.minHours=24;spacing.maxPerWeek=3;}
  return {preset,level,spacing,purchaseLeadHours:MIN_PURCHASE_LEAD_HOURS,validityMonths:course.category==='initiation'?6:12};
}
export function reservationSpacingError(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return 'Renseignez les règles entre deux réservations.';
  if(!integer(value.minHours,0,8760))return 'L’écart minimum doit être un nombre entier compris entre 0 et 8 760 heures.';
  if(!integer(value.maxPerDay,0,400))return 'Le maximum par jour doit être un nombre entier compris entre 0 et 400 ; 0 signifie illimité.';
  if(!integer(value.maxPerWeek,0,400))return 'Le maximum par semaine doit être un nombre entier compris entre 0 et 400 ; 0 signifie illimité.';
  return '';
}
export function normaliseReservationSpacing(value,fallback={minHours:0,maxPerDay:0,maxPerWeek:0}){
  const raw=value&&typeof value==='object'&&!Array.isArray(value)?value:{},base=fallback&&typeof fallback==='object'?fallback:{};
  return Object.fromEntries(Object.entries(fieldLimits).map(([key,max])=>[key,integer(raw[key],0,max)?raw[key]:key!=='minHours'&&raw[key]===null?0:integer(base[key],0,max)?base[key]:0]));
}
