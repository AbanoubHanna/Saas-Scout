import {DomainError,runCommand,type GroupState,type Actor,type Command} from './core.ts';
import {referenceKinds} from './workspace-domain.ts';
export type ImportJob={id:string;kind:string;fingerprint:string;count:number;at:string;actor:string};
export function applyImport(s:GroupState,a:Actor,c:Command,at:string,ensure:(right:string,unit?:string|null)=>void){
 if(c.type!=='import.apply')return false;
 const p=c.payload,kind=String(p.kind??''),fingerprint=String(p.fingerprint??'');
 if(!['members','references','plans','curricula'].includes(kind)||!Array.isArray(p.rows)||!p.rows.length||p.rows.length>50||!/^[a-f0-9]{64}$/.test(fingerprint))throw new DomainError('ملف حتى 50 صفًا ونوع استيراد صحيح مطلوب');
 if(s.imports?.some(j=>j.fingerprint===fingerprint))throw new DomainError('الملف مستورد بالفعل؛ راجع سجل الاستيراد');
 const unit=typeof p.unit==='string'&&p.unit?p.unit:null;
 if(kind==='members')ensure('member.create',String(p.teamId??''));else if(kind==='references')ensure('roles.manage');else if(kind==='plans')ensure('plan.create',unit);else ensure('curriculum.manage',unit);
 let current=s;let sequence=0;
 const execute=(type:string,payload:Record<string,unknown>)=>{const id=c.id+'-i'+(++sequence);if(current.members.some(x=>x.id===id)||current.plans.some(x=>x.id===id))throw new DomainError('تعارض معرّف الاستيراد');current=runCommand(current,a,{id,type,payload},at);return id;};
 for(let i=0;i<p.rows.length;i++){
  const row=p.rows[i];if(!row||typeof row!=='object'||Array.isArray(row))throw new DomainError('صف غير صالح: '+(i+2));const r=row as Record<string,unknown>;
  for(const v of Object.values(r))if(typeof v!=='string'||v.length>6000)throw new DomainError('قيمة غير صالحة بالصف '+(i+2));
  const field=(key:string)=>String(r[key]??'').trim();
  try{
   if(kind==='members'){
    if(current.members.some(m=>(field('nationalId')&&m.profile?.nationalId===field('nationalId'))||(m.name===field('name')&&(m.profile?.birthDate??'')===field('birthDate'))))throw new DomainError('ملف مكرر بالاسم والميلاد أو الهوية');
    execute('member.create',{name:field('name'),team:p.teamId,yearId:p.yearId,profile:{...r}});
   }else if(kind==='references'){
    const category=field('kind') as typeof referenceKinds[number];if(!referenceKinds.includes(category))throw new DomainError('نوع الدليل غير معروف');execute('reference.save',{name:field('name'),kind:category,active:true,parentId:field('parentId')});
   }else if(kind==='plans'){
    if(current.plans.some(x=>x.title===field('title')&&x.yearId===p.yearId&&x.unit===unit))throw new DomainError('الخطة موجودة في نفس النطاق');const raw=field('budget')||'0';if(!/^\d+(\.\d{1,2})?$/.test(raw))throw new DomainError('الميزانية غير صالحة');execute('plan.create',{title:field('title'),goal:field('goal'),scope:p.scope,unit,parentId:p.parentId,yearId:p.yearId,budget:Math.round(Number(raw)*100)});
   }else{
    const title=field('curriculum'),stage=String(p.stage??'').trim();if(!title||!stage||!field('domain')||!field('lesson'))throw new DomainError('اسم المنهج والمرحلة والمجال والدرس مطلوبة');
    let curriculum=current.operations?.curricula.find(x=>x.name===title&&x.stage===stage&&x.unit===unit&&x.status==='draft');if(!curriculum){if(current.operations?.curricula.some(x=>x.name===title&&x.stage===stage&&x.unit===unit))throw new DomainError('المنهج له إصدار مرسل أو معتمد؛ افتح مسودة إصدار قبل الاستيراد');const id=execute('curriculum.create',{name:title,stage,unit});curriculum=current.operations!.curricula.find(x=>x.id===id)!;}
    let domain=current.operations?.domains.find(x=>x.name===field('domain'));if(!domain){const id=execute('domain.create',{name:field('domain'),unit});domain=current.operations!.domains.find(x=>x.id===id)!;}
    if(curriculum.lessons.some(x=>x.title===field('lesson')&&x.domainId===domain!.id))throw new DomainError('الدرس موجود بالفعل');const lessonId=execute('lesson.add',{curriculumId:curriculum.id,title:field('lesson'),domainId:domain.id,part:field('part')||'custom',required:['yes','true','نعم','1'].includes(field('required'))});if(field('summary'))execute('lesson.content',{lessonId,summary:field('summary'),duration:Number(field('duration')||30),resourceUrl:''});
   }
  }catch(e){if(e instanceof DomainError)throw new DomainError('الصف '+(i+2)+': '+e.message,e.status);throw e;}
 }
 current.imports??=[];current.imports.push({id:c.id,kind,fingerprint,count:p.rows.length,at,actor:a.userId});Object.assign(s,current);return true;
}
