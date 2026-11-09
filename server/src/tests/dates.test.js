const { todayLocal } = require('../utils/dates');

describe('todayLocal', () => {
  test('uses the local calendar date', () => {
    // 00:30 on 10 Nov, local time. In India the UTC date is still 9 Nov at
    // this moment, which is the bug this helper exists to avoid.
    const justAfterMidnight = new Date(2026, 10, 10, 0, 30);

    expect(todayLocal(justAfterMidnight)).toBe('2026-11-10');
  });

  test('pads single digit months and days', () => {
    expect(todayLocal(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });

  test('keeps the date late in the evening', () => {
    expect(todayLocal(new Date(2026, 10, 9, 23, 59))).toBe('2026-11-09');
  });
});