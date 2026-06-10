/* Node 22+ defines its own experimental `localStorage` global which is
 * non-functional without --localstorage-file, and in vitest's jsdom environment
 * it shadows a working Storage (globalThis IS the jsdom window there, so the
 * Node global wins). Replace it with a spec-shaped in-memory Storage so app
 * code and tests get the behavior a real browser provides. */

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(String(key), String(value)); }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});
