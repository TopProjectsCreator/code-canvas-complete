import { describe, expect, it } from 'vitest';
import { VERIFIED_WEB_FLASH_BOARDS, arduinoBoards, isVerifiedWebFlashBoard } from '@/data/arduinoTemplates';

describe('arduino production readiness metadata', () => {
  it('keeps a strict verified upload board set', () => {
    expect(VERIFIED_WEB_FLASH_BOARDS).toEqual(['uno', 'nano', 'mega', 'leonardo', 'micro', 'uno_r4_wifi']);
  });

  it('marks expanded catalog boards as planning-only when not verified', () => {
    expect(arduinoBoards.nano_33_iot).toBeDefined();
    expect(isVerifiedWebFlashBoard('nano_33_iot')).toBe(false);
    expect(isVerifiedWebFlashBoard('uno')).toBe(true);
  });
});
