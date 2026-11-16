// Editorial matching only: it never grants admission, checks stock or reserves a place.
const techniques={
  '2579':'needle','1752':'needle','1759':'needle','1768':'needle',
  '3726':'hook','3728':'hook','3727':'hook','1837':'needle',
  '1847':'ribbon','3218':'hook','3754':'gold','3755':'passementerie','1857':'ribbon'
};
export const featuredCourseKeys=['2579','1752','3726'];
const choices={level:['beginner','practised'],goal:['discover','needle','hook','professional'],time:['short','medium','long']};
export function recommendCourses(catalog,answers={}){
  if(Object.entries(choices).some(([key,values])=>!values.includes(answers[key])))return {courses:[],status:'incomplete',advice:false};
  const {level,goal,time}=answers;
  const duration=hours=>time==='short'?hours<=6:time==='medium'?hours>6&&hours<=18:hours>18;
  const courses=(Array.isArray(catalog)?catalog:[]).filter(p=>{
    if(!p||!p.key||!Number.isFinite(p.hours)||p.hours<=0||!Number.isFinite(p.price)||p.price<0||!duration(p.hours))return false;
    if(goal==='professional')return p.category==='specialisation'&&String(p.key)!=='1684';
    if(p.category!=='initiation'||Number(p.level)>1)return false;
    // A general statement of experience cannot validate a sequential course prerequisite.
    if(Number(p.level)>0&&level==='beginner')return false;
    if(goal!=='discover'&&techniques[String(p.key)]!==goal)return false;
    return true;
  }).sort((a,b)=>{
    const preferred=p=>{const i=featuredCourseKeys.indexOf(String(p.key));return i<0?10:i;};
    return preferred(a)-preferred(b)||a.hours-b.hours||a.price-b.price||String(a.key).localeCompare(String(b.key));
  }).slice(0,3).map(product=>({product,reason:goal==='professional'?'professional':goal==='needle'?'needle':goal==='hook'?'hook':level==='beginner'?'beginner':'discover'}));
  return {courses,status:courses.length?'matched':'no-match',advice:goal==='professional'||!courses.length};
}
