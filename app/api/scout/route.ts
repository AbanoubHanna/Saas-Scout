import {supportProjection} from '../../../lib/scout/governance';
import {loadGroupState,saveGroupState,fingerprint} from '../../../lib/scout/storage';
import {isPlatformOperator as operator} from '../../../lib/scout/server-auth';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { platformOperators, scoutGroups, groupAccounts, trialRequests,scoutFiles,scoutCommands,scoutSupportLog,scoutSubscriptions } from '../../../db/schema';
import { getChatGPTUser } from '../../chatgpt-auth';
import { createGroup, runCommand, DomainError, groupReport, projectGroup, individualProfile,can,isWithinUnit, type GroupState, type Command } from '../../../lib/scout/core';
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function identity() {
    const user = await getChatGPTUser();
    if (!user)
        throw new DomainError('سجّل الدخول أولًا', 401);
    return user;
}
export async function GET(request: Request) {
    try {
        const user = await identity();
        const db = getDb();
        const isOperator = await operator(user.userId);
        const groupId = new URL(request.url).searchParams.get('group');
        if (!groupId) {
            const groups = await db.select({ id: scoutGroups.id, name: scoutGroups.name }).from(scoutGroups).where(sql `exists (select 1 from json_each(json_extract(${scoutGroups.state}, '$.assignments')) as a where json_extract(a.value, '$.userId') = ${user.userId})`);
            const trials = isOperator ? await db.select({ id: trialRequests.id, groupName: trialRequests.groupName, church: trialRequests.church, leaderName: trialRequests.leaderName, createdAt: trialRequests.createdAt }).from(trialRequests).limit(100) : [];
            return response({ user: { id: user.userId, name: user.displayName }, isOperator, groups, trials });
        }
        const [row] = await db.select().from(scoutGroups).where(eq(scoutGroups.id, groupId)).limit(1);
        if (!row)
            throw new DomainError('المجموعة غير موجودة', 404);
        const state = await loadGroupState(row);
        if (!state.assignments.some(a => a.userId === user.userId)){if(!isOperator)throw new DomainError('ليس لك وصول لهذه المجموعة',403);const support=supportProjection(state,user.userId,new Date().toISOString());for(const grant of support.grants)await db.insert(scoutSupportLog).values({id:crypto.randomUUID(),groupId,grantId:grant.id,operatorId:user.userId,scope:grant.scope,at:new Date().toISOString()});return response({support});}
        const [subscription]=await db.select().from(scoutSubscriptions).where(eq(scoutSubscriptions.groupId,groupId)).limit(1);if(subscription?.status==='suspended')throw new DomainError('مساحة المجموعة موقوفة؛ تواصل مع مفوض الاشتراك',403);
        if(new URL(request.url).searchParams.get('view')==='offline'){const actor={userId:user.userId};const meetings=state.meetings.filter(m=>{const p=state.plans.find(p=>p.id===m.planId);return p&&can(state,actor,'meeting.record',p.unit);});if(!meetings.length)throw new DomainError('لا توجد اجتماعات مصرح بها للحفظ دون اتصال',403);const units=meetings.map(m=>state.plans.find(p=>p.id===m.planId)!);const members=state.members.filter(m=>['active','trial','discussion'].includes(m.status)&&units.some(p=>p.scope==='general'||p.unit===m.team||(p.scope==='sector'&&p.unit!==null&&isWithinUnit(state,p.unit,m.team))));return response({pack:{id:user.userId+':'+state.id,userId:user.userId,groupId:state.id,name:state.name,revision:row.revision,expiresAt:new Date(Date.now()+86400000).toISOString(),members:members.map(m=>({id:m.id,name:m.name,team:m.team})),meetings:meetings.map(m=>({id:m.id,title:m.title,date:m.date,attendance:Object.fromEntries(Object.entries(m.attendance).filter(([id])=>members.some(x=>x.id===id))),assessments:Object.fromEntries(Object.entries(m.assessments).filter(([id])=>members.some(x=>x.id===id))),lessonId:state.operations?.items.find(i=>i.id===m.itemId)?.lessonId??null})),deliveries:state.operations?.deliveries.filter(d=>meetings.some(m=>m.id===d.meetingId))??[],assessments:state.operations?.assessments.filter(a=>members.some(m=>m.id===a.memberId)&&meetings.some(m=>m.id===a.meetingId))??[]}});}
        if (new URL(request.url).searchParams.get('view') === 'me')
            return response({ profile: individualProfile(state, { userId: user.userId }), revision: row.revision });
        const projected = projectGroup(state, { userId: user.userId });
        return response({ state: projected, revision: row.revision, report: groupReport(projected) });
    }
    catch (error) {
        return failure(error);
    }
}
export async function POST(request: Request) {
    try {
        const origin = request.headers.get('origin');
        if (origin && origin !== new URL(request.url).origin)
            throw new DomainError('مصدر الطلب غير مسموح', 403);
        const user = await identity();
        const raw = await request.text();
        if (raw.length > 30000)
            throw new DomainError('طلب أكبر من المسموح', 413);
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new DomainError('بيانات غير صالحة');
        const input = parsed as Record<string, unknown>;
        const db = getDb();
        if (input.type === 'group.create') {
            if (!await operator(user.userId))
                throw new DomainError('إجراء خاص بإدارة المنصة', 403);
            const name = String(input.name || '').trim(), leaderId = String(input.leaderId || '').trim(), trialId = String(input.trialId || '');
            if (name.length < 2 || name.length > 120 || !leaderId || leaderId.length > 180 || !trialId)
                throw new DomainError('حدد طلب التجربة واسم المجموعة وحساب قائدها');
            const [trial] = await db.select().from(trialRequests).where(eq(trialRequests.id, trialId)).limit(1);
            if (!trial)
                throw new DomainError('طلب التجربة غير موجود', 404);
            const [existing] = await db.select().from(scoutGroups).where(eq(scoutGroups.trialRequestId, trialId)).limit(1);
            if (existing)
                return response({ groupId: existing.id });
            const id = crypto.randomUUID();
            const state = createGroup(id, name, leaderId);state.accountNames={[leaderId]:leaderId===user.userId?user.displayName:trial.leaderName};
            await db.batch([db.insert(scoutGroups).values({ id, name, trialRequestId: trialId, state: JSON.stringify(state), revision: 0, createdAt: new Date().toISOString() }), db.insert(groupAccounts).values({ id: crypto.randomUUID(), groupId: id, userId: leaderId, active: true })]);
            return response({ groupId: id }, 201);
        }
        const groupId = typeof input.groupId === 'string' ? input.groupId : '';
        const revision = input.revision;
        if (!groupId || (!Number.isSafeInteger(revision) || Number(revision) < 0))
            throw new DomainError('مجموعة أو إصدار غير صالح');
        const [row] = await db.select().from(scoutGroups).where(eq(scoutGroups.id, groupId)).limit(1);
        if (!row)
            throw new DomainError('المجموعة غير موجودة', 404);
        const [subscription]=await db.select().from(scoutSubscriptions).where(eq(scoutSubscriptions.groupId,groupId)).limit(1);if(subscription?.status==='suspended')throw new DomainError('المجموعة موقوفة',403);
        const previous = await loadGroupState(row);
        const command = input.command as Command;
        if (!command || typeof command.type !== 'string' || !command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload))
            throw new DomainError('إجراء غير صالح');
        if(command.type==='template.create'){for(const key of ['backgroundId','sourceId']){const value=command.payload[key];if(value){const [file]=await db.select().from(scoutFiles).where(eq(scoutFiles.id,String(value))).limit(1);if(!file||file.groupId!==groupId||file.purpose!=='background'||(key==='backgroundId'&&!file.mime.startsWith('image/')))throw new DomainError('خلفية القالب غير صالحة');}}}
        if(!previous.assignments.some(x=>x.userId===user.userId))throw new DomainError('ليس لك وصول لهذه المجموعة',403);
        const [recorded]=await db.select().from(scoutCommands).where(eq(scoutCommands.key,groupId+':'+command.id)).limit(1);if(recorded){if(recorded.actor!==user.userId||recorded.fingerprint!==await fingerprint(command))throw new DomainError('معرف العملية مستخدم لطلب مختلف',409);return response({ok:true,revision:row.revision,replayed:true});}
        if(command.type==='support.grant'&&!await operator(String(command.payload.operatorId)))throw new DomainError('حساب الدعم ليس من إدارة المنصة');
        const next = runCommand(previous, { userId: user.userId }, command, new Date().toISOString());
        if (next === previous)
            return response({ ok: true, revision: row.revision, replayed: true });
        if (revision !== row.revision)
            throw new DomainError('السجل اتعدل من مستخدم آخر. حدّث البيانات قبل المحاولة.', 409);
        const savedRevision=await saveGroupState(row,next,command,user.userId,new Date().toISOString());
        return response({ok:true,revision:savedRevision});
    }
    catch (error) {
        return failure(error);
    }
}
function failure(error: unknown) {
    if (error instanceof DomainError)
        return response({ error: error.message }, error.status);
    if (error instanceof SyntaxError)
        return response({ error: 'بيانات غير صالحة' }, 400);
    console.error('Scout operation failed');
    return response({ error: 'تعذر إتمام العملية. لم نؤكد حفظها.' }, 500);
}
