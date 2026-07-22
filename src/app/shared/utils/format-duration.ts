/**
 * Formats a duration given in whole minutes as a short, human-readable
 * string: "< 1m", "45m", "2h", "2h 15m", "3d", "3d 4h".
 *
 * Extracted after finding the exact same hour/minute breakdown logic
 * duplicated independently in incident-row.ts (age) and
 * incident-detail.ts (duration) — and inconsistently: age() rolled up to
 * days for long-running incidents, duration() did not (a 50-hour-old
 * incident showed "50h 15m" there instead of "2d 2h 15m"). Also used for
 * MTTA/MTTR display, which arrive pre-computed in minutes from the
 * backend (IncidentDto.mttaMinutes/mttrMinutes) — no unit conversion
 * needed there, just the same formatting.
 */
export function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes < 1) return '< 1m';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = Math.floor(totalMinutes % 60);

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}