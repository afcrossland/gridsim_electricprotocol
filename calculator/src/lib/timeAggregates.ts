import type { HourlyProfile } from "./types";

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Days in each month for a non-leap year - `HourlyProfile` is always 365x24 (no leap day), see its own doc comment. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Cumulative day-of-year (0-indexed) each month starts on - [0, 31, 59, 90, ...]. */
export const MONTH_START_DAY: number[] = DAYS_IN_MONTH.reduce<number[]>((acc, _days, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + DAYS_IN_MONTH[i - 1]);
  return acc;
}, []);

/** Sum of every hour's kWh into 365 daily totals. */
export function dailyTotals(profile: HourlyProfile): number[] {
  const days: number[] = new Array(365).fill(0);
  for (let h = 0; h < profile.length; h++) days[Math.floor(h / 24)] += profile[h];
  return days;
}

/** Average of each day's 24 hourly values - for a level quantity (e.g. battery state of charge), where summing would be meaningless. */
export function dailyAverages(profile: HourlyProfile): number[] {
  return dailyTotals(profile).map((total) => total / 24);
}

/** Sum of every hour's kWh into 12 monthly totals. */
export function monthlyTotals(profile: HourlyProfile): number[] {
  const months: number[] = new Array(12).fill(0);
  for (let day = 0; day < 365; day++) {
    const month = monthOfDay(day);
    const dayStart = day * 24;
    for (let h = 0; h < 24; h++) months[month] += profile[dayStart + h] ?? 0;
  }
  return months;
}

/** Which month (0-11) a day-of-year (0-364) falls in. */
export function monthOfDay(dayOfYear: number): number {
  let month = 0;
  while (month < 11 && dayOfYear >= MONTH_START_DAY[month + 1]) month++;
  return month;
}

/** "15 Mar" style label for a day-of-year (0-364). */
export function dayLabel(dayOfYear: number): string {
  const month = monthOfDay(dayOfYear);
  const dayOfMonth = dayOfYear - MONTH_START_DAY[month] + 1;
  return `${dayOfMonth} ${MONTH_NAMES[month]}`;
}

/** The 24 hourly kWh values for one day-of-year (0-364). */
export function hoursForDay(profile: HourlyProfile, dayOfYear: number): number[] {
  const start = dayOfYear * 24;
  return profile.slice(start, start + 24);
}

/** The hourly values across an inclusive day-of-year range [startDay, endDay] - drag-selecting a single day is just the startDay === endDay case. */
export function hoursForRange(profile: HourlyProfile, startDay: number, endDay: number): number[] {
  return profile.slice(startDay * 24, (endDay + 1) * 24);
}

/** "15 Mar" for a single day, "15 Mar - 22 Mar" for a range - for a drilled-down chart's own header. */
export function dayRangeLabel(startDay: number, endDay: number): string {
  return startDay === endDay ? dayLabel(startDay) : `${dayLabel(startDay)} - ${dayLabel(endDay)}`;
}
