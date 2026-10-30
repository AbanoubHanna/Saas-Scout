import AppShell from "../app-shell";
import {requireChatGPTUser} from '../chatgpt-auth';import Accept from './accept';
export const dynamic='force-dynamic';export default async function Page(){await requireChatGPTUser('/join');return <AppShell section="join"><div className="workspace-main app-join"><section className="workspace-panel"><h1>انضم لمساحة مجموعتك</h1><p>قبول الدعوة يربط حسابك بالتكليف المحدد فيها. الإرسال بالبريد غير متصل؛ رابط الدعوة يشاركه المسؤول مباشرة.</p><Accept/></section></div></AppShell>;}
