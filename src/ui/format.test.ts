import { describe, expect, it } from 'vitest';
import { formatClock, formatEuro, formatEuroSigned } from './format';

describe('formatEuro', () => {
  it('formats integer cents with a decimal comma', () => {
    expect(formatEuro(0)).toBe('0,00 €');
    expect(formatEuro(5)).toBe('0,05 €');
    expect(formatEuro(1250)).toBe('12,50 €');
    expect(formatEuro(30000)).toBe('300,00 €');
  });
  it('groups thousands and handles negatives', () => {
    expect(formatEuro(123456)).toBe('1.234,56 €');
    expect(formatEuro(100000000)).toBe('1.000.000,00 €');
    expect(formatEuro(-1250)).toBe('-12,50 €');
    expect(formatEuro(-5)).toBe('-0,05 €');
  });
  it('is defensive against non-finite and fractional input', () => {
    expect(formatEuro(Number.NaN)).toBe('0,00 €');
    expect(formatEuro(Infinity)).toBe('0,00 €');
    expect(formatEuro(99.6)).toBe('1,00 €');
  });
  it('signed variant marks gains only', () => {
    expect(formatEuroSigned(250)).toBe('+2,50 €');
    expect(formatEuroSigned(0)).toBe('0,00 €');
    expect(formatEuroSigned(-250)).toBe('-2,50 €');
  });
});

describe('formatClock', () => {
  it('pads hours and minutes and floors fractional minutes', () => {
    expect(formatClock(365)).toBe('06:05');
    expect(formatClock(360)).toBe('06:00');
    expect(formatClock(874.99)).toBe('14:34');
    expect(formatClock(1320)).toBe('22:00');
  });
  it('clamps invalid values and wraps at 24 h', () => {
    expect(formatClock(-5)).toBe('00:00');
    expect(formatClock(Number.NaN)).toBe('00:00');
    expect(formatClock(1440 + 61)).toBe('01:01');
  });
});
