import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { platformOperators, scoutGroups, groupAccounts, trialRequests } from '../../../db/schema';
import { getChatGPTUser } from '../../chatgpt-auth';
import { createGroup, runCommand, DomainError, groupReport, projectGroup, individualProfile, type GroupState, type Command } from '../../../lib/scout/core';
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function identity() {
    const user = await getChatGPTUser();
    if (!user)
        throw new DomainError('سجّل الدخول أولًا', 401);
    return user;
}
async function operator(userId: string) { const rows = await getDb().select().from(platformOperators).where(eq(platformOperators.userId, userId)).limit(1); return rows.length > 0; }
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
        const state = JSON.parse(row.state) as GroupState;
        if (!state.assignments.some(a => a.userId === user.userId))
            throw new DomainError('ليس لك وصول لهذه المجموعة', 403);
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
            const state = createGroup(id, name, leaderId);
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
        const previous = JSON.parse(row.state) as GroupState;
        const command = input.command as Command;
        if (!command || typeof command.type !== 'string' || !command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload))
            throw new DomainError('إجراء غير صالح');
        const next = runCommand(previous, { userId: user.userId }, command, new Date().toISOString());
        if (next === previous)
            return response({ ok: true, revision: row.revision, replayed: true });
        if (revision !== row.revision)
            throw new DomainError('السجل اتعدل من مستخدم آخر. حدّث البيانات قبل المحاولة.', 409);
        const changed = await db.update(scoutGroups).set({ state: JSON.stringify(next), revision: row.revision + 1 }).where(and(eq(scoutGroups.id, groupId), eq(scoutGroups.revision, row.revision))).returning({ revision: scoutGroups.revision });
        if (!changed.length)
            throw new DomainError('تعارض في التحديث. حدّث البيانات.', 409);
        return response({ ok: true, revision: changed[0].revision });
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
