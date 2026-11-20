// Latest-request guard: only the most recent begin() is "current"; older handles are aborted and ignored.
// Pure TypeScript (AbortController only); no DOM-specific APIs.
export interface RequestHandle {
  readonly id: number;
  readonly signal: AbortSignal;
  /** False once a newer begin() or reset() has happened. */
  isCurrent(): boolean;
}

export interface LatestGuard {
  begin(): RequestHandle;
  reset(): void;
}

export function createLatestGuard(): LatestGuard {
  let counter = 0;
  let currentId = 0;
  let controller: AbortController | null = null;

  return {
    begin() {
      controller?.abort();
      const own = new AbortController();
      controller = own;
      const id = ++counter;
      currentId = id;
      return { id, signal: own.signal, isCurrent: () => currentId === id };
    },
    reset() {
      controller?.abort();
      controller = null;
      currentId = 0;
    },
  };
}
