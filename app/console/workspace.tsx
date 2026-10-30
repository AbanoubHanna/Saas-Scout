'use client';
import BackupPanel from './backup-panel';
import AccessPanel from './access-panel';
import FilesDocuments from './files-documents';
import OperationsPanel from './operations-panel';
import { useEffect, useState, useRef, type FormEvent } from 'react';
import { can, cashBalance,meetingEvaluations, type GroupState, type Role } from '../../lib/scout/core';
import { pendingRecords, savePending, removePending,storeOfflinePack, type PendingRecord } from '../../lib/scout/offline';
type Session = {
    user: {
        id: string;
        name: string;
    };
    isOperator: boolean;
    groups: {
        id: string;
        name: string;
    }[];
    trials: {
        id: string;
        groupName: string;
        church: string;
        leaderName: string;
    }[];
};
export default function Workspace() {
    const [session, setSession] = useState<Session | null>(null), [group, setGroup] = useState(''), [state, setState] = useState<GroupState | null>(null), [revision, setRevision] = useState(0), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    const [area, setArea] = useState('overview');
    const [queue, setQueue] = useState<PendingRecord[]>([]);
    const activeGroup = useRef('');
    const pending = useRef<{
        fingerprint: string;
        id: string;
    } | null>(null);
    async function load(id = group) {
        if (id && activeGroup.current !== id)
            return;
        const r = await fetch('/api/scout' + (id ? '?group=' + encodeURIComponent(id) : ''), { cache: 'no-store' });
        const d = await r.json() as Session & {
            state: GroupState;
            revision: number;
            error?: string;
        };
        if (!r.ok)
            throw Error(d.error);
        if (id) {
            if (activeGroup.current !== id)
                return;
            setState(d.state);
            setRevision(d.revision);
        }
        else
            setSession(d);
    }
    useEffect(() => { load('').catch(e => setError(e.message)); }, []);
    async function refreshQueue() {
        if (session && group)
            setQueue(await pendingRecords(session.user.id, group));
        else
            setQueue([]);
    }
    useEffect(() => { refreshQueue().catch(() => setError('الحفظ على الجهاز غير متاح في هذا المتصفح')); }, [group, session]);
    async function syncQueue() {
        if (!session || !group || busy)
            return;
        setBusy(true);
        setError('');
        try {
            for (const item of await pendingRecords(session.user.id, group)) {
                const current = await fetch('/api/scout?group=' + encodeURIComponent(group), { cache: 'no-store' });
                if (!current.ok)
                    throw Error('تعذر التحقق من الحساب قبل المزامنة');
                const snapshot = await current.json() as {
                    state: GroupState;
                    revision: number;
                };
                if (snapshot.state.audit.some(a => a.id === item.id && a.actor === session.user.id)) {
                    await removePending(item.id);
                    continue;
                }
                const meeting = snapshot.state.meetings.find(m => m.id === item.command.payload.meetingId), memberId = String(item.command.payload.memberId);
                const base = { attendance: meeting?.attendance[memberId] ?? null, assessment: meeting?.assessments[memberId] ?? null };const signature=item.command.type==='meeting.deliver'?JSON.stringify(snapshot.state.operations?.deliveries.filter(x=>x.meetingId===item.command.payload.meetingId).at(-1)??null):item.command.type==='lesson.assess'?JSON.stringify(snapshot.state.operations?.assessments.filter(x=>x.meetingId===item.command.payload.meetingId&&x.memberId===item.command.payload.memberId&&x.lessonId===item.command.payload.lessonId).at(-1)??null):null;
                if (!meeting || (item.signature!==undefined?signature!==item.signature:base.attendance !== item.base.attendance || base.assessment !== item.base.assessment)) {
                    await savePending({ ...item, status: 'conflict' });
                    continue;
                }
                const r = await fetch('/api/scout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: group, revision: snapshot.revision, command: item.command }) });
                if (!r.ok) {
                    if (r.status === 409) {
                        await savePending({ ...item, status: 'conflict' });
                        continue;
                    }
                    throw Error('المزامنة مرفوضة؛ راجع التكليف أو حالة الفرد');
                }
                await removePending(item.id);
            }
            await load(group);
            await refreshQueue();
            setMessage('انتهت المحاولة. أي تعارض يحتاج مراجعة قبل اعتماده.');
        }
        catch (x) {
            setError(x instanceof Error ? x.message : 'الاتصال غير متاح');
        }
        finally {
            setBusy(false);
        }
    }
    async function submit(e: FormEvent<HTMLFormElement>, type: string) {
        e.preventDefault();
        if (busy)
            return;
        setBusy(true);
        setError('');
        setMessage('');
        const form = e.currentTarget;
        const fields = Object.fromEntries(new FormData(form));
        let offlineItem: PendingRecord | null = null;
        try {
            let payload: Record<string, unknown> = { ...fields };
            for (const key of ['amount', 'budget'])
                if (key in payload) {
                    const raw = String(payload[key]);
                    if (!/^\d+(\.\d{1,2})?$/.test(raw))
                        throw Error('المبلغ يحتاج رقمًا موجبًا بحد أقصى منزلتين');
                    payload[key] = Math.round(Number(raw) * 100);
                }
            if (type === 'plan.submit') {
                payload.required = (state?.settings?.planApproverRoles ?? ['priest', 'general_leader', 'team_leader', 'secretary']).map(role => ({ userId: fields['approver:' + role], role }));
            }
            if (type === 'delegation.grant')
                payload.until = new Date(String(fields.until)).toISOString();
            if (type === 'delegation.grant')
                payload.permissions = new FormData(form).getAll('permissions');
            if (type === 'approvals.configure')
                payload.roles = new FormData(form).getAll('roles');
            if (['approval.decide', 'admission.decide', 'history.review', 'expense.decide', 'notification.preference'].includes(type))
                payload.approved = fields.approved === 'yes';
            if (type === 'notification.preference')
                payload.enabled = fields.enabled === 'yes';
            const fingerprint = JSON.stringify({ group, type, payload });
            if (pending.current?.fingerprint !== fingerprint)
                pending.current = { fingerprint, id: crypto.randomUUID() };
            const body = type === 'group.create' ? { type, ...payload } : { groupId: group, revision, command: { id: pending.current.id, type, payload } };
            if (type === 'meeting.record' && state && session) {
                const meeting = state.meetings.find(m => m.id === fields.meetingId), memberId = String(fields.memberId);
                offlineItem = { id: pending.current.id, userId: session.user.id, groupId: group, revision, command: { id: pending.current.id, type, payload }, base: { attendance: meeting?.attendance[memberId] ?? null, assessment: meeting?.assessments[memberId] ?? null }, status: 'pending', createdAt: new Date().toISOString() };
            }
            const r = await fetch('/api/scout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const d = await r.json() as Session & {
                state: GroupState;
                revision: number;
                error?: string;
            };
            if (!r.ok) {
                offlineItem = null;
                throw Error(d.error);
            }
            if (offlineItem)
                await removePending(offlineItem.id);
            offlineItem = null;
            await load(type === 'group.create' ? '' : group);
            form.reset();
            pending.current = null;
            setMessage('تم الحفظ على الخادم.');
        }
        catch (e) {
            if (offlineItem) {
                try {
                    await savePending(offlineItem);
                    await refreshQueue();
                    pending.current = null;
                    setMessage('محفوظ على هذا الجهاز فقط، ولم نؤكد تسجيله على الخادم. استخدم المزامنة بعد عودة الاتصال.');
                }
                catch {
                    setError('تعذر الحفظ على الخادم وعلى الجهاز؛ احتفظ بالبيانات وأعد المحاولة.');
                }
            }
            else
                setError(e instanceof Error ? e.message : 'تعذر الحفظ');
        }
        finally {
            setBusy(false);
        }
    }
    const allowed = (permission: string) => !!state && !!session && can(state, { userId: session.user.id }, permission);
    const available=(permission:string)=>!!state&&!!session&&[null,...(state.units?.map(u=>u.id)??[]),...state.assignments.filter(a=>a.userId===session.user.id).map(a=>a.unit)].some(unit=>can(state,{userId:session.user.id},permission,unit));
    const hasFinance = allowed('finance.donate') || !!state?.assignments.some(a => a.userId === session?.user.id && a.role === 'treasurer');
    const isGeneral = !!state && !!session && state.assignments.some(a => a.userId === session.user.id && a.role === 'general_leader');
    const money = (n: number) => (n / 100).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' });
    const roleNames: Record<string, string> = { general_leader: 'القائد العام', priest: 'الكاهن', secretary: 'السكرتارية', sector_leader: 'قائد القطاع', team_leader: 'قائد الفريق', treasurer: 'أمين الصندوق', member: 'الفرد',inventory_keeper:'أمين العهدة',curriculum_leader:'مسؤول المناهج',examiner:'مسؤول الاختبار' };
    const yearField = state?.years?.length ? <label>السنة الكشفية<select name="yearId" required>{state.years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label> : null;
    const unitName = (id: string | null) => state?.units?.find(u => u.id === id)?.name ?? id;
    const unitField = state?.units?.length ? <label>الوحدة<select name="unit"><option value="">المجموعة كلها</option>{state.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label> : <label>الوحدة<input name="unit"/></label>;
    const boxField = state?.boxes?.length ? <label>الصندوق<select name="boxId">{state.boxes.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label> : null;
    const planOptions = state?.plans.map(p => <option key={p.id} value={p.id}>{p.title} — {p.status === 'approved' ? 'معتمدة' : p.status === 'review' ? 'قيد الاعتماد' : p.status === 'superseded' ? 'نسخة سابقة' : 'مسودة'}</option>);
    return <div className="workspace-main"><div aria-live="polite">{error ? <p role="alert" className="workspace-error">{error}</p> : null}{message ? <p className="workspace-success">{message}</p> : null}</div>{!session ? <p>تحميل الحساب…</p> : <><span className="app-eyebrow">كل تفاصيل مجموعتك، في مكان واحد</span><h1>مساحة المجموعة</h1><p>ابدأ باختيار مجموعتك. تابع أفرادها وخططها، وشوف أثر كل اجتماع ونشاط.</p><label>المجموعة<select value={group} onChange={async (e) => {
                activeGroup.current = e.target.value;
                setGroup(e.target.value);
                setState(null);
                setError('');
                if (e.target.value)
                    try {
                        await load(e.target.value);
                    }
                    catch (x) {
                        setError((x as Error).message);
                    }
            }}><option value="">اختار المجموعة</option>{session.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>{session.isOperator ? <details className="workspace-panel app-tools"><summary>طلبات تجربة المجموعات وإدارة المنصة</summary><p><a href="/platform">فتح إدارة المنصة والاشتراكات والدعم</a></p>{session.trials.length === 0 ? <p>لا توجد طلبات.</p> : <form onSubmit={e => submit(e, 'group.create')}><label>طلب التجربة<select name="trialId" required><option value="">اختار الطلب</option>{session.trials.map(t => <option key={t.id} value={t.id}>{t.groupName} — {t.church}</option>)}</select></label><label>اسم المجموعة<input name="name" required maxLength={120}/></label><label>معرّف حساب القائد العام<input name="leaderId" required defaultValue={session.user.id}/></label><button disabled={busy}>تجهيز المجموعة وربط حساب قائدها</button></form>}</details> : null}{state ? <><h2>{state.name}</h2>{state.isTest?<p className="workspace-notice">مساحة اختبار ببيانات وهمية. افتح حسابًا آخر من <a href="/test-login">دخول التجربة</a> لاختبار الصلاحيات.</p>:null}<details className="workspace-panel app-tools"><summary>العمل دون اتصال والمزامنة · {queue.length} عملية معلّقة</summary><button disabled={busy} onClick={async()=>{try{const r=await fetch('/api/scout?group='+encodeURIComponent(group)+'&view=offline',{cache:'no-store'});const d=await r.json() as {pack:unknown;error?:string};if(!r.ok)throw Error(d.error);await storeOfflinePack(d.pack);setMessage('حُفظت أسماء الأفراد واجتماعاتك على هذا الجهاز لمدة يوم للعمل دون اتصال. تسجيل الخروج يمسح نسخة الجهاز.');}catch(x){setError((x as Error).message);}}}>حفظ أسماء الأفراد والاجتماعات على جهازي للعمل دون اتصال</button><p>احفظ نسخة محدودة على جهازك الموثوق قبل الخروج من نطاق الإنترنت. يمكن بعدها إعادة فتح واجهة الموبايل وتسجيل الحضور والتنفيذ والتقييم دون اتصال؛ الاعتمادات والمالية والعهدة تحتاج اتصالًا.</p><p>{queue.length} عملية لم تُحسم على الخادم — {queue.filter(q => q.status === 'conflict').length} تعارضًا</p><button disabled={busy || queue.length === 0} onClick={syncQueue}>مزامنة ومراجعة التعارضات</button>{queue.filter(q => q.status === 'conflict').map(q => <article key={q.id}><p>تغير سجل الحضور أو التقييم على الخادم. راجع السجل الحالي ثم أدخل تصحيحًا جديدًا إذا احتجت.</p><button disabled={busy} onClick={async () => { await removePending(q.id); await refreshQueue(); }}>الاحتفاظ بتعديل الخادم وإلغاء النسخة المحلية</button></article>)}</details><div className="workspace-stats"><span><strong>{state.members.length}</strong>ملف فرد</span><span><strong>{new Set(state.plans.map(p => p.rootId ?? p.id)).size}</strong>خطة للمجموعة</span><span><strong>{state.meetings.filter(m => m.executedAt).length}</strong>اجتماعًا منفذًا</span>{allowed('finance.donate') ? <span><strong>{money(cashBalance(state))}</strong>رصيد الصندوق</span> : null}</div><nav className="workspace-nav" aria-label="أقسام المجموعة">{[['overview', 'نظرة عامة'], ['organization', 'الهيكل والصلاحيات'], ['membership', 'الانضمام والأفراد'], ['plans', 'الخطط والاعتمادات'], ['meetings', 'الاجتماعات والتنفيذ'], ['finance', 'المالية والصناديق'], ['archive', 'التاريخ والأرشيف'],['curriculum','المناهج والشارات'],['inventory','العهدة'],['documents','المستندات والطباعة']].map(([id, label]) => <button key={id} aria-pressed={area === id} onClick={() => setArea(id)}>{label}</button>)}</nav><div className="workspace-grid" data-area={area}>{isGeneral?<BackupPanel groupId={group}/>:null}<AccessPanel state={state} groupId={group} revision={revision} onSaved={()=>load(group)}/><FilesDocuments state={state} groupId={group} revision={revision} onSaved={()=>load(group)}/><OperationsPanel state={state} revision={revision} groupId={group} userId={session.user.id} onSaved={()=>load(group)}/>{isGeneral ? <section className="workspace-panel" data-section="organization"><h2>السنة والهيكل التنظيمي</h2><form onSubmit={e => submit(e, 'year.create')}><label>اسم السنة<input name="name" required/></label><label>بداية السنة<input name="startsOn" type="date" required/></label><label>نهاية السنة<input name="endsOn" type="date" required/></label><button disabled={busy}>إضافة السنة الكشفية</button></form><form onSubmit={e => submit(e, 'unit.create')}><label>اسم الوحدة<input name="name" required/></label><label>نوع الوحدة<select name="kind"><option value="sector">قطاع</option><option value="team">فريق</option><option value="patrol">طليعة</option></select></label><label>الوحدة الأعلى<select name="parentId"><option value="">لا توجد للقطاع</option>{state.units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><button disabled={busy}>إضافة الوحدة</button></form>{state.years?.map(y => <p key={y.id}>{y.name}: {y.startsOn} — {y.endsOn}</p>)}{state.units?.map(u => <p key={u.id}>{u.name} — {u.parentId ? unitName(u.parentId) : 'المجموعة'}</p>)}</section> : null}{isGeneral ? <section className="workspace-panel" data-section="membership"><h2>ربط حساب الفرد</h2><p>يربط حساب دخول موثوق بملف واحد. واجهة الفرد متاحة في /me بعد الربط.</p><form onSubmit={e => submit(e, 'account.bind')}><label>الفرد<select name="memberId" required>{state.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>معرّف حساب الفرد<input name="userId" required/></label><button disabled={busy}>ربط الحساب بالملف</button></form></section> : null}{allowed('roles.manage') ? <section className="workspace-panel" data-section="organization"><h2>تكليف مسؤول</h2><form onSubmit={e => submit(e, 'assignment.add')}><label>معرّف الحساب<input name="userId" required/></label><label>الدور<select name="role"><option value="general_leader">قائد عام</option><option value="priest">كاهن</option><option value="secretary">سكرتارية</option><option value="sector_leader">قائد قطاع</option><option value="team_leader">قائد فريق</option><option value="treasurer">أمين صندوق</option><option value="inventory_keeper">أمين عهدة</option><option value="curriculum_leader">مسؤول مناهج</option><option value="examiner">مسؤول اختبار</option></select></label>{unitField}<button disabled={busy}>حفظ التكليف</button></form><p>كل تكليف يتسجل في سجل العمليات. التفويض له صلاحيات ونطاق ومدة وإلغاء مستقل.</p></section> : null}{isGeneral ? <section className="workspace-panel" data-section="organization"><h2>تفويض مسجل</h2><form onSubmit={e => submit(e, 'delegation.grant')}><label>معرّف القائد المفوض<input name="userId" required/></label><label>الوحدة أو فارغ للمجموعة<input name="unit"/></label><label>نهاية التفويض<input name="until" type="datetime-local" required/></label><fieldset><legend>الصلاحيات المفوضة</legend>{[['roles.manage', 'إدارة تكليفات الفرق والأفراد'], ['plan.create', 'كتابة الخطط'], ['plan.submit', 'إرسال الخطط للاعتماد'], ['meeting.create', 'إنشاء الاجتماعات'], ['meeting.record', 'تسجيل التنفيذ'], ['member.create', 'إدارة طلبات الانضمام'], ['history.add', 'إضافة تاريخ للمراجعة'], ['finance.donate', 'تسجيل المساهمات'], ['finance.pay', 'تسجيل الصرف']].map(([v, label]) => <label key={v}><input type="checkbox" name="permissions" value={v}/>{label}</label>)}</fieldset><button disabled={busy}>حفظ التفويض</button></form><form onSubmit={e => submit(e, 'delegation.revoke')}><label>التفويض<select name="delegationId" required>{(state.delegations ?? []).filter(d => !d.revokedAt).map(d => <option key={d.id} value={d.id}>{d.userId} — حتى {d.until}</option>)}</select></label><button disabled={busy}>إلغاء التفويض</button></form><p>التفويض لا يوقّع بدل المعتمدين، ولا يسمح بإعادة التفويض أو تعيين قيادة المجموعة.</p></section> : null}{allowed('member.create') ? <section className="workspace-panel" data-section="membership"><h2>طلب انضمام جديد</h2><form onSubmit={e => submit(e, 'member.create')}><label>الاسم<input name="name" required maxLength={180}/></label>{state.units?.length ? <label>الفريق<select name="team" required>{state.units.filter(u => u.kind === 'team').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label> : <label>الفريق<input name="team" required/></label>}{yearField}<button disabled={busy}>حفظ ملف الفرد</button></form>{state.members.map(m => <details key={m.id}><summary>{m.name} — {unitName(m.team)}</summary>{m.timeline.map((t, i) => <p key={i}>{new Date(t.at).toLocaleString('ar-EG')} — {t.detail}</p>)}</details>)}</section> : null}{state.assignments.some(a => a.userId === session.user.id && ['general_leader', 'priest', 'secretary'].includes(a.role)) ? <section className="workspace-panel" data-section="membership"><h2>المقابلة وقرار الانضمام</h2><form onSubmit={e => submit(e, 'admission.start_trial')}><label>الطلب<select name="memberId" required>{state.members.filter(m => m.status === 'applicant').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><button disabled={busy}>بدء المقابلة أو التجربة</button></form><form onSubmit={e => submit(e, 'admission.decide')}><label>الفرد<select name="memberId" required>{state.members.filter(m => ['trial', 'discussion'].includes(m.status)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>صفتي في القرار<select name="role">{state.assignments.filter(a => a.userId === session.user.id && ['priest', 'general_leader'].includes(a.role)).map(a => <option key={a.role + String(a.unit)} value={a.role}>{roleNames[a.role]}</option>)}</select></label><label>القرار<select name="approved"><option value="yes">موافقة</option><option value="no">رفض مع سبب للمناقشة</option></select></label><label>سبب أو ملاحظة<textarea name="note" maxLength={1000}/></label><button disabled={busy}>تأكيد قرار الانضمام</button></form><p>القبول يحتاج القرارين. رسالة واتساب لا تُرسل حاليًا لأن خدمة الإرسال غير متصلة.</p>{state.members.map(m => <p key={m.id}>{m.name}: {{ applicant: 'طلب جديد', trial: 'في التجربة', active: 'مقبول', discussion: 'قيد المناقشة', rejected: 'مرفوض' }[m.status]}</p>)}</section> : null}{allowed('history.add') ? <section className="workspace-panel" data-section="archive"><h2>التاريخ السابق</h2><form onSubmit={e => submit(e, 'history.submit')}><label>الفرد<select name="memberId" required>{state.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>الواقعة أو الشهادة<input name="title" required/></label><label>دقة التاريخ<select name="precision"><option value="year">السنة فقط</option><option value="day">يوم محدد</option><option value="approximate">تقريبي</option></select></label><label>تاريخ الواقعة<input name="occurredAt" placeholder="1998 أو 1998-06-01" required/></label><label>المصدر أو وصف الدليل<textarea name="source" required maxLength={1000}/></label><button disabled={busy}>تقديم للمراجعة</button></form><form onSubmit={e => submit(e, 'history.review')}><label>طلب التاريخ<select name="claimId" required>{(state.claims ?? []).filter(c => c.status === 'pending').map(c => <option key={c.id} value={c.id}>{c.title} — {c.occurredAt}</option>)}</select></label><label>قرار السكرتارية<select name="approved"><option value="yes">اعتماد</option><option value="no">رفض</option></select></label><button disabled={busy}>تسجيل مراجعة السكرتارية</button></form></section> : null}{available('plan.create') ? <section className="workspace-panel" data-section="plans"><h2>خطة جديدة</h2><form onSubmit={e => submit(e, 'plan.create')}><label>العنوان<input name="title" required/></label><label>المستوى<select name="scope"><option value="general">عامة</option><option value="sector">قطاع</option><option value="team">فريق</option></select></label>{unitField}<label>الخطة الأعلى<select name="parentId"><option value="">لا توجد للخطة العامة</option>{planOptions}</select></label><label>الهدف<textarea name="goal" required maxLength={1500}/></label>{yearField}<label>الميزانية بالجنيه<input name="budget" inputMode="decimal" required/></label><button disabled={busy}>حفظ مسودة</button></form></section> : null}{available('plan.create') ? <section className="workspace-panel" data-section="plans"><h2>إصدار جديد للخطة</h2><p>كل إصدار له قرارات جديدة. المصروف السابق يظل محسوبًا من ميزانية الخطة عبر إصداراتها.</p><form onSubmit={e => submit(e, 'plan.revise')}><label>الخطة الحالية<select name="planId" required>{state.plans.filter(p => ['approved', 'review'].includes(p.status)).map(p => <option key={p.id} value={p.id}>{p.title} — إصدار {p.version}</option>)}</select></label><label>العنوان المعدل<input name="title" required/></label><label>الهدف المعدل<textarea name="goal" required maxLength={1500}/></label><label>الميزانية الإجمالية المعدلة بالجنيه<input name="budget" required inputMode="decimal"/></label><button disabled={busy}>فتح إصدار للمراجعة</button></form></section> : null}<section className="workspace-panel" data-section="plans"><h2>الاعتمادات</h2><p>المعتمدون يحفظون مع نسخة الخطة. تعديل المسار يؤثر على الطلبات الجديدة فقط.</p>{isGeneral ? <form onSubmit={e => submit(e, 'approvals.configure')}><fieldset><legend>أدوار اعتماد الخطط الجديدة</legend>{Object.entries(roleNames).filter(([role]) => role !== 'member').map(([role, label]) => <label key={role}><input type="checkbox" name="roles" value={role} defaultChecked={(state.settings?.planApproverRoles ?? ['priest', 'general_leader', 'team_leader', 'secretary']).includes(role as Role)}/>{label}</label>)}</fieldset><button disabled={busy}>حفظ مسار الاعتماد</button></form> : null}{available('plan.create') ? <form onSubmit={e => submit(e, 'plan.submit')}><label>الخطة<select name="planId" required>{planOptions}</select></label>{(state.settings?.planApproverRoles ?? ['priest', 'general_leader', 'team_leader', 'secretary']).map(role => <label key={role}>{roleNames[role]}<select name={'approver:' + role} required><option value="">اختار المكلف</option>{state.assignments.filter(a => a.role === role).map(a => <option key={a.userId + String(a.unit)} value={a.userId}>{state.accountNames?.[a.userId]??a.userId}{a.unit ? ' — ' + a.unit : ''}</option>)}</select></label>)}<button disabled={busy}>إرسال للمراجعين</button></form> : null}<form onSubmit={e => submit(e, 'approval.decide')}><label>الخطة<select name="planId" required>{planOptions}</select></label><label>صفتي<select name="role">{state.assignments.filter(a => a.userId === session.user.id).map(a => <option key={a.role + String(a.unit)} value={a.role}>{roleNames[a.role]}</option>)}</select></label><label>القرار<select name="approved"><option value="yes">موافقة</option><option value="no">طلب مناقشة</option></select></label><button disabled={busy}>تسجيل القرار</button></form></section>{available('plan.create') ? <section className="workspace-panel" data-section="meetings"><h2>اجتماع تحت خطة معتمدة</h2><form onSubmit={e => submit(e, 'meeting.create')}><label>بند الخطة<select name="itemId"><option value="">اختر البند عند وجود بنود</option>{state.operations?.items.map(i=><option key={i.id} value={i.id}>{i.title} — {i.date}</option>)}</select></label><label>الخطة<select name="planId" required>{planOptions}</select></label><label>العنوان<input name="title" required/></label><label>التاريخ<input type="date" name="date" required/></label><button disabled={busy}>إنشاء الاجتماع</button></form><form onSubmit={e => submit(e, 'meeting.record')}><label>الاجتماع<select name="meetingId" required>{state.meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label><label>الفرد<select name="memberId" required>{state.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>الحضور<select name="attendance"><option value="present">حاضر</option><option value="absent">غائب</option><option value="excused">بعذر</option><option value="late">متأخر</option></select></label><label>التقييم<select name="assessment"><option value="">لم يُقيّم</option><option value="passed">اجتاز</option><option value="not_passed">لم يجتز</option></select></label><button disabled={busy}>تسجيل التنفيذ</button></form></section> : null}{isGeneral ? <section className="workspace-panel" data-section="finance"><h2>إعداد الصناديق</h2><form onSubmit={e => submit(e, 'cashbox.create')}><label>اسم الصندوق<input name="name" required/></label>{unitField}<label>معرّف أمين الصندوق<input name="treasurerId" required/></label><button disabled={busy}>حفظ الصندوق وأمينه</button></form></section> : null}{hasFinance ? <section className="workspace-panel" data-section="finance"><h2>تحويل داخلي</h2><p>التحويل يغيّر رصيد الصندوقين ولا يسجل إيرادًا جديدًا.</p><form onSubmit={e => submit(e, 'finance.transfer')}><label>من صندوق<select name="fromBoxId" required>{state.boxes?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>إلى صندوق<select name="toBoxId" required>{state.boxes?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>البيان<input name="title" required/></label><label>المبلغ بالجنيه<input name="amount" inputMode="decimal" required/></label><button disabled={busy}>تسجيل التحويل الفعلي</button></form>{state.boxes?.map(b => <p key={b.id}>{b.name}: {money(cashBalance(state, b.id))}</p>)}</section> : null}{state.boxes?.length ? <section className="workspace-panel" data-section="finance"><h2>مصروف يحتاج اعتمادًا مستقلًا</h2><form onSubmit={e => submit(e, 'expense.request')}>{boxField}<label>الخطة المرتبطة<select name="planId"><option value="">مصروف مستقل</option>{planOptions}</select></label><label>البيان<input name="title" required/></label><label>المبلغ بالجنيه<input name="amount" required inputMode="decimal"/></label><label>حساب المسؤول المعتمد<input name="leaderId" required/></label><label>حساب أمين الصندوق المعين<input name="treasurerId" required/></label><button disabled={busy}>تقديم المصروف للاعتماد</button></form><form onSubmit={e => submit(e, 'expense.decide')}><label>طلب المصروف<select name="requestId" required>{state.expenseRequests?.filter(r => !r.paidEntryId).map(r => <option key={r.id} value={r.id}>{r.title} — {money(r.amount)}</option>)}</select></label><label>صفتي<select name="role">{state.assignments.filter(a => a.userId === session.user.id).map(a => <option key={a.role + String(a.unit)} value={a.role}>{roleNames[a.role]}{a.unit ? ' — ' + unitName(a.unit) : ''}</option>)}</select></label><label>القرار<select name="approved"><option value="yes">موافقة</option><option value="no">رفض</option></select></label><button disabled={busy}>تسجيل قرار المصروف</button></form>{hasFinance ? <form onSubmit={e => submit(e, 'finance.pay_request')}><label>الطلب<select name="requestId" required>{state.expenseRequests?.filter(r => !r.paidEntryId).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label><button disabled={busy}>تسجيل دفع المصروف المعتمد</button></form> : null}</section> : null}{hasFinance ? <section className="workspace-panel" data-section="finance"><h2>مساهمة اختيارية</h2><form onSubmit={e => submit(e, 'finance.donate')}>{boxField}<label>البيان<input name="title" required/></label><label>المبلغ بالجنيه<input name="amount" inputMode="decimal" required/></label><button disabled={busy}>تسجيل التحصيل الفعلي</button></form><h2>صرف داخل ميزانية معتمدة</h2><form onSubmit={e => submit(e, 'finance.pay')}><label>بند الميزانية<select name="itemId"><option value="">اختر البند عند وجود بنود</option>{state.operations?.items.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label>{boxField}<label>الخطة<select name="planId" required>{planOptions}</select></label><label>البيان<input name="title" required/></label><label>المبلغ بالجنيه<input name="amount" inputMode="decimal" required/></label><button disabled={busy}>تسجيل الدفع الفعلي</button></form></section> : null}<section className="workspace-panel" data-section="overview"><h2>إشعاراتي</h2>{(state.inbox ?? []).filter(n => n.userId === session.user.id).slice(-15).reverse().map(n => <article key={n.id}><p>{n.title} — {new Date(n.createdAt).toLocaleString('ar-EG')} — {n.readAt ? 'مقروء' : 'جديد'}</p>{!n.readAt ? <form onSubmit={e => submit(e, 'notification.read')}><input type="hidden" name="notificationId" value={n.id}/><button disabled={busy}>تحديد كمقروء</button></form> : null}</article>)}<form onSubmit={e => submit(e, 'notification.preference')}><label>نوع الإشعار<select name="event"><option value="plan_submitted">طلب اعتماد خطة</option><option value="plan_approved">اكتمال اعتماد خطة</option><option value="history_submitted">مراجعة التاريخ</option><option value="history_reviewed">نتيجة مراجعة التاريخ</option><option value="expense_submitted">اعتماد مصروف</option><option value="meeting_recorded">تحديث الحضور والتقييم</option></select></label><label>الإشعارات داخل التطبيق<select name="enabled"><option value="yes">مفعلة</option><option value="no">موقوفة</option></select></label><button disabled={busy}>حفظ إعداد الإشعار</button></form><p>هذه إشعارات داخل التطبيق. تنبيهات الجهاز وواتساب غير متصلين.</p></section><section className="workspace-panel workspace-report" data-section="overview"><h2>تقرير التنفيذ والمصروفات — {state.name}</h2><button className="no-print" onClick={() => window.print()}>طباعة التقرير الحالي</button>{state.plans.map(p => <article key={p.id}><h3>{p.title} — إصدار {p.version}</h3><p>الحالة: {p.status === 'approved' ? 'معتمدة' : p.status === 'review' ? 'قيد الاعتماد' : p.status === 'superseded' ? 'نسخة سابقة' : 'مسودة'} — الميزانية: {money(p.budget)}</p><p>المخطط: {state.meetings.filter(m => m.planId === p.id).length} اجتماع — المنفذ: {state.meetings.filter(m => m.planId === p.id && m.executedAt).length}</p>{allowed('finance.donate') ? <p>المصروف الفعلي: {money(state.entries.filter(e => e.planId === p.id && e.kind === 'expense').reduce((n, e) => n + e.amount, 0))}</p> : null}</article>)}<h3>نتائج الاجتماعات</h3>{state.meetings.map(m => <article key={m.id}><h3>{m.title} — {m.date}</h3><p>حاضر أو متأخر: {Object.values(m.attendance).filter(a => ['present', 'late'].includes(a)).length} — غياب: {Object.values(m.attendance).filter(a => a === 'absent').length} — بعذر: {Object.values(m.attendance).filter(a => a === 'excused').length}</p><p>اجتاز: {Object.values(meetingEvaluations(state,m)).filter(a => a === 'passed').length} — لم يجتز: {Object.values(meetingEvaluations(state,m)).filter(a => a === 'not_passed').length} — لم يُقيّم: {Object.keys(m.attendance).filter(id => (!meetingEvaluations(state,m)[id]||meetingEvaluations(state,m)[id]==='not_evaluated')).length}</p></article>)}<h3>سجل العمليات</h3>{state.audit.slice(-12).reverse().map(a => <p key={a.id}>{a.action} — {new Date(a.at).toLocaleString('ar-EG')}</p>)}</section></div></> : <section className="app-empty"><div className="empty-mark" aria-hidden="true">✦</div><h2>{session.groups.length?'اختار مجموعتك، وابدأ المتابعة.':'مساحتك جاهزة للخطوة الأولى.'}</h2><p>{session.groups.length?'المجموعات المتاحة لحسابك موجودة في القائمة بالأعلى. افتح مجموعة لعرض أفرادها وخططها وصناديقها.':'لم يرتبط حسابك بمجموعة بعد. لو عندك دعوة افتح رابطها، أو جرّب الحسابات المخصصة للمراجعة.'}</p><a href="/test-login">فتح حسابات التجربة ↖</a><details><summary>معرّف حسابي للربط</summary><code>{session.user.id}</code></details></section>}</>}</div>;
}
