export type Role = 'general_leader' | 'priest' | 'secretary' | 'sector_leader' | 'team_leader' | 'treasurer' | 'member';
export type Assignment = {
    userId: string;
    role: Role;
    unit: string | null;
};
export type Actor = {
    userId: string;
};
export type Member = {
    id: string;
    name: string;
    team: string;
    status: 'applicant' | 'trial' | 'active' | 'discussion' | 'rejected';
    admission?: {
        role: 'general_leader' | 'priest';
        actor: string;
        approved: boolean;
        at: string;
    }[];
    timeline: {
        at: string;
        type: string;
        detail: string;
    }[];
};
export type Plan = {
    id: string;
    title: string;
    scope: 'general' | 'sector' | 'team';
    unit: string | null;
    parentId: string | null;
    goal: string;
    budget: number;
    yearId?: string;
    version: number;
    rootId?: string;
    previousVersionId?: string;
    status: 'draft' | 'review' | 'approved' | 'superseded';
    required: {
        userId: string;
        role: Role;
    }[];
    decisions: {
        userId: string;
        role: Role;
        approved: boolean;
        at: string;
    }[];
};
export type Meeting = {
    id: string;
    planId: string;
    title: string;
    date: string;
    executedAt: string | null;
    attendance: Record<string, 'present' | 'absent' | 'excused' | 'late'>;
    assessments: Record<string, 'passed' | 'not_passed'>;
};
export type Entry = {
    id: string;
    kind: 'donation' | 'expense';
    amount: number;
    planId: string | null;
    title: string;
    at: string;
    actor: string;
};
export type GroupState = {
    id: string;
    name: string;
    currency: string;
    years?: {
        id: string;
        name: string;
        startsOn: string;
        endsOn: string;
    }[];
    units?: {
        id: string;
        name: string;
        kind: 'sector' | 'team' | 'patrol';
        parentId: string | null;
    }[];
    memberships?: {
        id: string;
        memberId: string;
        yearId: string;
        teamId: string;
        status: 'applicant' | 'trial' | 'active' | 'discussion' | 'rejected';
    }[];
    settings?: {
        planApproverRoles: Role[];
    };
    delegations?: {
        id: string;
        userId: string;
        permissions: string[];
        unit: string | null;
        until: string;
        grantedBy: string;
        revokedAt: string | null;
    }[];
    assignments: Assignment[];
    members: Member[];
    plans: Plan[];
    meetings: Meeting[];
    entries: Entry[];
    audit: {
        id: string;
        actor: string;
        action: string;
        at: string;
    }[];
    processed: string[];
    claims?: {
        id: string;
        memberId: string;
        title: string;
        occurredAt: string;
        precision: 'day' | 'year' | 'approximate';
        source: string;
        submittedBy: string;
        recordedAt: string;
        status: 'pending' | 'approved' | 'rejected';
    }[];
    notifications?: {
        id: string;
        memberId: string;
        event: string;
        channel: 'whatsapp';
        status: 'provider_not_configured';
        at: string;
    }[];
};
export type Command = {
    id: string;
    type: string;
    payload: Record<string, unknown>;
};
export class DomainError extends Error {
    status: number;
    constructor(message: string, status = 400) { super(message); this.status = status; }
}
const text = (p: Record<string, unknown>, key: string, max = 180) => { const s = typeof p[key] === 'string' ? (p[key] as string).trim() : ''; if (!s || s.length > max)
    throw new DomainError(`بيانات ${key} غير صالحة`); return s; };
const money = (v: unknown) => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0 || v > 1000000000000)
    throw new DomainError('المبلغ يجب أن يكون عددًا صحيحًا موجبًا بالقروش'); return v; };
export function createGroup(id: string, name: string, leaderId: string): GroupState { return { id, name, currency: 'EGP', assignments: [{ userId: leaderId, role: 'general_leader', unit: null }], members: [], plans: [], meetings: [], entries: [], audit: [], processed: [] }; }
export function can(s: GroupState, a: Actor, permission: string, unit: string | null = null, at = new Date().toISOString()) { if (s.delegations?.some(d => d.userId === a.userId && !d.revokedAt && d.until > at && (d.unit === null || d.unit === unit) && d.permissions.includes(permission)))
    return true; const grants = s.assignments.filter(x => x.userId === a.userId); return grants.some(x => { if (x.role === 'general_leader')
    return true; if (x.unit !== null && x.unit !== unit && !(x.role === 'sector_leader' && unit !== null && isWithinUnit(s, x.unit, unit)))
    return false; const rights: Record<Role, string[]> = { general_leader: [], priest: ['read', 'approval.decide'], secretary: ['read', 'member.create', 'history.add'], sector_leader: ['read', 'plan.create', 'plan.submit', 'meeting.create', 'meeting.record'], team_leader: ['read', 'plan.create', 'plan.submit', 'meeting.create', 'meeting.record'], treasurer: ['read', 'finance.donate', 'finance.pay'], member: [] }; return rights[x.role].includes(permission); }); }
export function runCommand(previous: GroupState, a: Actor, c: Command, at: string): GroupState {
    if (typeof c.id!=='string'||!/^[\w-]{8,80}$/.test(c.id))
        throw new DomainError('معرّف العملية غير صالح');
    if (!previous.assignments.some(x => x.userId === a.userId))
        throw new DomainError('ليس لك وصول لهذه المجموعة', 403);
    if (previous.processed.includes(c.id))
        return previous;
    const s = structuredClone(previous), p = c.payload;
    const ensure = (permission: string, unit: string | null = null) => { if (!can(s, a, permission, unit, at))
        throw new DomainError('ليس لديك صلاحية لهذا الإجراء ضمن الوحدة', 403); };
    const findPlan = (id: string) => { const plan = s.plans.find(x => x.id === id); if (!plan)
        throw new DomainError('الخطة غير موجودة', 404); return plan; };
    switch (c.type) {
        case 'delegation.grant': {
            if (!s.assignments.some(x => x.userId === a.userId && x.role === 'general_leader'))
                throw new DomainError('التفويض يصدر من القائد العام', 403);
            const userId = text(p, 'userId');
            if (!s.assignments.some(x => x.userId === userId && x.role !== 'member'))
                throw new DomainError('التفويض يحتاج قائدًا مكلفًا داخل المجموعة');
            const permissions = p.permissions;
            const allowed = ['roles.manage', 'plan.create', 'plan.submit', 'meeting.create', 'meeting.record', 'member.create', 'history.add', 'finance.donate', 'finance.pay'];
            if (!Array.isArray(permissions) || !permissions.length || new Set(permissions).size !== permissions.length || permissions.some(v => typeof v !== 'string' || !allowed.includes(v)))
                throw new DomainError('صلاحيات التفويض غير صالحة');
            const until = text(p, 'until');
            if (!Number.isFinite(Date.parse(until)) || Date.parse(until) <= Date.parse(at))
                throw new DomainError('حدد نهاية مستقبلية للتفويض');
            s.delegations ??= [];
            s.delegations.push({ id: c.id, userId, permissions: permissions as string[], unit: typeof p.unit === 'string' && p.unit.trim() ? p.unit.trim() : null, until: new Date(until).toISOString(), grantedBy: a.userId, revokedAt: null });
            break;
        }
        case 'delegation.revoke': {
            if (!s.assignments.some(x => x.userId === a.userId && x.role === 'general_leader'))
                throw new DomainError('إلغاء التفويض للقائد العام', 403);
            const d = s.delegations?.find(x => x.id === text(p, 'delegationId'));
            if (!d || d.revokedAt)
                throw new DomainError('التفويض غير نشط');
            d.revokedAt = at;
            break;
        }
        case 'year.create': {
            ensure('roles.manage');
            const startsOn = text(p, 'startsOn'), endsOn = text(p, 'endsOn');
            for (const value of [startsOn, endsOn])
                if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
                    throw new DomainError('تاريخ السنة غير صالح');
            if (startsOn >= endsOn)
                throw new DomainError('نهاية السنة يجب أن تأتي بعد بدايتها');
            s.years ??= [];
            if (s.years.some(y => y.startsOn <= endsOn && y.endsOn >= startsOn))
                throw new DomainError('الفترة تتداخل مع سنة كشفية موجودة');
            s.years.push({ id: c.id, name: text(p, 'name'), startsOn, endsOn });
            break;
        }
        case 'unit.create': {
            ensure('roles.manage');
            const kind = text(p, 'kind');
            if (!['sector', 'team', 'patrol'].includes(kind))
                throw new DomainError('نوع وحدة غير صالح');
            const parentId = kind === 'sector' ? null : text(p, 'parentId');
            if (parentId && !s.units?.some(u => u.id === parentId && u.kind === (kind === 'team' ? 'sector' : 'team')))
                throw new DomainError('حدد الوحدة الأعلى الصحيحة');
            s.units ??= [];
            const name = text(p, 'name');
            if (s.units.some(u => u.name === name && u.parentId === parentId))
                throw new DomainError('اسم الوحدة موجود داخل نفس المستوى');
            s.units.push({ id: c.id, name, kind: kind as 'sector' | 'team' | 'patrol', parentId });
            break;
        }
        case 'approvals.configure': {
            ensure('roles.manage');
            const roles = p.roles;
            if (!Array.isArray(roles) || !roles.length || roles.length > 10 || new Set(roles).size !== roles.length || roles.some(r => !['general_leader', 'priest', 'secretary', 'team_leader', 'treasurer'].includes(r)))
                throw new DomainError('حدد قائمة معتمدين صحيحة');
            s.settings = { planApproverRoles: roles as Role[] };
            break;
        }
        case 'assignment.add': {
            const userId = text(p, 'userId'), role = text(p, 'role') as Role;
            const unit = typeof p.unit === 'string' && p.unit.trim() ? p.unit.trim() : null;
            ensure('roles.manage', unit);
            if (unit && s.units?.length && !s.units.some(u => u.id === unit))
                throw new DomainError('الوحدة غير موجودة');
            if (!['general_leader', 'priest', 'secretary', 'sector_leader', 'team_leader', 'treasurer', 'member'].includes(role))
                throw new DomainError('دور غير صالح');
            if (!s.assignments.some(x => x.userId === a.userId && x.role === 'general_leader') && (!['sector_leader', 'team_leader', 'treasurer', 'member'].includes(role) || !can(s, a, 'roles.manage', unit, at)))
                throw new DomainError('التفويض لا يمنح حق تعيين قيادة المجموعة أو خارج وحدته', 403);
            if (['general_leader', 'priest', 'secretary'].includes(role) && unit !== null)
                throw new DomainError('هذا الدور على مستوى المجموعة');
            if (s.assignments.some(x => x.userId === userId && x.role === role && x.unit === unit))
                throw new DomainError('التكليف موجود بالفعل');
            s.assignments.push({ userId, role, unit });
            break;
        }
        case 'member.create': {
            const team = text(p, 'team');
            ensure('member.create', team);
            const name = text(p, 'name');
            const id = c.id;
            let yearId: string | undefined;
            if (s.years?.length) {
                yearId = text(p, 'yearId');
                if (!s.years.some(y => y.id === yearId))
                    throw new DomainError('السنة الكشفية غير موجودة');
            }
            if (s.units?.length && !s.units.some(u => u.id === team && u.kind === 'team'))
                throw new DomainError('حدد فريقًا من الهيكل');
            if (yearId) {
                s.memberships ??= [];
                s.memberships.push({ id: c.id, memberId: id, yearId, teamId: team, status: 'applicant' });
            }
            s.members.push({ id, name, team, status: 'applicant', admission: [], timeline: [{ at, type: 'application_created', detail: 'إنشاء طلب انضمام' }] });
            break;
        }
        case 'admission.start_trial': {
            ensure('member.create');
            const member = s.members.find(m => m.id === text(p, 'memberId'));
            if (!member || member.status !== 'applicant')
                throw new DomainError('الطلب ليس جاهزًا لبدء التجربة');
            member.status = 'trial';
            member.timeline.push({ at, type: 'trial_started', detail: 'بدء المقابلة أو فترة التجربة' });
            break;
        }
        case 'admission.decide': {
            const member = s.members.find(m => m.id === text(p, 'memberId'));
            const role = text(p, 'role');
            if (!member || !['trial', 'discussion'].includes(member.status) || !['general_leader', 'priest'].includes(role) || !s.assignments.some(x => x.userId === a.userId && x.role === role && x.unit === null))
                throw new DomainError('قرار القبول يحتاج مسؤولًا مخولًا وطلبًا بعد المقابلة أو التجربة', 403);
            if (typeof p.approved !== 'boolean')
                throw new DomainError('قرار غير صالح');
            const note = typeof p.note === 'string' ? p.note.trim() : '';if(note.length>1000)throw new DomainError('الملاحظة أطول من المسموح');
            if (!p.approved && !note)
                throw new DomainError('حدد سبب عدم القبول للمراجعة الداخلية');
            member.admission ??= [];
            member.admission.push({ role: role as 'general_leader' | 'priest', actor: a.userId, approved: p.approved, at });
            const latest = (r: string) => member.admission!.filter(x => x.role === r).at(-1);
            const leader = latest('general_leader'), priest = latest('priest');
            if (leader && priest) {
                member.status = leader.approved && priest.approved ? 'active' : !leader.approved && !priest.approved ? 'rejected' : 'discussion';
                if (member.status === 'active' || member.status === 'rejected') {
                    s.notifications ??= [];
                    s.notifications.push({ id: c.id, memberId: member.id, event: member.status === 'active' ? 'admission_accepted' : 'admission_rejected', channel: 'whatsapp', status: 'provider_not_configured', at });
                }
            }
            member.timeline.push({ at, type: 'admission_decision', detail: `قرار ${role}: ${p.approved ? 'موافقة' : 'للمناقشة'}${note ? ' — ' + note : ''}` });
            break;
        }
        case 'history.submit': {
            ensure('history.add');
            const member = s.members.find(m => m.id === text(p, 'memberId'));
            if (!member)
                throw new DomainError('الفرد غير موجود');
            const occurredAt = text(p, 'occurredAt'), precision = text(p, 'precision');
            if (!['day', 'year', 'approximate'].includes(precision) || (precision === 'year' && !/^\d{4}$/.test(occurredAt)) || (precision === 'day' && (!/^\d{4}-\d{2}-\d{2}$/.test(occurredAt) || !Number.isFinite(Date.parse(occurredAt)) || new Date(occurredAt).toISOString().slice(0, 10) !== occurredAt)))
                throw new DomainError('حدد تاريخ الواقعة ودقته');
            s.claims ??= [];
            s.claims.push({ id: c.id, memberId: member.id, title: text(p, 'title'), occurredAt, precision: precision as 'day' | 'year' | 'approximate', source: text(p, 'source', 1000), submittedBy: a.userId, recordedAt: at, status: 'pending' });
            break;
        }
        case 'history.review': {
            if (!s.assignments.some(x => x.userId === a.userId && x.role === 'secretary' && x.unit === null))
                throw new DomainError('اعتماد التاريخ للسكرتارية المكلفة', 403);
            const claim = s.claims?.find(x => x.id === text(p, 'claimId'));
            if (!claim || claim.status !== 'pending' || typeof p.approved !== 'boolean')
                throw new DomainError('طلب تاريخ غير صالح');
            claim.status = p.approved ? 'approved' : 'rejected';
            const member = s.members.find(m => m.id === claim.memberId)!;
            member.timeline.push({ at, type: 'historical_claim_reviewed', detail: `${claim.title} — الواقعة: ${claim.occurredAt} (${claim.precision}) — ${p.approved ? 'معتمد' : 'غير معتمد'} — المصدر: ${claim.source}` });
            break;
        }
        case 'plan.create': {
            const scope = text(p, 'scope');
            if (!['general', 'sector', 'team'].includes(scope))
                throw new DomainError('نطاق الخطة غير صالح');
            const unit = scope === 'general' ? null : text(p, 'unit');
            ensure('plan.create', unit);
            if (scope === 'general' && !s.assignments.some(x => x.userId === a.userId && x.role === 'general_leader'))
                throw new DomainError('الخطة العامة للقيادة العامة', 403);
            const parentId = typeof p.parentId === 'string' && p.parentId ? p.parentId : null;
            if (scope !== 'general') {
                const parent = parentId ? findPlan(parentId) : null;
                if (!parent || parent.scope !== (scope === 'sector' ? 'general' : 'sector'))
                    throw new DomainError('يجب ربط الخطة بمستواها الأعلى');
            }
            const yearId = s.years?.length ? text(p, 'yearId') : undefined;
            if (parentId && yearId && findPlan(parentId).yearId !== yearId)
                throw new DomainError('الخطة الأعلى من سنة كشفية مختلفة');
            if (yearId && !s.years?.some(y => y.id === yearId))
                throw new DomainError('السنة غير موجودة');
            if (scope !== 'general' && s.units?.length && !s.units.some(u => u.id === unit && u.kind === scope))
                throw new DomainError('الوحدة لا تطابق مستوى الخطة');
            const budget = p.budget===0?0:money(p.budget);
            s.plans.push({ id: c.id, title: text(p, 'title'), scope: scope as Plan['scope'], unit, parentId, goal: text(p, 'goal', 1500), budget, yearId, version: 1, status: 'draft', required: [], decisions: [] });
            break;
        }
        case 'plan.revise': {
            const original = findPlan(text(p, 'planId'));
            ensure('plan.create', original.unit);
            if (original.scope === 'general' && !s.assignments.some(x => x.userId === a.userId && x.role === 'general_leader'))
                throw new DomainError('تعديل الخطة العامة للقيادة العامة', 403);
            if (!['approved', 'review'].includes(original.status))
                throw new DomainError('افتح إصدارًا من خطة مرسلة أو معتمدة');
            const rootId = original.rootId ?? original.id;
            if (s.plans.some(x => (x.rootId ?? x.id) === rootId && x.id !== original.id && ['draft', 'review'].includes(x.status)))
                throw new DomainError('توجد نسخة مفتوحة بالفعل لهذه الخطة');
            const budget = p.budget===0?0:money(p.budget);
            const spent = s.entries.filter(e => e.kind === 'expense' && s.plans.some(x => x.id === e.planId && (x.rootId ?? x.id) === rootId)).reduce((n, e) => n + e.amount, 0);
            if (budget < spent)
                throw new DomainError('ميزانية النسخة الجديدة أقل من المصروف الفعلي السابق');
            if (original.status === 'review')
                original.status = 'superseded';
            s.plans.push({ ...original, id: c.id, rootId, previousVersionId: original.id, version: Math.max(...s.plans.filter(x => (x.rootId ?? x.id) === rootId).map(x => x.version)) + 1, title: text(p, 'title'), goal: text(p, 'goal', 1500), budget, status: 'draft', required: [], decisions: [] });
            break;
        }
        case 'plan.submit': {
            const plan = findPlan(text(p, 'planId'));
            ensure('plan.submit', plan.unit);
            if (plan.rootId && s.plans.some(x => x.id !== plan.id && (x.rootId ?? x.id) === plan.rootId && x.status === 'review' && x.version < plan.version))
                throw new DomainError('النسخة السابقة ما زالت قيد المراجعة');
            if (plan.status !== 'draft')
                throw new DomainError('الخطة ليست مسودة');
            const required = p.required;
            if (!Array.isArray(required) || required.length === 0 || required.length > 12)
                throw new DomainError('حدد المعتمدين المطلوبين');
            const seen = new Set<string>();
            const requiredRoles = s.settings?.planApproverRoles ?? ['priest', 'general_leader', 'team_leader', 'secretary'];
            if (!requiredRoles.every(role => required.some(v => v && typeof v === 'object' && (v as Assignment).role === role)))
                throw new DomainError('يلزم تحديد جميع الأدوار المطلوبة في مسار الاعتماد');
            plan.required = required.map(v => { if (!v || typeof v !== 'object')
                throw new DomainError('معتمد غير صالح'); const r = v as Assignment; const key = `${r.userId}:${r.role}`; if (seen.has(key) || !s.assignments.some(x => x.userId === r.userId && x.role === r.role && (x.unit === null || x.unit === plan.unit)))
                throw new DomainError('معتمد مكرر أو غير مكلف بالنطاق'); seen.add(key); return { userId: r.userId, role: r.role }; });
            plan.status = 'review';
            break;
        }
        case 'approval.decide': {
            const plan = findPlan(text(p, 'planId'));
            const role = text(p, 'role') as Role;
            if (plan.status !== 'review' || !plan.required.some(x => x.userId === a.userId && x.role === role) || !s.assignments.some(x => x.userId === a.userId && x.role === role && (x.unit === null || x.unit === plan.unit)))
                throw new DomainError('لست من المعتمدين المكلفين بهذه النسخة', 403);
            if (typeof p.approved !== 'boolean')
                throw new DomainError('القرار غير صالح');
            if (plan.decisions.some(x => x.userId === a.userId && x.role === role))
                throw new DomainError('سبق تسجيل القرار؛ افتح نسخة جديدة للمراجعة');
            plan.decisions.push({ userId: a.userId, role, approved: p.approved, at });
            if (plan.required.every(r => plan.decisions.some(d => d.userId === r.userId && d.role === r.role && d.approved))) {
                const rootId = plan.rootId ?? plan.id;
                const spent = s.entries.filter(e => e.kind === 'expense' && s.plans.some(x => x.id === e.planId && (x.rootId ?? x.id) === rootId)).reduce((n, e) => n + e.amount, 0);
                if (plan.budget < spent)
                    throw new DomainError('المصروف زاد أثناء المراجعة؛ عدل الميزانية في نسخة جديدة');
                for (const old of s.plans)
                    if (old.id !== plan.id && (old.rootId ?? old.id) === rootId && old.status === 'approved')
                        old.status = 'superseded';
                plan.status = 'approved';
            }
            break;
        }
        case 'meeting.create': {
            const plan = findPlan(text(p, 'planId'));
            ensure('meeting.create', plan.unit);
            if (plan.status !== 'approved')
                throw new DomainError('يجب اعتماد الخطة أولًا');
            const date = text(p, 'date');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))
                throw new DomainError('تاريخ غير صالح');
            s.meetings.push({ id: c.id, planId: plan.id, title: text(p, 'title'), date, executedAt: null, attendance: {}, assessments: {} });
            break;
        }
        case 'meeting.record': {
            const meeting = s.meetings.find(x => x.id === text(p, 'meetingId'));
            if (!meeting)
                throw new DomainError('الاجتماع غير موجود');
            const plan = findPlan(meeting.planId);
            ensure('meeting.record', plan.unit);
            const member = s.members.find(x => x.id === text(p, 'memberId'));
            if (!member || !['trial', 'active', 'discussion'].includes(member.status) || (plan.scope === 'team' && member.team !== plan.unit))
                throw new DomainError('الفرد خارج نطاق الاجتماع');
            const attendance = text(p, 'attendance');
            if (!['present', 'absent', 'excused', 'late'].includes(attendance))
                throw new DomainError('حالة حضور غير صالحة');
            meeting.attendance[member.id] = attendance as Meeting['attendance'][string];
            if (p.assessment) {
                if (!['passed', 'not_passed'].includes(String(p.assessment)) || !['present', 'late'].includes(attendance))
                    throw new DomainError('لا يمكن إثبات تقييم غائب في هذا الاجتماع');
                meeting.assessments[member.id] = p.assessment as 'passed' | 'not_passed';
            }
            else
                delete meeting.assessments[member.id];
            meeting.executedAt = at;
            member.timeline.push({ at, type: 'meeting_updated', detail: `${meeting.title}: ${attendance}${p.assessment ? ` / ${p.assessment}` : ''}` });
            break;
        }
        case 'finance.donate': {
            ensure('finance.donate');
            s.entries.push({ id: c.id, kind: 'donation', amount: money(p.amount), planId: null, title: text(p, 'title'), at, actor: a.userId });
            break;
        }
        case 'finance.pay': {
            const plan = findPlan(text(p, 'planId'));
            ensure('finance.pay', plan.unit);
            const amount = money(p.amount);
            const rootId = plan.rootId ?? plan.id;
            const spent = s.entries.filter(x => x.kind === 'expense' && s.plans.some(v => v.id === x.planId && (v.rootId ?? v.id) === rootId)).reduce((n, x) => n + x.amount, 0);
            const balance = s.entries.reduce((n, x) => n + (x.kind === 'donation' ? x.amount : -x.amount), 0);
            if (plan.status !== 'approved' || spent + amount > plan.budget)
                throw new DomainError('الصرف يحتاج ميزانية معتمدة ورصيدًا كافيًا في البند');
            if (balance < amount)
                throw new DomainError('رصيد الصندوق غير كافٍ');
            s.entries.push({ id: c.id, kind: 'expense', amount, planId: plan.id, title: text(p, 'title'), at, actor: a.userId });
            break;
        }
        default: throw new DomainError('الإجراء غير مدعوم');
    }
    for (const member of s.members) {
        const latest = s.memberships?.filter(m => m.memberId === member.id).at(-1);
        if (latest)
            latest.status = member.status;
    }
    s.audit.push({ id: c.id, actor: a.userId, action: c.type, at });
    s.processed.push(c.id);
    return s;
}
export function groupReport(s: GroupState) { return { members: s.members.length, plannedMeetings: s.meetings.length, executedMeetings: s.meetings.filter(m => m.executedAt).length, income: s.entries.filter(e => e.kind === 'donation').reduce((n, e) => n + e.amount, 0), expenses: s.entries.filter(e => e.kind === 'expense').reduce((n, e) => n + e.amount, 0) }; }
/** A server-side projection. Never rely on hidden UI controls to protect tenant data. */
export function isWithinUnit(s: GroupState, ancestor: string, target: string): boolean { let current: string | null = target; const seen = new Set<string>(); while (current && !seen.has(current)) {
    if (current === ancestor)
        return true;
    seen.add(current);
    current = s.units?.find(u => u.id === current)?.parentId ?? null;
} return false; }
export function projectGroup(s: GroupState, a: Actor): GroupState {
    const assigned = s.assignments.filter(x => x.userId === a.userId);
    if (!assigned.length)
        throw new DomainError('ليس لك وصول لهذه المجموعة', 403);
    if (assigned.some(x => x.role === 'general_leader'))
        return s;
    if (assigned.every(x => x.role === 'member'))
        throw new DomainError('واجهة الفرد وربط حسابه بالملف لم تكتمل بعد', 403);
    const roles = assigned.map(x => x.role), globalSecretary = assigned.some(x => x.role === 'secretary' && x.unit === null), priest = roles.includes('priest');
    const globalFinance = assigned.some(x => x.role === 'treasurer' && x.unit === null);
    const units = assigned.filter(x => ['team_leader', 'sector_leader'].includes(x.role)).map(x => x.unit);
    const operates = (unit: string | null) => units.includes(null) || unit !== null && units.includes(unit) || assigned.some(x => x.role === 'sector_leader' && x.unit !== null && unit !== null && isWithinUnit(s, x.unit, unit));
    const plans = s.plans.filter(p => globalSecretary || priest || globalFinance || operates(p.unit) || p.required.some(r => r.userId === a.userId) || (p.scope === 'general' && p.status === 'approved'));
    const meetings = s.meetings.filter(m => { const p = s.plans.find(p => p.id === m.planId); return p && operates(p.unit); });
    const members = s.members.filter(m => globalSecretary || priest || operates(m.team));
    return { ...s, memberships: s.memberships?.filter(m => members.some(person => person.id === m.memberId)), units: s.units?.filter(u => globalSecretary || priest || globalFinance || operates(u.id) || u.kind === 'sector'), plans, members: members.map(m => ({ ...m, timeline: globalSecretary || operates(m.team) ? m.timeline : [], admission: globalSecretary || priest ? m.admission : undefined })), meetings, entries: globalFinance ? s.entries : [], assignments: s.assignments.filter(x => x.userId === a.userId || x.unit === null || units.includes(x.unit)), claims: globalSecretary ? s.claims : [], notifications: [], delegations: s.delegations?.filter(d => d.userId === a.userId), audit: s.audit.filter(x => x.actor === a.userId), processed: [] };
}
