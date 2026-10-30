import LogoutLink from '../logout-link';
import MobileShell from '../mobile-shell';
import { requireChatGPTUser, chatGPTSignOutPath } from '../chatgpt-auth';
import Individual from './profile';
import '../console/workspace.css';
export const dynamic = 'force-dynamic';
export default async function Page() { const user = await requireChatGPTUser('/me'); return <main className="workspace" dir="rtl"><MobileShell /><header className="workspace-header"><a href="/">مرقوريوس</a><span>{user.displayName}</span><LogoutLink href={chatGPTSignOutPath()}/></header><Individual userId={user.userId}/></main>; }
