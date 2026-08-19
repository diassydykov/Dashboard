import { toMinutes } from "@/lib/time";

export type BellSlotInput = {
  lessonIndex: number;
  startTime: string;
  endTime: string;
};

export type BellOverlapError = {
  a: number;
  b: number;
  message: string;
};

export function findBellOverlaps(slots: BellSlotInput[]): BellOverlapError[] {
  const ordered = [...slots].sort((a, b) => a.lessonIndex - b.lessonIndex);
  const errors: BellOverlapError[] = [];

  for (const slot of ordered) {
    if (toMinutes(slot.startTime) >= toMinutes(slot.endTime)) {
      errors.push({
        a: slot.lessonIndex,
        b: slot.lessonIndex,
        message: `Урок ${slot.lessonIndex}: окончание должно быть позже начала`,
      });
    }
  }

  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const a = ordered[i];
      const b = ordered[j];
      if (!a || !b) continue;
      if (toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime)) {
        errors.push({
          a: a.lessonIndex,
          b: b.lessonIndex,
          message: `Уроки ${a.lessonIndex} и ${b.lessonIndex} пересекаются по времени`,
        });
      }
    }
  }

  return errors;
}

export function breaksBetween(slots: BellSlotInput[]) {
  const ordered = [...slots].sort((a, b) => a.lessonIndex - b.lessonIndex);
  const breaks: Array<{ afterLesson: number; minutes: number; start: string; end: string }> = [];
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const current = ordered[i];
    const next = ordered[i + 1];
    if (!current || !next) continue;
    const minutes = toMinutes(next.startTime) - toMinutes(current.endTime);
    breaks.push({
      afterLesson: current.lessonIndex,
      minutes,
      start: current.endTime,
      end: next.startTime,
    });
  }
  return breaks;
}
