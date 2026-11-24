import * as React from 'react';

export function usePrefersReducedMotion(): boolean {
  const query = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const [reduced, setReduced] = React.useState(query?.matches ?? false);
  React.useEffect(() => {
    if (!query) return;
    const on = () => setReduced(query.matches);
    on();
    query.addEventListener?.('change', on);
    return () => query.removeEventListener?.('change', on);
  }, [query]);
  return reduced;
}
