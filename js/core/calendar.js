// Campaign calendar. Day 0 is 1 January 1945 (UTC).
// US fiscal years of the period ran 1 July to 30 June, named for the year they end in.

const MS_PER_DAY = 86400000;
const EPOCH = Date.UTC(1945, 0, 1);

export const dayOf = (year, month, date) => Math.round((Date.UTC(year, month - 1, date) - EPOCH) / MS_PER_DAY);

export const dateOf = day => {
  const d = new Date(EPOCH + day * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, date: d.getUTCDate() };
};


const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const weekday = day => WEEKDAYS[new Date(EPOCH + day * MS_PER_DAY).getUTCDay()];
export const dateLabel = day => { const { year, month, date } = dateOf(day); return `${date} ${MONTHS[month - 1]} ${year}`; };

// Fiscal year and quarter (1–4) containing this day, plus the quarter's first and last day.
export const fiscalQuarter = day => {
  const { year, month } = dateOf(day);
  const fy = month >= 7 ? year + 1 : year;
  const q = Math.floor(((month + 5) % 12) / 3) + 1;
  const startMonth = ((q - 1) * 3 + 6) % 12 + 1;
  const startYear = startMonth >= 7 ? fy - 1 : fy;
  const start = dayOf(startYear, startMonth, 1);
  const nextMonth = startMonth + 3 > 12 ? startMonth - 9 : startMonth + 3;
  const end = dayOf(nextMonth < startMonth ? startYear + 1 : startYear, nextMonth, 1) - 1;
  return { fy, q, start, end };
};

export const fiscalYearEnd = fy => dayOf(fy, 6, 30);
