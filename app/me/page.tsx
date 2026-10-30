import AppShell from "../app-shell";
import {requireScoutUser as requireChatGPTUser} from '../../lib/scout/scout-auth';
import MobileShell from '../mobile-shell';
import { chatGPTSignOutPath } from '../chatgpt-auth';
import Individual from './profile';
import '../console/workspace.css';
export const dynamic = 'force-dynamic';
export default async function Page() { const user = await requireChatGPTUser('/me'); return <AppShell section="member" name={user.displayName} signOut={chatGPTSignOutPath()}><MobileShell /><Individual userId={user.userId}/></AppShell>; }
