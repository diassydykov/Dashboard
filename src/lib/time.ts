export const WEEKDAYS = [
  { value: 1, short: "Пн", label: "Понедельник" },
  { value: 2, short: "Вт", label: "Вторник" },
  { value: 3, short: "Ср", label: "Среда" },
  { value: 4, short: "Чт", label: "Четверг" },
  { value: 5, short: "Пт", label: "Пятница" },
  { value: 6, short: "Сб", label: "Суббота" },
] as const;

export const DISPLAY_TIMEZONE = "Asia/Almaty";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isHhMm(value: string): boolean {
  return TIME_RE.test(value);
}

export function toMinutes(hhmm: string): number {
  const match = TIME_RE.exec(hhmm);
  if (!match) {
    throw new Error(`Некорректное время: ${hhmm}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function durationMinutes(start: string, end: string): number {
  return toMinutes(end) - toMinutes(start);
}

/** Adjacent lessons (end === next start) do not overlap. */
export function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

export function weekdayLabel(value: number, short = false): string {
  const found = WEEKDAYS.find((day) => day.value === value);
  if (!found) return `День ${value}`;
  return short ? found.short : found.label;
}

export function shiftLabel(shift: "FIRST" | "SECOND"): string {
  return shift === "FIRST" ? "1 смена" : "2 смена";
}

export function classLabel(gradeNumber: number, letter: string): string {
  return `${gradeNumber} «${letter}»`;
}

export function parseClassLabel(value: string): { grade: number; letter: string } | null {
  const match = value.trim().match(/^(\d{1,2})\s*[«"']?\s*([A-Za-zА-Яа-яЁёІіҰұҚқҢңҒғӨөҮүҺһ])\s*[»"']?$/u);
  if (!match || match[1] === undefined || match[2] === undefined) return null;
  return { grade: Number(match[1]), letter: match[2].toUpperCase() };
}
