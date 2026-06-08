import { useCallback, useEffect, useState } from "react";
import { Store } from "./store";

export function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    return Store.subscribe(() => force((n) => n + 1));
  }, []);
  return Store;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function sample<T>(arr: T[], n: number): T[] { return shuffle(arr).slice(0, n); }
export function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function displayWord(w: string, upper: boolean): string {
  if (upper) return w.toUpperCase();
  return w
    .toLowerCase()
    .split(/([ -])/)
    .map((part) => (/[ -]/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

export const CLUSTER_COLORS = ["--c-blue", "--c-rust", "--c-gold", "--c-green"];

export interface Toast {
  id: string;
  msg: string;
  kind?: "good" | "bad" | undefined;
}

export function useToast(): [Toast[], (msg: string, kind?: "good" | "bad") => void] {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind?: "good" | "bad") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1800);
  }, []);
  return [toasts, push];
}
