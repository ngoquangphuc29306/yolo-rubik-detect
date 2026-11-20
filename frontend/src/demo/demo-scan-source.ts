// Simulated scan conditions for the DEMO scanner only. Values are stable identifiers; labels that would
// otherwise imply real AI/YOLO activity are explicitly marked as simulated.
export type DemoScanCondition =
  | 'ready'
  | 'loading_model'
  | 'permission_denied'
  | 'no_cube'
  | 'missing_stickers'
  | 'wrong_face'
  | 'unstable';

export const DEMO_SCAN_CONDITIONS: readonly { value: DemoScanCondition; label: string; hint: string }[] = [
  { value: 'ready', label: 'Normal Auto-Detection (9/9)', hint: 'All 9 stickers visible and stable' },
  { value: 'loading_model', label: 'Simulated: Loading AI Model', hint: 'Simulated: Initializing YOLO weights' },
  { value: 'permission_denied', label: 'Camera Permission Denied', hint: 'Browser webcam access blocked' },
  { value: 'no_cube', label: 'No Cube Detected', hint: 'Empty frame or cube too far' },
  { value: 'missing_stickers', label: 'Missing Stickers (6/9)', hint: 'Fingers covering lower tiles' },
  { value: 'wrong_face', label: 'Incorrect Face Detected', hint: 'Center color mismatch' },
  { value: 'unstable', label: 'Unstable Positioning', hint: 'Hand movement exceeding threshold' },
];
