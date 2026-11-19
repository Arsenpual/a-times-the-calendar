import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildYearLonths,
  findLonthByDate,
  getLonthById,
  getAdjacentLonth,
  formatLonthRange,
  getDaysInYear
} from "./lonth-engine.js";

test("TIMES-CAL-001 Section 5: Exact 2026 Lonth specification", () => {
  const lonths2026 = buildYearLonths(2026);
  assert.equal(lonths2026.length, 14, "Must produce exactly 14 Lonths");

  // L01
  assert.equal(lonths2026[0].id, "L01");
  assert.equal(lonths2026[0].dayCount, 24, "L01 in 2026 has 24 days");
  assert.equal(lonths2026[0].startDate.getFullYear(), 2026);
  assert.equal(lonths2026[0].startDate.getMonth(), 0);
  assert.equal(lonths2026[0].startDate.getDate(), 1);
  assert.equal(lonths2026[0].endDate.getMonth(), 0);
  assert.equal(lonths2026[0].endDate.getDate(), 24);

  // L02 - L13 must all be 28 days
  let standardTotal = 0;
  for (let i = 1; i <= 12; i++) {
    const lonth = lonths2026[i];
    assert.equal(lonth.dayCount, 28, `${lonth.id} must be exactly 28 days`);
    assert.equal(lonth.isStandard28, true);
    assert.equal(lonth.startDate.getDay(), 0, `${lonth.id} must start on Sunday`);
    assert.equal(lonth.endDate.getDay(), 6, `${lonth.id} must end on Saturday`);
    standardTotal += lonth.dayCount;
  }
  assert.equal(standardTotal, 336, "L02-L13 must sum to 336 days");

  // L02 date check: Jan 25 – Feb 21
  assert.equal(lonths2026[1].startDate.getMonth(), 0);
  assert.equal(lonths2026[1].startDate.getDate(), 25);
  assert.equal(lonths2026[1].endDate.getMonth(), 1);
  assert.equal(lonths2026[1].endDate.getDate(), 21);

  // L13 date check: Nov 29 – Dec 26
  assert.equal(lonths2026[12].startDate.getMonth(), 10);
  assert.equal(lonths2026[12].startDate.getDate(), 29);
  assert.equal(lonths2026[12].endDate.getMonth(), 11);
  assert.equal(lonths2026[12].endDate.getDate(), 26);

  // L14: Dec 27 – Dec 31 (5 days)
  assert.equal(lonths2026[13].id, "L14");
  assert.equal(lonths2026[13].dayCount, 5, "L14 in 2026 has 5 days");
  assert.equal(lonths2026[13].startDate.getMonth(), 11);
  assert.equal(lonths2026[13].startDate.getDate(), 27);
  assert.equal(lonths2026[13].endDate.getMonth(), 11);
  assert.equal(lonths2026[13].endDate.getDate(), 31);

  // Total invariant: 24 + 336 + 5 = 365
  const sum2026 = lonths2026.reduce((acc, l) => acc + l.dayCount, 0);
  assert.equal(sum2026, 365, "Total days must equal 365");
});

test("TIMES-CAL-001 Section 6 & 7: Leap year 2024 (366 days)", () => {
  const lonths2024 = buildYearLonths(2024);
  assert.equal(lonths2024.length, 14);

  // In 2024, Jan 1 is Monday -> first Sat is Jan 6 (6 days) + 21 = 27 days
  assert.equal(lonths2024[0].dayCount, 27);
  assert.equal(lonths2024[0].endDate.getDate(), 27);

  // L02-L13 = 336 days
  for (let i = 1; i <= 12; i++) {
    assert.equal(lonths2024[i].dayCount, 28);
  }

  // L14: remaining days
  // 366 - 27 - 336 = 3 days (Dec 29 - Dec 31)
  assert.equal(lonths2024[13].dayCount, 3);
  assert.equal(lonths2024[13].startDate.getDate(), 29);
  assert.equal(lonths2024[13].endDate.getDate(), 31);

  const sum2024 = lonths2024.reduce((acc, l) => acc + l.dayCount, 0);
  assert.equal(sum2024, 366, "Leap year 2024 total days must equal 366");

  // Verify Feb 29 exists and belongs to L03
  const leapDay = new Date(2024, 1, 29);
  const found = findLonthByDate(leapDay);
  assert.equal(found.id, "L03", "Feb 29, 2024 belongs to L03");
});

test("TIMES-CAL-001 Invariant: Every single day in year maps to exactly one Lonth without gap", () => {
  const years = [2022, 2023, 2024, 2025, 2026, 2027, 2028];
  for (const year of years) {
    const lonths = buildYearLonths(year);
    const totalDays = getDaysInYear(year);

    assert.equal(lonths.length, 14, `Year ${year} must have 14 Lonths`);
    const sumDays = lonths.reduce((acc, l) => acc + l.dayCount, 0);
    assert.equal(sumDays, totalDays, `Year ${year} sum of Lonth days must equal ${totalDays}`);

    // Continuity check: each Lonth begins the day after the previous
    for (let i = 1; i < 14; i++) {
      const prevEnd = lonths[i - 1].endDate;
      const curStart = lonths[i].startDate;
      const expectedStartDay = new Date(prevEnd);
      expectedStartDay.setDate(expectedStartDay.getDate() + 1);

      assert.equal(
        curStart.toDateString(),
        expectedStartDay.toDateString(),
        `${lonths[i].id} in ${year} must start the day after ${lonths[i - 1].id}`
      );
    }

    // Verify Jan 1 and Dec 31
    assert.equal(lonths[0].startDate.toDateString(), new Date(year, 0, 1).toDateString());
    assert.equal(lonths[13].endDate.toDateString(), new Date(year, 11, 31).toDateString());
  }
});

test("Date lookup and adjacent navigation", () => {
  // Target date: 2026-11-18
  const today = new Date(2026, 10, 18);
  const found = findLonthByDate(today);
  assert.equal(found.id, "L12", "Nov 18, 2026 is in L12 (Nov 1–28)");

  // Adjacent Lonth
  const prev = getAdjacentLonth(2026, "L12", -1);
  assert.equal(prev.lonthId, "L11");
  assert.equal(prev.year, 2026);

  const next = getAdjacentLonth(2026, "L12", 1);
  assert.equal(next.lonthId, "L13");
  assert.equal(next.year, 2026);

  // Year boundary rollover
  const afterL14 = getAdjacentLonth(2026, "L14", 1);
  assert.equal(afterL14.year, 2027);
  assert.equal(afterL14.lonthId, "L01");

  const beforeL01 = getAdjacentLonth(2026, "L01", -1);
  assert.equal(beforeL01.year, 2025);
  assert.equal(beforeL01.lonthId, "L14");
});

test("Format Lonth readable range", () => {
  const l01 = getLonthById(2026, "L01");
  const formattedTh = formatLonthRange(l01, "th");
  assert.ok(formattedTh.includes("ม.ค."), "Includes Thai month");

  const formattedEn = formatLonthRange(l01, "en");
  assert.ok(formattedEn.includes("Jan"), "Includes English month");
});
