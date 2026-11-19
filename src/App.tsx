/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useRubikStore } from '@/src/store/useRubikStore';
import { LandingScreen } from '@/src/screens/LandingScreen';
import { ScanningScreen } from '@/src/screens/ScanningScreen';
import { ReconstructionScreen } from '@/src/screens/ReconstructionScreen';
import { AlignmentScreen } from '@/src/screens/AlignmentScreen';
import { SolvingScreen } from '@/src/screens/SolvingScreen';
import { CompletionScreen } from '@/src/screens/CompletionScreen';

export default function App() {
  const screen = useRubikStore((s) => s.screen);

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
