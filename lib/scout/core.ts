import {applyCashHandover,type CashHandover} from './finance-handover.ts';
import {applyGovernance,type SupportGrant} from './governance.ts';
import {applyDocuments,type Documents} from './documents.ts';
import {applyPeopleEvents,projectPeopleEvents,type PeopleEvents} from './people-events.ts';
import {applyOperations,afterOperations,checkMeetingItem,projectOperations,type Operations} from './operations.ts';
export type Role = 'general_leader' | 'priest' | 'secretary' | 'sector_leader' | 'team_leader' | 'treasurer' | 'member' | 'inventory_keeper' | 'curriculum_leader' | 'examiner';
export type Assignment = {
    userId: string;
    role: Role;
    title?:string;
    unit: string | null;
};
export type Actor = {
    userId: string;
};
export type Member = {
    stage?:string;
    id: string;
    name: string;
    profile?:{birthDate?:string;phone?:string;guardianName?:string;guardianPhone?:string;address?:string;education?:string};
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
    authorId?: string;
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
    itemId?:string;
    id: string;
    planId: string;
    title: string;
    date: string;
    executedAt: string | null;
    attendance: Record<string, 'present' | 'absent' | 'excused' | 'late'>;
    assessments: Record<string, 'passed' | 'not_passed'>;
};
export type Entry = {
    itemId?:string;
    itemRootId?:string;
    id: string;
    kind: 'donation' | 'expense' | 'transfer' | 'event_fee' | 'refund';
    boxId?: string;
    fromBoxId?: string;
    toBoxId?: string;
    amount: number;
    planId: string | null;
    title: string;
    at: string;
    actor: string;
};
export type GroupState = {
    cashHandovers?:CashHandover[];
    isTest?:boolean;
    testOwnerId?:string;
    supportGrants?:SupportGrant[];
    documents?:Documents;
    peopleEvents?:PeopleEvents;
    operations?:Operations;
    accountNames?:Record<string,string>;
    id: string;
    name: string;
    currency: string;
    inbox?: {
        id: string;
        userId: string;
        event: string;
        title: string;
        targetId: string;
        createdAt: string;
        readAt: string | null;
    }[];
    notificationPreferences?: {
        userId: string;
        event: string;
        enabled: boolean;
    }[];
    personAccounts?: {
        userId: string;
        memberId: string;
        linkedBy: string;
        linkedAt: string;
    }[];
    expenseRequests?: {
        id: string;
        boxId: string;
        planId: string | null;
        title: string;
        amount: number;
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
        paidEntryId: string | null;
    }[];
    boxes?: {
        id: string;
        name: string;
        unit: string | null;
        treasurerId: string;
    }[];
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
        payload?: Record<string, unknown>;
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
const text = (p: Record<string, unknown>, key: string, max = 180) => {
    const s = typeof p[key] === 'string' ? (p[key] as string).trim() : '';
    if (!s || s.length > max)
        throw new DomainError(`بيانات ${key} غير صالحة`);
    return s;
};
const money = (v: unknown) => {
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0 || v > 1000000000000)
        throw new DomainError('المبلغ يجب أن يكون عددًا صحيحًا موجبًا بالقروش');
    return v;
};
export function createGroup(id: string, name: string, leaderId: string): GroupState { return { id, name, currency: 'EGP', assignments: [{ userId: leaderId, role: 'general_leader', unit: null }], members: [], plans: [], meetings: [], entries: [], audit: [], processed: [] }; }
export function can(s: GroupState, a: Actor, permission: string, unit: string | null = null, at = new Date().toISOString()) {
    if (s.delegations?.some(d => d.userId === a.userId && !d.revokedAt && d.until > at && (d.unit === null || d.unit === unit) && d.permissions.includes(permission)))
        return true;
    const grants = s.assignments.filter(x => x.userId === a.userId);
    return grants.some(x => {
        if (x.role === 'general_leader')
            return true;
        if (x.unit !== null && x.unit !== unit && !(x.role === 'sector_leader' && unit !== null && isWithinUnit(s, x.unit, unit)))
            return false;
        const rights: Record<Role, string[]> = { general_leader: [], priest: ['read', 'approval.decide'], secretary: ['read', 'member.create', 'history.add','document.issue'], sector_leader: ['read', 'plan.create', 'plan.submit', 'meeting.create', 'meeting.record', 'finance.request'], team_leader: ['read', 'plan.create', 'plan.submit', 'meeting.create', 'meeting.record', 'finance.request'], treasurer: ['read', 'finance.donate', 'finance.pay', 'finance.request'], member: [],inventory_keeper:['read'],curriculum_leader:['read','curriculum.manage'],examiner:['read','meeting.record'] };
        return rights[x.role].includes(permission);
    });
}
export function runCommand(previous: GroupState, a: Actor, c: Command, at: string): GroupState {
    if (typeof c.id !== 'string' || !/^[\w-]{8,80}$/.test(c.id))
        throw new DomainError('معرّف العملية غير صالح');
    if (!previous.assignments.some(x => x.userId === a.userId))
        throw new DomainError('ليس لك وصول لهذه المجموعة', 403);
    if (previous.processed.includes(c.id))
        return previous;
    const s = structuredClone(previous), p = c.payload;
    const ensure = (permission: string, unit: string | null = null) => {
        if (!can(s, a, permission, unit, at))
            throw new DomainError('ليس لديك صلاحية لهذا الإجراء ضمن الوحدة', 403);
    };
    const findPlan = (id: string) => {
        const plan = s.plans.find(x => x.id === id);
        if (!plan)
            throw new DomainError('الخطة غير موجودة', 404);
        return plan;
    };
    checkMeetingItem(s,c);
    switch (c.type) {
        case 'delegation.grant': {
            if (!s.assignments.some(x => x.userId === a.userId && x.role === 'general_leader'))
                throw new DomainError('التفويض يصدر من القائد العام', 403);
            const userId = text(p, 'userId');
            if (!s.assignments.some(x => x.userId === userId && x.role !== 'member'))
                throw new DomainError('التفويض يحتاج قائدًا مكلفًا داخل المجموعة');
            const permissions = p.permissions;
            const allowed = ['roles.manage', 'plan.create', 'plan.submit', 'meeting.create', 'meeting.record', 'member.create', 'history.add','document.issue', 'finance.donate', 'finance.pay','support.authorize'];
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
            if (!Array.isArray(roles) || !roles.length || roles.length > 10 || new Set(roles).size !== roles.length || roles.some(r => !['general_leader', 'priest', 'secretary','sector_leader', 'team_leader', 'treasurer','inventory_keeper','curriculum_leader','examiner'].includes(r)))
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
            if (!['general_leader', 'priest', 'secretary', 'sector_leader', 'team_leader', 'treasurer', 'member','inventory_keeper','curriculum_leader','examiner'].includes(role))
                throw new DomainError('دور غير صالح');
            if (!s.assignments.some(x => x.userId === a.userId && x.role === 'general_leader') && (!['sector_leader', 'team_leader', 'treasurer', 'member'].includes(role) || !can(s, a, 'roles.manage', unit, at)))
                throw new DomainError('التفويض لا يمنح حق تعيين قيادة المجموعة أو خارج وحدته', 403);
            if (role === 'treasurer' && s.assignments.some(x => x.role === 'treasurer' && x.unit === unit))
                throw new DomainError('لكل صندوق أمين واحد؛ تغيير الأمين يحتاج تسليمًا مسجلًا');
            if (['general_leader', 'priest', 'secretary'].includes(role) && unit !== null)
                throw new DomainError('هذا الدور على مستوى المجموعة');
            if (s.assignments.some(x => x.userId === userId && x.role === role && x.unit === unit))
                throw new DomainError('التكليف موجود بالفعل');
            const title=typeof p.title==='string'?p.title.trim():undefined;if(title&&title.length>80)throw new DomainError('المسمى طويل');s.assignments.push({ userId, role, unit,title });
            break;
        }
        case 'notification.read': {
            const item = s.inbox?.find(x => x.id === text(p, 'notificationId') && x.userId === a.userId);
            if (!item)
                throw new DomainError('الإشعار غير موجود', 404);
            item.readAt ??= at;
            break;
        }
        case 'notification.preference': {
            const event = text(p, 'event');
            if (!['plan_submitted', 'plan_approved', 'admission_final', 'history_submitted', 'history_reviewed', 'meeting_recorded', 'expense_submitted'].includes(event) || typeof p.enabled !== 'boolean')
                throw new DomainError('إعداد إشعار غير صالح');
            s.notificationPreferences ??= [];
            s.notificationPreferences = s.notificationPreferences.filter(x => x.userId !== a.userId || x.event !== event);
            s.notificationPreferences.push({ userId: a.userId, event, enabled: p.enabled });
            break;
        }
        case 'account.bind': {
            ensure('roles.manage');
            const userId = text(p, 'userId'), memberId = text(p, 'memberId');
            const member = s.members.find(m => m.id === memberId);
            if (!member)
                throw new DomainError('الفرد غير موجود');
            s.personAccounts ??= [];
            if (s.personAccounts.some(x => x.userId === userId || x.memberId === memberId))
                throw new DomainError('الحساب أو الفرد مرتبط بالفعل؛ تغيير الربط يحتاج إجراء مراجعة مستقل');
            s.personAccounts.push({ userId, memberId, linkedBy: a.userId, linkedAt: at });
            if (!s.assignments.some(x => x.userId === userId))
                s.assignments.push({ userId, role: 'member', unit: member.team });
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
            const note = typeof p.note === 'string' ? p.note.trim() : '';
            if (note.length > 1000)
                throw new DomainError('الملاحظة أطول من المسموح');
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
            const member = s.members.find(m => m.id === text(p, 'memberId'));
            if (!member)
                throw new DomainError('الفرد غير موجود');
            if (!s.personAccounts?.some(x => x.userId === a.userId && x.memberId === member.id))
                ensure('history.add', member.team);
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
            const budget = p.budget === 0 ? 0 : money(p.budget);
            s.plans.push({ id: c.id, title: text(p, 'title'), scope: scope as Plan['scope'], unit, parentId, goal: text(p, 'goal', 1500), budget, authorId: a.userId, yearId, version: 1, status: 'draft', required: [], decisions: [] });
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
            const budget = p.budget === 0 ? 0 : money(p.budget);
            const spent = s.entries.filter(e => e.kind === 'expense' && s.plans.some(x => x.id === e.planId && (x.rootId ?? x.id) === rootId)).reduce((n, e) => n + e.amount, 0);
            if (budget < spent)
                throw new DomainError('ميزانية النسخة الجديدة أقل من المصروف الفعلي السابق');
            if (original.status === 'review')
                original.status = 'superseded';
            s.plans.push({ ...original, authorId: a.userId, id: c.id, rootId, previousVersionId: original.id, version: Math.max(...s.plans.filter(x => (x.rootId ?? x.id) === rootId).map(x => x.version)) + 1, title: text(p, 'title'), goal: text(p, 'goal', 1500), budget, status: 'draft', required: [], decisions: [] });
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
            plan.required = required.map(v => {
                if (!v || typeof v !== 'object')
                    throw new DomainError('معتمد غير صالح');
                const r = v as Assignment;
                const key = `${r.userId}:${r.role}`;
                if (seen.has(key) || !s.assignments.some(x => x.userId === r.userId && x.role === r.role && (x.unit === null || x.unit === plan.unit)))
                    throw new DomainError('معتمد مكرر أو غير مكلف بالنطاق');
                seen.add(key);
                return { userId: r.userId, role: r.role };
            });
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
            if (!member || !['trial', 'active', 'discussion'].includes(member.status) || (plan.scope === 'team' && member.team !== plan.unit)||(plan.scope==='sector'&&plan.unit!==null&&!isWithinUnit(s,plan.unit,member.team)))
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
        case 'cashbox.create': {
            ensure('roles.manage');
            const unit = typeof p.unit === 'string' && p.unit.trim() ? p.unit.trim() : null;
            const treasurerId = text(p, 'treasurerId');
            if (unit && !s.units?.some(u => u.id === unit && ['sector', 'team'].includes(u.kind)))
                throw new DomainError('الصندوق يتبع قطاعًا أو فريقًا صحيحًا');
            if (!s.assignments.some(x => x.userId === treasurerId && x.role === 'treasurer' && x.unit === unit))
                throw new DomainError('حدد أمين صندوق مكلفًا في نفس النطاق');
            s.boxes ??= [];
            if (s.boxes.some(b => b.unit === unit))
                throw new DomainError('يوجد صندوق لهذه الوحدة بالفعل');
            s.boxes.push({ id: unit ? c.id : 'central', name: text(p, 'name'), unit, treasurerId });
            break;
        }
        case 'finance.transfer': {
            const fromBoxId = text(p, 'fromBoxId'), toBoxId = text(p, 'toBoxId');
            if (fromBoxId === toBoxId)
                throw new DomainError('اختر صندوقين مختلفين');
            const from = s.boxes?.find(b => b.id === fromBoxId), to = s.boxes?.find(b => b.id === toBoxId);
            if (!from || !to)
                throw new DomainError('الصندوق غير موجود');
            ensure('finance.pay', from.unit);
            const amount = money(p.amount);
            if (cashBalance(s, from.id) < amount)
                throw new DomainError('رصيد الصندوق المصدر غير كافٍ');
            s.entries.push({ id: c.id, kind: 'transfer', amount, boxId: from.id, fromBoxId: from.id, toBoxId: to.id, planId: null, title: text(p, 'title'), at, actor: a.userId });
            break;
        }
        case 'expense.request': {
            const boxId = text(p, 'boxId');
            const box = s.boxes?.find(b => b.id === boxId);
            if (!box)
                throw new DomainError('حدد صندوقًا مجهزًا وأمينه');
            ensure('finance.request', box.unit);
            const unit = s.units?.find(u => u.id === box.unit);
            const leadRole: Role = box.unit === null ? 'general_leader' : unit?.kind === 'sector' ? 'sector_leader' : 'team_leader';
            const leaderId = text(p, 'leaderId'), treasurerId = text(p, 'treasurerId');
            for (const [userId, role] of [[leaderId, leadRole], [treasurerId, 'treasurer']] as [
                string,
                Role
            ][]) {
                if (!s.assignments.some(x => x.userId === userId && x.role === role && x.unit === box.unit))
                    throw new DomainError('المعتمد غير مكلف في نفس نطاق الصندوق');
            }
            if (treasurerId !== box.treasurerId)
                throw new DomainError('المعتمد المالي يجب أن يكون أمين الصندوق المعين');
            const planId = typeof p.planId === 'string' && p.planId ? p.planId : null;
            if (planId) {
                const plan = findPlan(planId);
                if (box.unit !== null && box.unit !== plan.unit)
                    throw new DomainError('الخطة خارج نطاق الصندوق');
            }
            s.expenseRequests ??= [];
            s.expenseRequests.push({ id: c.id, boxId, planId, title: text(p, 'title'), amount: money(p.amount), required: [{ userId: leaderId, role: leadRole }, { userId: treasurerId, role: 'treasurer' }], decisions: [], paidEntryId: null });
            break;
        }
        case 'expense.decide': {
            const item = s.expenseRequests?.find(x => x.id === text(p, 'requestId'));
            const role = text(p, 'role') as Role;
            const box = s.boxes?.find(b => b.id === item?.boxId);
            if (!item || !box || item.paidEntryId || !item.required.some(x => x.userId === a.userId && x.role === role) || !s.assignments.some(x => x.userId === a.userId && x.role === role && x.unit === box.unit))
                throw new DomainError('لست معتمدًا مكلفًا لهذا المصروف', 403);
            if (item.decisions.some(x => x.userId === a.userId && x.role === role))
                throw new DomainError('القرار مسجل بالفعل؛ أنشئ طلبًا جديدًا للتعديل');
            if (typeof p.approved !== 'boolean')
                throw new DomainError('قرار غير صالح');
            item.decisions.push({ userId: a.userId, role, approved: p.approved, at });
            break;
        }
        case 'finance.pay_request': {
            const item = s.expenseRequests?.find(x => x.id === text(p, 'requestId'));
            const box = s.boxes?.find(b => b.id === item?.boxId);
            if (!item || !box || item.paidEntryId)
                throw new DomainError('طلب المصروف غير متاح للدفع');
            ensure('finance.pay', box.unit);
            if (!item.required.every(r => item.decisions.some(d => d.userId === r.userId && d.role === r.role && d.approved)))
                throw new DomainError('يلزم اعتماد المسؤول وأمين الصندوق معًا');
            if (cashBalance(s, box.id) < item.amount)
                throw new DomainError('رصيد الصندوق غير كافٍ');
            s.entries.push({ id: c.id, kind: 'expense', boxId: box.id, planId: item.planId, title: item.title, amount: item.amount, at, actor: a.userId });
            item.paidEntryId = c.id;
            break;
        }
        case 'finance.donate': {
            const boxId = typeof p.boxId === 'string' && p.boxId ? p.boxId : 'central';
            const box = s.boxes?.find(b => b.id === boxId);
            if (boxId !== 'central' && !box)
                throw new DomainError('الصندوق غير موجود');
            ensure('finance.donate', box?.unit ?? null);
            s.entries.push({ id: c.id, kind: 'donation', boxId, amount: money(p.amount), planId: null, title: text(p, 'title'), at, actor: a.userId });
            break;
        }
        case 'finance.pay': {
            const plan = findPlan(text(p, 'planId'));
            const boxId = typeof p.boxId === 'string' && p.boxId ? p.boxId : 'central';
            const box = s.boxes?.find(b => b.id === boxId);
            if (boxId !== 'central' && !box)
                throw new DomainError('الصندوق غير موجود');
            ensure('finance.pay', box?.unit ?? null);
            ensure('finance.pay', plan.unit);
            if (box?.unit !== undefined && box.unit !== null && box.unit !== plan.unit)
                throw new DomainError('صندوق الوحدة لا يصرف على خطة وحدة أخرى');
            const amount = money(p.amount);
            const rootId = plan.rootId ?? plan.id;
            const spent = s.entries.filter(x => x.kind === 'expense' && s.plans.some(v => v.id === x.planId && (v.rootId ?? v.id) === rootId)).reduce((n, x) => n + x.amount, 0);
            let itemId:string|undefined,itemRootId:string|undefined;const planItems=s.operations?.items.filter(x=>x.planId===plan.id)??[];if(planItems.length){const item=planItems.find(x=>x.id===p.itemId);if(!item)throw new DomainError('حدد بند الصرف المعتمد');itemId=item.id;itemRootId=item.rootItemId??item.id;const itemSpent=s.entries.filter(e=>e.kind==='expense'&&e.itemRootId===itemRootId).reduce((n,e)=>n+e.amount,0);if(itemSpent+amount>item.budget)throw new DomainError('المصروف يتجاوز المتبقي في بند الميزانية');}
            const balance = cashBalance(s, boxId);
            if (plan.status !== 'approved' || spent + amount > plan.budget)
                throw new DomainError('الصرف يحتاج ميزانية معتمدة ورصيدًا كافيًا في البند');
            if (balance < amount)
                throw new DomainError('رصيد الصندوق غير كافٍ');
            s.entries.push({ id: c.id, kind: 'expense',itemId,itemRootId, boxId, amount, planId: plan.id, title: text(p, 'title'), at, actor: a.userId });
            break;
        }
        default: if(!applyCashHandover(s,a,c,at,ensure)&&!applyOperations(s,a,c,at,ensure)&&!applyPeopleEvents(s,a,c,at,ensure)&&!applyDocuments(s,a,c,at,ensure)&&!applyGovernance(s,a,c,at,ensure))throw new DomainError('الإجراء غير مدعوم');
    }
    afterOperations(s,c);
    const announce = (users: string[], event: string, title: string, targetId: string) => { s.inbox ??= []; for (const userId of new Set(users)) {
        if (!s.assignments.some(x => x.userId === userId) || s.notificationPreferences?.some(x => x.userId === userId && x.event === event && !x.enabled))
            continue;
        const id = c.id + ':' + userId;
        if (s.inbox.some(x => x.id === id))
            continue;
        s.inbox.push({ id, userId, event, title, targetId, createdAt: at, readAt: null });
    } };
    if (c.type === 'plan.submit') {
        const plan = s.plans.find(x => x.id === p.planId)!;
        announce(plan.required.map(x => x.userId), 'plan_submitted', 'خطة تحتاج مراجعتك: ' + plan.title, plan.id);
    }
    if (c.type === 'approval.decide') {
        const plan = s.plans.find(x => x.id === p.planId)!;
        if (plan.status === 'approved' && plan.authorId)
            announce([plan.authorId], 'plan_approved', 'اكتمل اعتماد الخطة: ' + plan.title, plan.id);
    }
    if (c.type === 'history.submit')
        announce(s.assignments.filter(x => x.role === 'secretary' && x.unit === null).map(x => x.userId), 'history_submitted', 'واقعة تاريخية تحتاج مراجعة السكرتارية', c.id);
    if (c.type === 'history.review') {
        const claim = s.claims?.find(x => x.id === p.claimId);
        if (claim)
            announce([claim.submittedBy], 'history_reviewed', 'تمت مراجعة واقعتك التاريخية: ' + claim.title, claim.id);
    }
    if (c.type === 'expense.request') {
        const item = s.expenseRequests?.find(x => x.id === c.id);
        if (item)
            announce(item.required.map(x => x.userId), 'expense_submitted', 'مصروف يحتاج قرارك: ' + item.title, item.id);
    }
    if (c.type === 'admission.decide') {
        const member = s.members.find(x => x.id === p.memberId);
        if (member && ['active', 'rejected'].includes(member.status))
            announce((s.personAccounts ?? []).filter(x => x.memberId === member.id).map(x => x.userId), 'admission_final', member.status === 'active' ? 'تم قبول انضمامك للمجموعة' : 'صدر قرار عدم قبول طلب الانضمام', member.id);
    }
    if (c.type === 'meeting.record')
        announce((s.personAccounts ?? []).filter(x => x.memberId === p.memberId).map(x => x.userId), 'meeting_recorded', 'تم تحديث حضورك وتقييمك في الاجتماع', String(p.meetingId));
    for (const member of s.members) {
        const latest = s.memberships?.filter(m => m.memberId === member.id).at(-1);
        if (latest)
            latest.status = member.status;
    }
    s.audit.push({ id: c.id, actor: a.userId, action: c.type, payload: structuredClone(c.payload), at });
    s.processed.push(c.id);
    return s;
}
export function groupReport(s: GroupState) { return { members: s.members.length, plannedMeetings: s.meetings.length, executedMeetings: s.meetings.filter(m => m.executedAt).length, income: s.entries.filter(e => ['donation','event_fee','refund'].includes(e.kind)).reduce((n, e) => n + (e.kind==='refund'?-e.amount:e.amount), 0), expenses: s.entries.filter(e => e.kind === 'expense').reduce((n, e) => n + e.amount, 0) }; }
/** A server-side projection. Never rely on hidden UI controls to protect tenant data. */
export function isWithinUnit(s: GroupState, ancestor: string, target: string): boolean {
    let current: string | null = target;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
        if (current === ancestor)
            return true;
        seen.add(current);
        current = s.units?.find(u => u.id === current)?.parentId ?? null;
    }
    return false;
}
export function projectGroup(s: GroupState, a: Actor): GroupState {
    const assigned = s.assignments.filter(x => x.userId === a.userId);
    if (!assigned.length)
        throw new DomainError('ليس لك وصول لهذه المجموعة', 403);
    if (assigned.some(x => x.role === 'general_leader'))
        return { ...s, inbox: s.inbox?.filter(x => x.userId === a.userId), notificationPreferences: s.notificationPreferences?.filter(x => x.userId === a.userId) };
    if (assigned.every(x => x.role === 'member'))
        throw new DomainError('واجهة الفرد متاحة في /me بعد ربط الحساب بالملف', 403);
    const roles = assigned.map(x => x.role), globalSecretary = assigned.some(x => x.role === 'secretary' && x.unit === null), priest = roles.includes('priest');
    const globalFinance = assigned.some(x => x.role === 'treasurer' && x.unit === null);
    const units = assigned.filter(x => ['team_leader', 'sector_leader','examiner'].includes(x.role)).map(x => x.unit);
    const operates=(unit:string|null)=>can(s,a,'meeting.record',unit)||can(s,a,'meeting.create',unit)||can(s,a,'plan.create',unit);
    const financeScope = (unit: string | null) => assigned.some(x => x.role === 'treasurer' && (x.unit === null || x.unit === unit));
    const visibleBoxes = s.boxes?.filter(b => financeScope(b.unit) || operates(b.unit));
    const visibleBoxIds = new Set(s.boxes?.filter(b => financeScope(b.unit)).map(b => b.id) ?? []);
    if (globalFinance)
        visibleBoxIds.add('central');
    const plans = s.plans.filter(p => globalSecretary || priest || globalFinance || financeScope(p.unit) || operates(p.unit) || p.required.some(r => r.userId === a.userId) || (p.scope === 'general' && p.status === 'approved'));
    const meetings = s.meetings.filter(m => { const p = s.plans.find(p => p.id === m.planId); return p && operates(p.unit); });
    const members = s.members.filter(m => globalSecretary || priest || operates(m.team));
    return {cashHandovers:s.cashHandovers?.filter(h=>[h.from,h.to,h.leaderId].includes(a.userId)).map(h=>({...h,snapshot:''})),isTest:s.isTest,accountNames:s.accountNames,documents:s.assignments.some(x=>x.userId===a.userId&&x.role==='secretary'&&x.unit===null)?s.documents:undefined,peopleEvents:projectPeopleEvents(s,a.userId,members.map(x=>x.id),plans.map(x=>x.id),globalFinance),operations:projectOperations(s,a), id: s.id, name: s.name, currency: s.currency, inbox: s.inbox?.filter(x => x.userId === a.userId), notificationPreferences: s.notificationPreferences?.filter(x => x.userId === a.userId), settings: s.settings, years: s.years, expenseRequests: s.expenseRequests?.filter(r => financeScope(s.boxes?.find(b => b.id === r.boxId)?.unit ?? null) || r.required.some(x => x.userId === a.userId)), boxes: visibleBoxes ?? [], memberships: s.memberships?.filter(m => members.some(person => person.id === m.memberId)), units: s.units?.filter(u => globalSecretary || priest || globalFinance || operates(u.id) || u.kind === 'sector'), plans, members: members.map(m => ({ ...m,profile:globalSecretary||assigned.some(x=>['team_leader','sector_leader'].includes(x.role)&&(x.unit===null||x.unit===m.team||(x.role==='sector_leader'&&isWithinUnit(s,x.unit!,m.team))))?m.profile:undefined, timeline: globalSecretary || assigned.some(x=>['team_leader','sector_leader'].includes(x.role)&&(x.unit===null||x.unit===m.team||(x.role==='sector_leader'&&isWithinUnit(s,x.unit!,m.team)))) ? m.timeline : [], admission: globalSecretary || priest ? m.admission : undefined })), meetings:meetings.map(m=>({...m,attendance:Object.fromEntries(Object.entries(m.attendance).filter(([id])=>members.some(x=>x.id===id))),assessments:Object.fromEntries(Object.entries(m.assessments).filter(([id])=>members.some(x=>x.id===id)))})), entries: globalFinance ? s.entries : s.entries.filter(e => e.kind === 'transfer' ? visibleBoxIds.has(e.fromBoxId ?? '') || visibleBoxIds.has(e.toBoxId ?? '') : visibleBoxIds.has(e.boxId ?? 'central')), assignments: s.assignments.filter(x => x.userId === a.userId || x.unit === null || units.includes(x.unit)), claims: globalSecretary ? s.claims : [], notifications: [], delegations: s.delegations?.filter(d => d.userId === a.userId), audit: s.audit.filter(x => x.actor === a.userId), processed: [] };
}
export function cashBalance(s: GroupState, boxId?: string): number { return s.entries.reduce((balance, e) => { if (e.kind === 'transfer')
    return boxId ? balance + (e.toBoxId === boxId ? e.amount : 0) - (e.fromBoxId === boxId ? e.amount : 0) : balance; if (boxId && (e.boxId ?? 'central') !== boxId)
    return balance; return balance + (['donation','event_fee'].includes(e.kind) ? e.amount : -e.amount); }, 0); }
export function individualProfile(s: GroupState, a: Actor) { const binding = s.personAccounts?.find(x => x.userId === a.userId); const member = s.members.find(m => m.id === binding?.memberId); if (!binding || !member || !s.assignments.some(x => x.userId === a.userId))
    throw new DomainError('حسابك غير مربوط بملف فرد في هذه المجموعة', 403); const visibleMember = {stage:member.stage,profile:member.profile, id: member.id, name: member.name, team: member.team, status: member.status, timeline: member.timeline.filter(t => t.type !== 'admission_decision') }; return { groupName: s.name, inbox: s.inbox?.filter(x => x.userId === a.userId) ?? [], member: visibleMember, plans: s.plans.filter(p => p.status === 'approved' && (p.scope === 'general' || (p.unit !== null && isWithinUnit(s, p.unit, member.team)))).map(p => ({ id: p.id, title: p.title, goal: p.goal })), meetings: s.meetings.filter(m => s.plans.some(p => p.id === m.planId && (p.scope === 'general' || (p.unit !== null && isWithinUnit(s, p.unit, member.team))))).map(m => ({ id: m.id, title: m.title, date: m.date, attendance: m.attendance[member.id] ?? null, assessment: meetingEvaluations(s,m)[member.id] ?? 'not_evaluated' })), claims: (s.claims ?? []).filter(c => c.memberId === member.id).map(c => ({ id: c.id, title: c.title, occurredAt: c.occurredAt, precision: c.precision, source: c.source, status: c.status, recordedAt: c.recordedAt })) }; }

export function meetingEvaluations(s:GroupState,m:Meeting):Record<string,'passed'|'not_passed'|'not_evaluated'>{const item=s.operations?.items.find(i=>i.id===m.itemId);if(!item?.lessonId)return m.assessments;const values:Record<string,'passed'|'not_passed'|'not_evaluated'>={};for(const id of Object.keys(m.attendance))values[id]=s.operations?.assessments.filter(a=>a.meetingId===m.id&&a.memberId===id&&a.lessonId===item.lessonId).at(-1)?.result??'not_evaluated';return values;}
