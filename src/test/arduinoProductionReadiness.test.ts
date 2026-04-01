import { describe, expect, it } from 'vitest';
import {
  VERIFIED_WEB_FLASH_BOARDS,
  arduinoBoards,
  isVerifiedWebFlashBoard,
} from '@/data/arduinoTemplates';
import { SAMBA_BOARD_CONFIGS } from '@/services/sambaFlash';

const STK500_BOARDS = ['uno', 'nano', 'mega'];
const AVR109_BOARDS = ['leonardo', 'micro'];
const ESP_BOARDS = ['esp32', 'esp8266'];
const STM32_BOARDS = ['portenta_h7', 'giga_r1'];
const UF2_BRIDGE_BOARDS = ['nano_33_ble', 'rp2040_connect'];
const SAMBA_BOARDS = Object.keys(SAMBA_BOARD_CONFIGS);

describe('arduino production readiness metadata', () => {
  it('keeps a strict verified upload board set', () => {
    expect(VERIFIED_WEB_FLASH_BOARDS).toEqual([
      'uno',
      'nano',
      'mega',
      'leonardo',
      'micro',
      'uno_r4_wifi',
      'due',
      'zero',
      'mkr_wifi_1010',
      'nano_33_iot',
      'esp32',
      'esp8266',
      'portenta_h7',
      'giga_r1',
      'nano_33_ble',
      'rp2040_connect',
    ]);
  });

  it('gives every verified board a matching upload protocol implementation', () => {
    const protocolBoards = new Set([
      ...STK500_BOARDS,
      ...AVR109_BOARDS,
      ...SAMBA_BOARDS,
      ...ESP_BOARDS,
      ...STM32_BOARDS,
      ...UF2_BRIDGE_BOARDS,
    ]);

    for (const boardId of VERIFIED_WEB_FLASH_BOARDS) {
      expect(arduinoBoards[boardId]).toBeDefined();
      expect(protocolBoards.has(boardId)).toBe(true);
    }
  });

  it('retains full board metadata coverage for verified boards', () => {
    for (const boardId of VERIFIED_WEB_FLASH_BOARDS) {
      expect(isVerifiedWebFlashBoard(boardId)).toBe(true);
      expect(arduinoBoards[boardId]?.serial).toBe(true);
    }
  });
});
