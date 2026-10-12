// The page's side of the worker: each request gets a promise for its reply.
import type { Reply, Request, Results } from './protocol';

const worker = new Worker(new URL('./optimiser.worker.ts', import.meta.url), { type: 'module' });
const pending = new Map<number, { resolve: (v: unknown) => void, reject: (e: Error) => void }>();
let nextId = 1;

worker.onmessage = (e: MessageEvent<Reply>) => {
  const waiting = pending.get(e.data.id);
  if (!waiting) return;
  pending.delete(e.data.id);
  if ('error' in e.data) waiting.reject(new Error(e.data.error));
  else waiting.resolve(e.data.result);
};

export const ask = <K extends Request['kind']>(request: Extract<Request, { kind: K }>): Promise<Results[K]> => {
  const id = nextId;
  nextId += 1;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker.postMessage({ id, ...request });
  });
};
