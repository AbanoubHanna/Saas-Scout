import LogoutLink from '../logout-link';
import MobileShell from '../mobile-shell';
import { requireChatGPTUser, chatGPTSignOutPath } from '../chatgpt-auth';
import Workspace from './workspace';
import './workspace.css';
export const dynamic = 'force-dynamic';
export default async function Console() { const user = await requireChatGPTUser('/console'); return <main className="workspace"><MobileShell /><header className="workspace-header"><a href="/">مرقوريوس</a><span>التشغيل الأولي</span><span>{user.displayName}</span><a href="/me">ملفي الكشفي</a><LogoutLink href={chatGPTSignOutPath('/')}/></header><div className="workspace-notice">نسخة تأسيسية للاختبار. الدخول الحالي عبر هوية الاستضافة. واتساب والمدفوعات والإشعارات الخارجية غير متصلة.</div><Workspace /></main>; }
