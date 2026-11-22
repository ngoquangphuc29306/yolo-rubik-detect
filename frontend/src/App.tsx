/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useSessionStore } from '@/stores/session-store';
import { LandingScreen } from '@/features/landing/LandingScreen';
import { ScanningScreen } from '@/features/scanner/ScanningScreen';
import { ReconstructionScreen } from '@/features/review/ReconstructionScreen';
import { AlignmentScreen } from '@/features/align/AlignmentScreen';
import { SolvingScreen } from '@/features/solver/SolvingScreen';
import { CompletionScreen } from '@/features/solver/CompletionScreen';

export default function App() {
  const screen = useSessionStore((s) => s.screen);

  // Scroll to top when transitioning between screens
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [screen]);

  switch (screen) {
    case 'landing':
      return <LandingScreen />;
    case 'scanning':
      return <ScanningScreen />;
    case 'reconstructing':
      return <ReconstructionScreen />;
    case 'alignment':
      return <AlignmentScreen />;
    case 'solving':
      return <SolvingScreen />;
    case 'completion':
      return <CompletionScreen />;
    default:
      return <LandingScreen />;
  }
}
