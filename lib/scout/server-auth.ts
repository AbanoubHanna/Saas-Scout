import {subscriptionLifecycle} from './subscriptions';
import {env} from 'cloudflare:workers';import {eq} from 'drizzle-orm';import {getDb} from '../../db';import {platformOperators} from '../../db/schema';
export async function isPlatformOperator(userId:string){const designated=(env as unknown as {SCOUT_PLATFORM_OWNER_USER_ID?:string}).SCOUT_PLATFORM_OWNER_USER_ID;if(designated&&userId===designated)return true;return (await getDb().select().from(platformOperators).where(eq(platformOperators.userId,userId)).limit(1)).length>0;}

export async function requireActiveGroup(groupId:string){const {scoutSubscriptions}=await import('../../db/schema');const [subscription]=await getDb().select().from(scoutSubscriptions).where(eq(scoutSubscriptions.groupId,groupId)).limit(1);if(subscription&&subscriptionLifecycle(subscription).blocked){const {DomainError}=await import('./core');throw new DomainError('انتهت فترة الوصول للمجموعة أو لم تبدأ بعد؛ تواصل مع المفوض',403);}}
