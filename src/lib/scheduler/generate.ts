import { findConflicts, type OccupiedLesson } from "@/lib/conflicts";
import type {
  GeneratorClass,
  GeneratorInput,
  GeneratorResult,
  GeneratorSlot,
  PlacedLesson,
  UnplacedLesson,
} from "@/lib/scheduler/types";

class Mulberry32 {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next() {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

type Unit = {
  key: string;
  requestId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  roomId: string | null;
  allowedDays: number[];
  classLabel: string;
  shift: GeneratorClass["shift"];
};

function classMap(input: GeneratorInput) {
  return new Map(input.classes.map((item) => [item.id, item]));
}

function teacherName(input: GeneratorInput, id: string) {
  return input.teachers.find((item) => item.id === id)?.name ?? id;
}

function roomName(input: GeneratorInput, id: string | null) {
  if (!id) return null;
  return input.rooms.find((item) => item.id === id)?.name ?? id;
}

function toOccupied(placed: PlacedLesson[], input: GeneratorInput): OccupiedLesson[] {
  const classes = classMap(input);
  return placed.map((lesson, index) => ({
    id: `placed-${index}`,
    classGroupId: lesson.classId,
    classLabel: classes.get(lesson.classId)?.label ?? lesson.classId,
    teacherId: lesson.teacherId,
    teacherName: teacherName(input, lesson.teacherId),
    roomId: lesson.roomId,
    roomName: roomName(input, lesson.roomId),
    weekday: lesson.weekday,
    shift: lesson.shift,
    lessonIndex: lesson.lessonIndex,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    subjectName: lesson.subjectName,
  }));
}

function candidateSlots(unit: Unit, classItem: GeneratorClass): GeneratorSlot[] {
  return classItem.slots.filter(
    (slot) => unit.allowedDays.length === 0 || unit.allowedDays.includes(slot.weekday),
  );
}

function isFeasible(
  unit: Unit,
  slot: GeneratorSlot,
  placed: PlacedLesson[],
  input: GeneratorInput,
) {
  const classItem = classMap(input).get(unit.classId);
  if (!classItem) return false;
  return (
    findConflicts(
      {
        classGroupId: unit.classId,
        classLabel: classItem.label,
        teacherId: unit.teacherId,
        teacherName: teacherName(input, unit.teacherId),
        roomId: unit.roomId,
        roomName: roomName(input, unit.roomId),
        weekday: slot.weekday,
        shift: unit.shift,
        lessonIndex: slot.lessonIndex,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subjectName: unit.subjectName,
      },
      toOccupied(placed, input),
    ).length === 0
  );
}

function sameSubjectCount(placed: PlacedLesson[], unit: Unit, weekday: number) {
  return placed.filter(
    (lesson) =>
      lesson.classId === unit.classId &&
      lesson.subjectId === unit.subjectId &&
      lesson.weekday === weekday,
  ).length;
}

function teacherGapPenalty(placed: PlacedLesson[], unit: Unit, slot: GeneratorSlot) {
  const sameDay = placed
    .filter((lesson) => lesson.teacherId === unit.teacherId && lesson.weekday === slot.weekday)
    .map((lesson) => lesson.lessonIndex);
  if (sameDay.length === 0) return 2;
  const min = Math.min(...sameDay);
  const max = Math.max(...sameDay);
  if (slot.lessonIndex >= min - 1 && slot.lessonIndex <= max + 1) return 0;
  return Math.min(Math.abs(slot.lessonIndex - min), Math.abs(slot.lessonIndex - max));
}

function scoreSlot(
  unit: Unit,
  slot: GeneratorSlot,
  placed: PlacedLesson[],
  input: GeneratorInput,
  maxSame: number,
  rng: Mulberry32,
) {
  let score = 0;
  const same = sameSubjectCount(placed, unit, slot.weekday);
  if (same >= maxSame) score += 80;
  else score += same * 12;
  score += teacherGapPenalty(placed, unit, slot) * 6;
  score +=
    placed.filter((lesson) => lesson.classId === unit.classId && lesson.weekday === slot.weekday)
      .length * 3;
  score += slot.lessonIndex;
  score += rng.next();
  return score;
}

function expandUnits(input: GeneratorInput): { units: Unit[]; skipped: UnplacedLesson[] } {
  const classes = classMap(input);
  const units: Unit[] = [];
  const skipped: UnplacedLesson[] = [];

  for (const request of input.requests) {
    const classItem = classes.get(request.classId);
    if (!classItem) {
      skipped.push({
        requestId: request.id,
        classId: request.classId,
        subjectName: request.subjectName,
        teacherId: request.teacherId,
        reason: "Класс не найден",
        suggestion: "Проверьте импорт классов",
      });
      continue;
    }
    const hours = Math.round(request.hours);
    if (hours <= 0) {
      skipped.push({
        requestId: request.id,
        classId: request.classId,
        subjectName: request.subjectName,
        teacherId: request.teacherId,
        reason: "Нулевая нагрузка",
        suggestion: "Укажите целое число часов в неделю больше нуля",
      });
      continue;
    }
    for (let i = 0; i < hours; i += 1) {
      units.push({
        key: `${request.id}#${i}`,
        requestId: request.id,
        classId: request.classId,
        subjectId: request.subjectId,
        subjectName: request.subjectName,
        teacherId: request.teacherId,
        roomId: request.roomId,
        allowedDays: request.allowedDays,
        classLabel: classItem.label,
        shift: classItem.shift,
      });
    }
  }
  return { units, skipped };
}

function describeFailure(unit: Unit, classItem: GeneratorClass | undefined): UnplacedLesson {
  if (!classItem || classItem.slots.length === 0) {
    return {
      requestId: unit.requestId,
      classId: unit.classId,
      subjectName: unit.subjectName,
      teacherId: unit.teacherId,
      reason: `Нет слотов звонков для ${unit.classLabel}`,
      suggestion: "Заполните расписание звонков для этой смены и параллели",
    };
  }
  return {
    requestId: unit.requestId,
    classId: unit.classId,
    subjectName: unit.subjectName,
    teacherId: unit.teacherId,
    reason: `Не удалось разместить «${unit.subjectName}» для ${unit.classLabel}: все слоты конфликтуют`,
    suggestion:
      "Ослабьте разрешённые дни, уберите жёсткий кабинет, снизьте нагрузку преподавателя или добавьте уроки в сетку звонков",
  };
}

function placeLesson(unit: Unit, slot: GeneratorSlot): PlacedLesson {
  return {
    requestId: unit.requestId,
    classId: unit.classId,
    subjectId: unit.subjectId,
    subjectName: unit.subjectName,
    teacherId: unit.teacherId,
    roomId: unit.roomId,
    weekday: slot.weekday,
    lessonIndex: slot.lessonIndex,
    startTime: slot.startTime,
    endTime: slot.endTime,
    shift: unit.shift,
  };
}

export function generateSchedule(input: GeneratorInput): GeneratorResult {
  const seed = input.seed ?? 202627;
  const rng = new Mulberry32(seed);
  const maxIterations = input.maxIterations ?? 80_000;
  const timeBudgetMs = input.timeBudgetMs ?? 4_000;
  const maxSame = input.maxSameSubjectPerDay ?? 2;
  const started = Date.now();
  const classes = classMap(input);
  const { units, skipped } = expandUnits(input);

  units.sort((a, b) => {
    const aClass = classes.get(a.classId);
    const bClass = classes.get(b.classId);
    const aDomain = aClass ? candidateSlots(a, aClass).length : 0;
    const bDomain = bClass ? candidateSlots(b, bClass).length : 0;
    if (aDomain !== bDomain) return aDomain - bDomain;
    const aHours = units.filter((item) => item.requestId === a.requestId).length;
    const bHours = units.filter((item) => item.requestId === b.requestId).length;
    return bHours - aHours;
  });

  const placed: PlacedLesson[] = [];
  let bestPlaced: PlacedLesson[] = [];
  let iterations = 0;
  let timedOut = false;

  const search = (open: Unit[]): boolean => {
    if (placed.length > bestPlaced.length) {
      bestPlaced = placed.slice();
    }
    if (open.length === 0) return true;
    if (Date.now() - started > timeBudgetMs || iterations > maxIterations) {
      timedOut = true;
      return false;
    }

    let bestIndex = 0;
    let bestCount = Number.POSITIVE_INFINITY;
    for (let i = 0; i < open.length; i += 1) {
      const unit = open[i];
      if (!unit) continue;
      const classItem = classes.get(unit.classId);
      const count = classItem
        ? candidateSlots(unit, classItem).filter((slot) => isFeasible(unit, slot, placed, input)).length
        : 0;
      if (count < bestCount) {
        bestCount = count;
        bestIndex = i;
        if (count === 0) break;
      }
    }

    const unit = open[bestIndex];
    if (!unit) return false;
    const rest = open.filter((_, index) => index !== bestIndex);
    const classItem = classes.get(unit.classId);
    const options = (classItem ? candidateSlots(unit, classItem) : [])
      .filter((slot) => isFeasible(unit, slot, placed, input))
      .sort(
        (a, b) =>
          scoreSlot(unit, a, placed, input, maxSame, rng) -
          scoreSlot(unit, b, placed, input, maxSame, rng),
      );

    iterations += 1;

    for (const slot of options) {
      placed.push(placeLesson(unit, slot));
      if (search(rest)) return true;
      placed.pop();
      if (timedOut) return false;
    }

    return false;
  };

  const solved = search([...units]);
  if (!solved) {
    placed.splice(0, placed.length, ...bestPlaced);
  }

  const unplaced: UnplacedLesson[] = [...skipped];
  if (!solved) {
    const remaining = units.filter((unit) => {
      const used = placed.filter((lesson) => lesson.requestId === unit.requestId).length;
      const total = units.filter((item) => item.requestId === unit.requestId).length;
      const already = unplaced.filter((item) => item.requestId === unit.requestId).length;
      return used + already < total;
    });
    const seen = new Set<string>();
    for (const unit of remaining) {
      const used = placed.filter((lesson) => lesson.requestId === unit.requestId).length;
      const total = units.filter((item) => item.requestId === unit.requestId).length;
      const missing = total - used;
      if (missing <= 0) continue;
      for (let i = 0; i < missing; i += 1) {
        const key = `${unit.requestId}:${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unplaced.push(describeFailure(unit, classes.get(unit.classId)));
      }
    }
  }

  return {
    placed,
    unplaced,
    iterations,
    timedOut,
    seed,
  };
}
