// Demo-only error fixtures.
import type { SolveError } from '@/types/api';

/** For the demo-only "Test invalid cube state" button. Message is the ARCHITECTURE §8.3 example. */
export function demoInvalidStateError(): SolveError {
  return {
    kind: 'api',
    code: 'INVALID_CUBE_STATE',
    message: 'The captured cube could not be validated. Check face orientation or scan again.',
    retryable: true,
  };
}
