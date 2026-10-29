import type { Command } from './core';
export type PendingRecord = {
    id: string;
    userId: string;
    groupId: string;
    revision: number;
    command: Command;
    base: {
        attendance: string | null;
        assessment: string | null;
    };
    status: 'pending' | 'conflict';
    createdAt: string;
};
const database = 'scout-pending-records-v1';
async function open() { return new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(database, 1); r.onupgradeneeded = () => r.result.createObjectStore('records', { keyPath: 'id' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(Error('تعذر فتح مساحة الحفظ على الجهاز')); }); }
export async function pendingRecords(userId: string, groupId: string) { const db = await open(); try {
    return await new Promise<PendingRecord[]>((resolve, reject) => { const r = db.transaction('records').objectStore('records').getAll(); r.onsuccess = () => resolve((r.result as PendingRecord[]).filter(x => x.userId === userId && x.groupId === groupId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))); r.onerror = () => reject(r.error); });
}
finally {
    db.close();
} }
export async function savePending(record: PendingRecord) { const db = await open(); try {
    await new Promise<void>((resolve, reject) => { const t = db.transaction('records', 'readwrite'); t.objectStore('records').put(record); t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });
}
finally {
    db.close();
} }
export async function removePending(id: string) { const db = await open(); try {
    await new Promise<void>((resolve, reject) => { const t = db.transaction('records', 'readwrite'); t.objectStore('records').delete(id); t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });
}
finally {
    db.close();
} }
