import AppShell from "../app-shell";
import {requireScoutUser as requireChatGPTUser} from '../../lib/scout/scout-auth';
import MobileShell from '../mobile-shell';
import { chatGPTSignOutPath } from '../chatgpt-auth';
import Workspace from './workspace';
import './workspace.css';
export const dynamic = 'force-dynamic';
export default async function Console() { const user = await requireChatGPTUser('/console'); return <AppShell section="group" name={user.displayName} signOut={chatGPTSignOutPath()}><MobileShell /><div className="workspace-notice">نسخة تجريبية للمراجعة. واتساب وتنبيهات الأجهزة والمدفوعات الإلكترونية غير متصلة.</div><Workspace /></AppShell>; }
