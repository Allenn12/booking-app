/**
 * Shared utility for formatting X-axis labels on charts
 * @param {string|Date} dateStr - Date string or object
 * @param {string} grouping - 'day' | 'week' | 'month'
 * @returns {string} Formatted label
 */
export function formatChartDate(dateStr, grouping = 'day') {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const d = date.getDate();
  const m = date.getMonth() + 1;

  if (grouping === 'week') {
    const endDate = new Date(date);
    endDate.setDate(date.getDate() + 6);
    return `${d}.${m}–${endDate.getDate()}.${endDate.getMonth() + 1}.`;
  }

  if (grouping === 'month') {
    const months = ['Sij', 'Vel', 'Ožu', 'Tra', 'Svi', 'Lip', 'Srp', 'Kol', 'Ruj', 'Lis', 'Stu', 'Pro'];
    return months[date.getMonth()];
  }

  // Default: d.M.
  return `${d}.${m}.`;
}
