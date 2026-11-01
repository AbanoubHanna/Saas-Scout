import {cashBalance,DomainError,type Actor,type Command,type GroupState} from './core.ts';
export type CashHandover={id:string;boxId:string;from:string;to:string;leaderId:string;balance:number;snapshot:string;at:string;note:string;signatures:{userId:string;at:string}[];status:'review'|'completed'|'outdated'|'cancelled';completedAt?:string;cancelledBy?:string;cancelledAt?:string;cancelReason?:string};
const eligible=(s:GroupState,id:string)=>s.assignments.some(a=>a.userId===id&&a.role!=='member');
const snapshot=(s:GroupState,boxId:string)=>JSON.stringify({entries:s.entries.filter(e=>e.kind==='transfer'?e.fromBoxId===boxId||e.toBoxId===boxId:(e.boxId??'central')===boxId),requests:s.expenseRequests?.filter(r=>r.boxId===boxId&&!r.paidEntryId)??[]});
export function applyCashHandover(s:GroupState,a:Actor,c:Command,at:string,ensure:(right:string,unit?:string|null)=>void){
 if(!['cashbox.handover','cashbox.sign_handover','cashbox.cancel_handover'].includes(c.type))return false;
 const text=(key:string)=>{const v=c.payload[key];if(typeof v!=='string'||!v.trim()||v.length>500)throw new DomainError('بيانات المحضر غير مكتملة');return v.trim();};
 s.cashHandovers??=[];
 if(c.type==='cashbox.handover'){
  const box=s.boxes?.find(b=>b.id===text('boxId'));if(!box)throw new DomainError('الصندوق غير موجود');ensure('roles.manage',box.unit);
  const to=text('to'),leaderId=text('leaderId');
  if(new Set([box.treasurerId,to,leaderId]).size!==3||!eligible(s,to)||!s.assignments.some(x=>x.userId===leaderId&&x.role==='general_leader'&&x.unit===null))throw new DomainError('حدد مستلمًا مكلفًا وقائدًا عامًا بثلاث هويات مستقلة');
  if(!s.assignments.some(x=>x.userId===box.treasurerId&&x.role==='treasurer'&&x.unit===box.unit))throw new DomainError('تكليف الأمين الحالي غير ساري');
  if(s.cashHandovers.some(h=>h.boxId===box.id&&h.status==='review'))throw new DomainError('يوجد محضر مفتوح لهذا الصندوق');
  if(s.expenseRequests?.some(r=>r.boxId===box.id&&!r.paidEntryId&&!r.decisions.some(d=>!d.approved)))throw new DomainError('أكمل طلبات المصروف المفتوحة قبل تسليم المسؤولية');
  s.cashHandovers.push({id:c.id,boxId:box.id,from:box.treasurerId,to,leaderId,balance:cashBalance(s,box.id),snapshot:snapshot(s,box.id),at,note:text('note'),signatures:[],status:'review'});return true;
 }
 const h=s.cashHandovers.find(x=>x.id===text('handoverId'));
 if(c.type==='cashbox.cancel_handover'){
  if(!h||!['review','outdated'].includes(h.status))throw new DomainError('المحضر غير قابل للإلغاء');const box=s.boxes?.find(b=>b.id===h.boxId);if(!box)throw new DomainError('الصندوق غير موجود');ensure('roles.manage',box.unit);h.cancelReason=text('reason');h.status='cancelled';h.cancelledBy=a.userId;h.cancelledAt=at;return true;
 }
 if(!h||h.status!=='review'||![h.from,h.to,h.leaderId].includes(a.userId)||h.signatures.some(x=>x.userId===a.userId))throw new DomainError('التوقيع لطرف المحضر المحدد مرة واحدة',403);
 const box=s.boxes?.find(b=>b.id===h.boxId);if(!box||box.treasurerId!==h.from||!s.assignments.some(x=>x.userId===h.from&&x.role==='treasurer'&&x.unit===box.unit)||!eligible(s,h.to)||!s.assignments.some(x=>x.userId===h.leaderId&&x.role==='general_leader'&&x.unit===null))throw new DomainError('راجع التكليفات الحالية قبل التوقيع',403);
 if(snapshot(s,box.id)!==h.snapshot){h.status='outdated';return true;}
 h.signatures.push({userId:a.userId,at});
 if([h.from,h.to,h.leaderId].every(id=>h.signatures.some(x=>x.userId===id))){
  s.assignments=s.assignments.filter(x=>!(x.userId===h.from&&x.role==='treasurer'&&x.unit===box.unit));
  if(!s.assignments.some(x=>x.userId===h.to&&x.role==='treasurer'&&x.unit===box.unit))s.assignments.push({userId:h.to,role:'treasurer',unit:box.unit,title:'أمين صندوق — بمحضر تسليم'});
  box.treasurerId=h.to;h.status='completed';h.completedAt=at;
 }
 return true;
}
