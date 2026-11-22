// ColorName <-> StickerCode (single-letter renderer/UI token) boundary and colour metadata. No React imports.
import type { ColorName } from '@/types/cube';

/** Single-letter renderer/UI token. */
export type StickerCode = 'W' | 'Y' | 'G' | 'B' | 'R' | 'O';

export const COLOR_NAMES: readonly ColorName[] = ['white', 'yellow', 'red', 'orange', 'blue', 'green'] as const;

const NAME_TO_CODE: Readonly<Record<ColorName, StickerCode>> = {
  white: 'W',
  yellow: 'Y',
  red: 'R',
  orange: 'O',
  blue: 'B',
  green: 'G',
};

const CODE_TO_NAME: Readonly<Record<StickerCode, ColorName>> = {
  W: 'white',
  Y: 'yellow',
  R: 'red',
  O: 'orange',
  B: 'blue',
  G: 'green',
};

export function colorNameToCode(name: ColorName): StickerCode {
  return NAME_TO_CODE[name];
}

export function codeToColorName(code: StickerCode): ColorName {
  const name = CODE_TO_NAME[code];
  if (!name) throw new Error(`Unknown sticker code: ${String(code)}`);
  return name;
}

export interface ColorMetaEntry {
  code: StickerCode;
  name: string;
  hex: string;
  threeHex: string;
  tailwindBg: string;
  textDark: boolean;
}

// Values frozen from the retired STICKER_COLORS table (equality was proven by tests/lib/colors.test.ts before it was deleted).
export const COLOR_META: Readonly<Record<ColorName, ColorMetaEntry>> = {
  white: { code: 'W', name: 'White', hex: '#F4F4F6', threeHex: '#F3F4F6', tailwindBg: 'bg-[#F4F4F6]', textDark: true },
  yellow: { code: 'Y', name: 'Yellow', hex: '#FACC15', threeHex: '#F2C929', tailwindBg: 'bg-[#FACC15]', textDark: true },
  green: { code: 'G', name: 'Green', hex: '#16A34A', threeHex: '#18A957', tailwindBg: 'bg-[#16A34A]', textDark: false },
  blue: { code: 'B', name: 'Blue', hex: '#2563EB', threeHex: '#2563EB', tailwindBg: 'bg-[#2563EB]', textDark: false },
  red: { code: 'R', name: 'Red', hex: '#DC2626', threeHex: '#DC2B2B', tailwindBg: 'bg-[#DC2626]', textDark: false },
  orange: { code: 'O', name: 'Orange', hex: '#F97316', threeHex: '#F2711C', tailwindBg: 'bg-[#F97316]', textDark: false },
};
