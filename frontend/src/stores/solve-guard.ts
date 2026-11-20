// Single session-owned guard for solve requests. startSession() resets it synchronously; hooks never do.
import { createLatestGuard } from '@/lib/request-guard';

export const solveRequestGuard = createLatestGuard();
