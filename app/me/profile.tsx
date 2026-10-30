'use client';
import MemberDetails from './member-details';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { individualProfile } from '../../lib/scout/core';
type Profile = ReturnType<typeof individualProfile>;
export default function Individual({ userId }: {
    userId: string;
}) {
    const [groups, setGroups] = useState<{
        id: string;
        name: string;
    }[]>([]), [group, setGroup] = useState(''), [profile, setProfile] = useState<Profile | null>(null), [revision, setRevision] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    const activeGroup = useRef('');
    const operation = useRef<{
        fingerprint: string;
        id: string;
    } | null>(null);
    useEffect(() => { fetch('/api/scout', { cache: 'no-store' }).then(async (r) => { if (!r.ok)
        throw Error('تعذر تحميل الحساب'); return r.json() as Promise<{
        groups: {
            id: string;
            name: string;
        }[];
    }>; }).then(d => setGroups(d.groups)).catch(e => setError(e.message)); }, []);
    async function load(id: string) { if (activeGroup.current !== id)
        return; setProfile(null); setError(''); try {
        const r = await fetch('/api/scout?group=' + encodeURIComponent(id) + '&view=me', { cache: 'no-store' });
        const d = await r.json() as {
            profile: Profile;
            revision: number;
            error?: string;
        };
        if (!r.ok)
            throw Error(d.error);
        if (activeGroup.current !== id)
            return;
        setProfile(d.profile);
        setRevision(d.revision);
    }
    catch (x) {
        setError((x as Error).message);
    } }
    async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!profile || busy)
        return; setBusy(true); setError(''); setMessage(''); const form = e.currentTarget; const payload = { ...Object.fromEntries(new FormData(form)), memberId: profile.member.id }; const fingerprint = JSON.stringify({ group, payload }); if (operation.current?.fingerprint !== fingerprint)
        operation.current = { fingerprint, id: crypto.randomUUID() }; try {
        const r = await fetch('/api/scout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: group, revision, command: { id: operation.current.id, type: 'history.submit', payload } }) });
        const d = await r.json() as {
            error?: string;
        };
        if (!r.ok)
            throw Error(d.error);
        operation.current = null;
        await load(group);
        form.reset();
        setMessage('اتقدمت للسكرتارية، ولسه مش تاريخًا معتمدًا.');
    }
    catch (x) {
        setError((x as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <div className="workspace-main"><span className="app-eyebrow">كل خطوة في رحلتك محفوظة</span><h1>أهلًا بيك في مساحتك.</h1><p>اجتماعاتك، شهاداتك، وتاريخك الكشفي. اختار مجموعتك لمتابعة رحلتك.</p><details><summary>معرّف حسابي للربط</summary><code>{userId}</code></details><label>المجموعة<select value={group} onChange={e => { activeGroup.current = e.target.value; setGroup(e.target.value); if (e.target.value)
        load(e.target.value);
    else
        setProfile(null); }}><option value="">اختار المجموعة</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label><div aria-live="polite">{error ? <p role="alert" className="workspace-error">{error}</p> : null}{message ? <p className="workspace-success">{message}</p> : null}</div>{profile ? <><div className="member-welcome"><span className="app-eyebrow">ملف الفرد</span><h2>{profile.member.name}</h2><p>حكايتك الكشفية، بتكبر مع كل خطوة.</p></div><div className="workspace-stats"><span><strong>{profile.meetings.length}</strong>اجتماع في رحلتك</span><span><strong>{profile.meetings.filter(m=>m.attendance==='present'||m.attendance==='late').length}</strong>مشاركة مسجلة</span><span><strong>{profile.member.timeline.length}</strong>واقعة في الأرشيف</span><span><strong>{profile.claims.filter(c=>c.status==='pending').length}</strong>طلب مراجعة</span></div><MemberDetails groupId={group} memberId={profile.member.id} revision={revision} onSaved={()=>load(group)}/><section className="workspace-panel"><h2>إشعاراتي</h2>{profile.inbox.slice(-10).reverse().map(n => <p key={n.id}>{n.title} — {new Date(n.createdAt).toLocaleDateString('ar-EG')}</p>)}<p>إشعارات داخل التطبيق؛ واتساب وتنبيهات الجهاز غير متصلين.</p></section><section className="workspace-panel"><h2>إضافة واقعة أو شهادة من تاريخك</h2><p>تظهر في الأرشيف المعتمد بعد مراجعة السكرتارية. رفع ملف الشهادة لم يتاح بعد؛ اكتب مصدرها أو وصف الدليل.</p><form onSubmit={submit}><label>الواقعة أو الشهادة<input name="title" required maxLength={180}/></label><label>دقة التاريخ<select name="precision"><option value="year">السنة فقط</option><option value="day">يوم محدد</option><option value="approximate">تقريبي</option></select></label><label>تاريخ الواقعة<input name="occurredAt" required placeholder="1998 أو 1998-06-01"/></label><label>المصدر أو وصف الدليل<textarea name="source" required maxLength={1000}/></label><button disabled={busy}>تقديم للسكرتارية</button></form><h3>طلبات مراجعة التاريخ</h3>{profile.claims.map(c => <p key={c.id}>{c.title} — {c.occurredAt} — {{ pending: 'قيد المراجعة', approved: 'معتمد', rejected: 'غير معتمد' }[c.status]}</p>)}</section><section className="workspace-panel"><h2>اجتماعاتي وتقييمي</h2>{profile.meetings.map(m => <p key={m.id}>{m.title} — {m.date} — {m.attendance ? { present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'بعذر' }[m.attendance] : 'لم يسجل الحضور'} — {{ passed: 'اجتاز', not_passed: 'لم يجتز', not_evaluated: 'لم يُقيّم' }[m.assessment]}</p>)}</section><section className="workspace-panel"><h2>أرشيفي</h2>{profile.member.timeline.map((t, i) => <p key={i}>{new Date(t.at).toLocaleDateString('ar-EG')} — {t.detail}</p>)}</section></> : <section className="app-empty"><div className="empty-mark" aria-hidden="true">✦</div><h2>رحلتك بتبدأ من هنا.</h2><p>اختار مجموعتك من القائمة بالأعلى. لو ملفك لسه مش مربوط، مسؤول المجموعة يقدر يربطه بمعرّف حسابك.</p><a href="/test-login">تجربة واجهة الفرد ↖</a></section>}</div>;
}
