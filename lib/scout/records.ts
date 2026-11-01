import type {GroupState} from './core.ts';
type Root=GroupState&{storageVersion?:number;lastCommandId?:string};
export type StoredRecord={collection:string;entityId:string;data:string};
export function partition(state:GroupState){
 const meta=structuredClone(state) as Root,records:StoredRecord[]=[];
 if(!meta.storageVersion)for(const [ordinal,item]of state.audit.entries())records.push({collection:'legacy_audit',entityId:item.id,data:JSON.stringify({ordinal,value:item})});
 const visit=(target:Record<string,unknown>,prefix='')=>{for(const[key,value]of Object.entries(target)){
  if(['audit','processed'].includes(key)&&!prefix){target[key]=[];continue;}
  if(Array.isArray(value)&&value.every(x=>x&&typeof x==='object'&&typeof x.id==='string')){for(const[ordinal,record]of value.entries())records.push({collection:prefix+key,entityId:record.id,data:JSON.stringify({ordinal,value:record})});target[key]=[];}
  else if(['operations','peopleEvents','documents','workspace','academy'].includes(key)&&value&&typeof value==='object')visit(value as Record<string,unknown>,key+'.');
 }};visit(meta as unknown as Record<string,unknown>);meta.storageVersion=2;return {meta,records};
}
export function diffRecords(previous:StoredRecord[],next:StoredRecord[]){const key=(r:StoredRecord)=>r.collection+':'+r.entityId;const before=new Map(previous.map(r=>[key(r),r.data])),after=new Set(next.map(key));return {upserts:next.filter(r=>before.get(key(r))!==r.data),deleted:previous.filter(r=>r.collection!=='legacy_audit'&&!after.has(key(r))).map(key)};}
export function hydrate(meta:GroupState,records:{collection:string;data:string}[]):GroupState{
 const result=structuredClone(meta);const parsed=records.map(r=>({...r,parsed:JSON.parse(r.data)})).sort((a,b)=>(a.parsed.ordinal??0)-(b.parsed.ordinal??0));
 for(const record of parsed){const value=record.parsed.value??record.parsed;if(record.collection==='legacy_audit'){result.audit.push(value);continue;}const path=record.collection.split('.');let target=result as unknown as Record<string,unknown>;for(const key of path.slice(0,-1)){target[key]??={};target=target[key] as Record<string,unknown>;}const key=path.at(-1)!;if(!Array.isArray(target[key]))target[key]=[];(target[key] as unknown[]).push(value);}return result;
}
