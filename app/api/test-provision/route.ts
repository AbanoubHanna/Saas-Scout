import {env} from 'cloudflare:workers';
import {eq} from 'drizzle-orm';
import {getDb} from '../../../db';
import {scoutGroups} from '../../../db/schema';
import {createSandbox} from '../../../lib/scout/create-sandbox';
import {tokenHash,testEnabled} from '../../../lib/scout/scout-auth';
// Owner-authorized temporary service: synthetic groups only, one batch, one hour.
export async function POST(request:Request){
 const config=env as unknown as {SCOUT_TEST_PROVISION?:string;SCOUT_PLATFORM_OWNER_USER_ID?:string};
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
 try{
  if(!testEnabled()||!config.SCOUT_TEST_PROVISION||!config.SCOUT_PLATFORM_OWNER_USER_ID)return new Response(null,{status:404});
  const grant=JSON.parse(config.SCOUT_TEST_PROVISION) as {key:string;expiresAt:string;receiptId:string};
  const supplied=request.headers.get('X-Scout-Provision-Key')??'';
  if(!grant.key||!grant.receiptId||!Number.isFinite(Date.parse(grant.expiresAt))||Date.parse(grant.expiresAt)<=Date.now()||await tokenHash(supplied)!==await tokenHash(grant.key))return new Response(null,{status:403});
  const existing=await getDb().select({id:scoutGroups.id}).from(scoutGroups).where(eq(scoutGroups.id,grant.receiptId)).limit(1);
  if(existing.length)return Response.json({error:'Already provisioned'},{status:409,headers});
  // Fixed primary key makes concurrent replays roll back the entire insert batch.
  return Response.json(await createSandbox(config.SCOUT_PLATFORM_OWNER_USER_ID,request.url,grant.receiptId),{status:201,headers});
 }catch{return Response.json({error:'Test provisioning failed'},{status:500,headers});}
}
