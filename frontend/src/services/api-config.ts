// Relative endpoint paths (the Vite proxy is configured later). Base URLs are overridable only via function parameters.
export const SOLVE_PATH = '/api/solve';
export const HEALTH_PATH = '/health';
export const WS_SCAN_PATH = '/ws/scan';

/** WebSocket URL for the scan endpoint on the page's own origin (the caller passes the location; no DOM globals here). */
export function scanSocketUrl(location: { protocol: string; host: string }): string {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${WS_SCAN_PATH}`;
}
