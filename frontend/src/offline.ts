import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, isNetworkError } from './api';

const QUEUE_KEY = 'offline_queue_v1';

export type QueuedOp = {
  id: string;
  path: string;
  body: any;
  label: string;
  created_at: string;
};

export function localId(): string {
  return 'loc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

const listeners = new Set<(n: number) => void>();
function notify(n: number) {
  listeners.forEach((l) => l(n));
}

export async function getQueue(): Promise<QueuedOp[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(q: QueuedOp[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  notify(q.length);
}

export async function enqueue(path: string, body: any, label: string): Promise<number> {
  const q = await getQueue();
  q.push({ id: localId(), path, body, label, created_at: new Date().toISOString() });
  await saveQueue(q);
  return q.length;
}

let flushing = false;
export async function flushQueue(): Promise<{ synced: number; remaining: number }> {
  if (flushing) return { synced: 0, remaining: (await getQueue()).length };
  flushing = true;
  let synced = 0;
  try {
    let q = await getQueue();
    while (q.length > 0) {
      const op = q[0];
      try {
        await apiFetch(op.path, { method: 'POST', body: JSON.stringify(op.body) });
        synced++;
      } catch (e: any) {
        if (isNetworkError(e)) break; // still offline — keep queue intact
        // server rejected the op (e.g. validation) — drop it to avoid blocking the queue
      }
      q = q.slice(1);
      await saveQueue(q);
    }
    return { synced, remaining: q.length };
  } finally {
    flushing = false;
  }
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    getQueue().then((q) => setPending(q.length));
    const l = (n: number) => setPending(n);
    listeners.add(l);
    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;
      setIsOnline(online);
      if (online) flushQueue();
    });
    return () => {
      listeners.delete(l);
      unsub();
    };
  }, []);

  const sync = useCallback(() => flushQueue(), []);
  return { isOnline, pending, sync };
}
