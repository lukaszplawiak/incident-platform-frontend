import { formatDurationMinutes } from './format-duration';

describe('formatDurationMinutes', () => {
  it('returns "< 1m" for durations under a minute', () => {
    expect(formatDurationMinutes(0)).toBe('< 1m');
    expect(formatDurationMinutes(0.5)).toBe('< 1m');
  });

  it('formats whole minutes under an hour', () => {
    expect(formatDurationMinutes(1)).toBe('1m');
    expect(formatDurationMinutes(45)).toBe('45m');
    expect(formatDurationMinutes(59)).toBe('59m');
  });

  it('formats whole hours with no remainder minutes', () => {
    expect(formatDurationMinutes(60)).toBe('1h');
    expect(formatDurationMinutes(120)).toBe('2h');
  });

  it('formats hours with remainder minutes', () => {
    expect(formatDurationMinutes(90)).toBe('1h 30m');
    expect(formatDurationMinutes(135)).toBe('2h 15m');
  });

  it('rolls up to days once past 24 hours', () => {
    expect(formatDurationMinutes(1440)).toBe('1d');
    expect(formatDurationMinutes(2880)).toBe('2d');
  });

  it('formats days with remainder hours', () => {
    // The exact scenario that motivated extracting this function: a
    // 50-hour-old incident is 2 days 2 hours. The previous, independent
    // age() implementation in incident-row.ts dropped hours entirely once
    // past the 24h mark (it would have shown just "2d") — showing the
    // remainder hours here is a deliberate improvement, not an attempt to
    // preserve old behavior exactly.
    expect(formatDurationMinutes(50 * 60 + 15)).toBe('2d 2h');
  });

  it('drops remainder minutes once rolled up past the hour level', () => {
    expect(formatDurationMinutes(2 * 1440 + 2 * 60 + 15)).toBe('2d 2h');
  });
});