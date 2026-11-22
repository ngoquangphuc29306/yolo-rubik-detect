// Session lifecycle. startSession is the ONLY place sessionId increments (generation guard for async work).
import { create } from 'zustand';
import { useCubeStore } from './cube-store';
import { useScanStore } from './scan-store';
import { solveRequestGuard } from './solve-guard';

export type AppScreen = 'landing' | 'scanning' | 'reconstructing' | 'alignment' | 'solving' | 'completion';
export type SessionMode = 'demo' | 'live';

export interface SessionSettings {
  delayMs: number;
  soundEnabled: boolean;
  autoCaptureEnabled: boolean;
}

export const MIN_DELAY_MS = 2000;
export const MAX_DELAY_MS = 15000;

/** Simulated playback clock of a finished guidance run (never wall-clock; shown as "Guidance time"). */
export interface GuidanceResult {
  playbackMs: number;
}

interface SessionStoreState {
  mode: SessionMode | null;
  screen: AppScreen;
  sessionId: number;
  settings: SessionSettings;
  /** Which preset demo cube demo sessions use. Survives startSession; only advanceDemoSeed changes it. */
  demoSeed: number;
  /** Set when a guidance run completes; reset by startSession. */
  guidance: GuidanceResult | null;
  startSession: (mode: SessionMode, screen: AppScreen) => void;
  advanceDemoSeed: () => void;
  setScreen: (screen: AppScreen) => void;
  setGuidance: (playbackMs: number | null) => void;
  setDelayMs: (ms: number) => void;
  toggleSound: () => void;
  setAutoCapture: (enabled: boolean) => void;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  mode: null,
  screen: 'landing',
  sessionId: 0,
  settings: { delayMs: 5000, soundEnabled: true, autoCaptureEnabled: true },
  guidance: null,
  demoSeed: 0,

  startSession: (mode, screen) => {
    // Synchronously first: aborts any in-flight solve before the new session exists.
    solveRequestGuard.reset();
    useScanStore.getState().reset();
    useCubeStore.getState().reset();
    set((s) => ({ mode, screen, sessionId: s.sessionId + 1, guidance: null }));
  },
  advanceDemoSeed: () => set((s) => ({ demoSeed: s.demoSeed + 1 })),
  setScreen: (screen) => set({ screen }),
  setGuidance: (playbackMs) =>
    set((s) => {
      if (playbackMs === null) return { guidance: null };
      // Reject NaN, +/-Infinity and negatives: keep the previous value.
      if (!Number.isFinite(playbackMs) || playbackMs < 0) return s;
      return { guidance: { playbackMs } };
    }),
  setDelayMs: (ms) =>
    set((s) => {
      if (!Number.isFinite(ms)) return s;
      const seconds = Math.round(ms / 1000);
      const delayMs = Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, seconds * 1000));
      return { settings: { ...s.settings, delayMs } };
    }),
  toggleSound: () => set((s) => ({ settings: { ...s.settings, soundEnabled: !s.settings.soundEnabled } })),
  setAutoCapture: (autoCaptureEnabled) => set((s) => ({ settings: { ...s.settings, autoCaptureEnabled } })),
}));
