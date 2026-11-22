import { describe, expect, it } from 'vitest';
import { COLOR_META, codeToColorName, colorNameToCode } from '@/lib/colors';
import { STICKER_COLORS } from '@/lib/cubeEngine';

// REMOVED WITH THE LEGACY ENGINE (T1.17 commit B): this block proves COLOR_META == legacy STICKER_COLORS.
describe('COLOR_META equals the legacy STICKER_COLORS table', () => {
  it('has the same six codes', () => {
    expect(Object.keys(STICKER_COLORS).sort()).toEqual(Object.values(COLOR_META).map((m) => m.code).sort());
  });
  it.each(Object.values(COLOR_META).map((m) => [m.code, m] as const))('%s: every field is identical', (code, meta) => {
    expect(meta).toEqual(STICKER_COLORS[code]);
    for (const k of ['code', 'name', 'hex', 'threeHex', 'tailwindBg', 'textDark'] as const) {
      expect(meta[k], k).toBe(STICKER_COLORS[code][k]);
    }
  });
});

describe('COLOR_META literal values (frozen from the legacy STICKER_COLORS)', () => {
  it('matches the literal table', () => {
    expect(COLOR_META).toEqual({
      white: { code: 'W', name: 'White', hex: '#F4F4F6', threeHex: '#F3F4F6', tailwindBg: 'bg-[#F4F4F6]', textDark: true },
      yellow: { code: 'Y', name: 'Yellow', hex: '#FACC15', threeHex: '#F2C929', tailwindBg: 'bg-[#FACC15]', textDark: true },
      green: { code: 'G', name: 'Green', hex: '#16A34A', threeHex: '#18A957', tailwindBg: 'bg-[#16A34A]', textDark: false },
      blue: { code: 'B', name: 'Blue', hex: '#2563EB', threeHex: '#2563EB', tailwindBg: 'bg-[#2563EB]', textDark: false },
      red: { code: 'R', name: 'Red', hex: '#DC2626', threeHex: '#DC2B2B', tailwindBg: 'bg-[#DC2626]', textDark: false },
      orange: { code: 'O', name: 'Orange', hex: '#F97316', threeHex: '#F2711C', tailwindBg: 'bg-[#F97316]', textDark: false },
    });
  });
  it('name <-> code round trip', () => {
    for (const [name, meta] of Object.entries(COLOR_META)) {
      expect(colorNameToCode(name as keyof typeof COLOR_META)).toBe(meta.code);
      expect(codeToColorName(meta.code)).toBe(name);
    }
  });
});
