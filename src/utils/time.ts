/**
 * Get week key in YYYY-WNN format
 */
export function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Format a time period as human-readable string
 */
export function formatPeriod(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const fmt = (d: Date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };
  if (fmt(start) === fmt(end)) return fmt(start);
  return `${fmt(start)} to ${fmt(end)}`;
}
