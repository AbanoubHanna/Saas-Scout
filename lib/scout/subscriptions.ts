export function addMonth(day:string){const d=new Date(day+'T12:00:00Z'),date=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(date,last));return d.toISOString().slice(0,10);}
export function subscriptionLifecycle(s:{status:string;startsOn:string;endsOn:string;updatedAt:string},today=new Date().toISOString().slice(0,10)){
 const blocked=s.status==='suspended'||today<s.startsOn||today>s.endsOn;const stoppedOn=s.status==='suspended'?s.updatedAt.slice(0,10):today>s.endsOn?s.endsOn:null;const retentionUntil=stoppedOn?addMonth(stoppedOn):null;
 return {blocked,phase:s.status==='suspended'?'suspended':today<s.startsOn?'scheduled':today>s.endsOn?'expired':s.status,retentionUntil,purgeEligible:!!retentionUntil&&today>retentionUntil,automaticDeletion:false};
}
