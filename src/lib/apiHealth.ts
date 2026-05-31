type Listener = (backends: Record<string, boolean>) => void;

let backends: Record<string, boolean> = {};
const listeners = new Set<Listener>();

export function reportBackendHealth(name: string, healthy: boolean) {
  backends = { ...backends, [name]: healthy };
  listeners.forEach((fn) => fn(backends));
}

export function subscribeToBackendHealth(fn: Listener) {
  listeners.add(fn);
  if (Object.keys(backends).length > 0) fn({ ...backends });
  return () => { listeners.delete(fn); };
}

export function getBackendHealth(): Record<string, boolean> {
  return { ...backends };
}
