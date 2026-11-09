// Today's date on the user's own clock, as YYYY-MM-DD.
// (new Date().toISOString() would give the UTC date, which is a day behind
// in India between midnight and 5:30am.)
export function getLocalDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// '2026-10-15' -> local Date. Split by hand because new Date('2026-10-15')
// is read as UTC and can land on the wrong day.
function parseDate(isoDate) {
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(isoDate) {
  return parseDate(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// The API's end_date is exclusive (the day after the last day counted),
// so the last day to show is one before it.
export function formatPeriod(period) {
  const start = parseDate(period.start_date);
  const last = parseDate(period.end_date);
  last.setDate(last.getDate() - 1);

  if (start.getTime() === last.getTime()) {
    return formatDate(period.start_date);
  }

  const sameYear = start.getFullYear() === last.getFullYear();
  const startText = start.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const lastText = last.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `${startText} - ${lastText}`;
}