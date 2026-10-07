import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffDays,
  formatCountdown,
  formatRelative,
  isISODate,
  isoWeekNumber,
  startOfWeek,
  todayISO,
  weekday,
} from './dates';

describe('dates', () => {
  it('ajoute des jours à travers les mois, années et changements d’heure', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('calcule des écarts', () => {
    expect(diffDays('2026-10-07', '2026-10-26')).toBe(19);
    expect(diffDays('2026-10-26', '2026-10-07')).toBe(-19);
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('commence les semaines le lundi', () => {
    expect(weekday('2026-10-05')).toBe(0);
    expect(weekday('2026-10-11')).toBe(6);
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05');
    expect(startOfWeek('2026-10-05')).toBe('2026-10-05');
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });

  it('valide le format ISO', () => {
    expect(isISODate('2026-10-07')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('7/10/2026')).toBe(false);
    expect(isISODate(42)).toBe(false);
  });

  it('donne la date locale du jour', () => {
    expect(todayISO(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07');
  });

  it('calcule le numéro de semaine ISO', () => {
    expect(isoWeekNumber('2026-10-07')).toBe(41);
    expect(isoWeekNumber('2027-01-01')).toBe(53);
    expect(isoWeekNumber('2026-01-01')).toBe(1);
  });

  it('formate en français', () => {
    expect(formatRelative('2026-10-07', '2026-10-07')).toBe("Aujourd'hui");
    expect(formatRelative('2026-10-08', '2026-10-07')).toBe('Demain');
    expect(formatRelative('2026-10-09', '2026-10-07')).toBe('Vendredi');
    expect(formatRelative('2026-10-04', '2026-10-07')).toBe('Il y a 3 j');
    expect(formatCountdown(6)).toBe('dans 6 jours');
    expect(formatCountdown(1)).toBe('demain');
    expect(formatCountdown(21)).toBe('dans 3 semaines');
  });
});
