import AppShell from "../app-shell";
import {requireScoutUser as requireChatGPTUser} from '../../lib/scout/scout-auth';
import Panel from './panel';import '../console/workspace.css';
export const dynamic='force-dynamic';export default async function Page(){const user=await requireChatGPTUser('/platform');return <AppShell section="platform" name={user.displayName}><Panel userId={user.userId}/></AppShell>;}
