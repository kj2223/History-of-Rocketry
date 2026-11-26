// Golden traces for js/core/calendar.js: days to dates, weekdays, labels and fiscal quarters across the campaign
// (1945 to the 2030s), fractional days included. record(write) writes calendar.json.
import { dayOf, dateOf, weekday, dateLabel, fiscalQuarter, fiscalYearEnd } from '../../js/core/calendar.js';

export function record(write) {
  const days = [];
  for (let d = -400; d <= 33000; d += 37) days.push(d);
  days.push(0, 0.5, 0.999, 181.25, 364.9999, 365, 1460, 5000.75, 9000.5);
  write('calendar.json', {
    days: days.map(d => ({ day: d, date: dateOf(d), weekday: weekday(d), label: dateLabel(d), fq: fiscalQuarter(d) })),
    dayOf: [
      [1945, 1, 1], [1945, 10, 11], [1946, 2, 29], [1957, 10, 4], [1969, 7, 20], [2000, 2, 29], [2026, 12, 31],
      [1950, 13, 1], [1950, 0, 1], [1950, 3, 0], [1961, 5, 5],
    ].map(([y, m, d]) => ({ y, m, d, day: dayOf(y, m, d) })),
    fiscalYearEnd: [1946, 1958, 1970, 2000, 2030].map(fy => ({ fy, day: fiscalYearEnd(fy) })),
  });
}
