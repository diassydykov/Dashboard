import { intervalsOverlap, shiftLabel, weekdayLabel } from "@/lib/time";

export type OccupiedLesson = {
  id?: string;
  classGroupId: string;
  classLabel: string;
  teacherId: string;
  teacherName: string;
  roomId: string | null;
  roomName: string | null;
  weekday: number;
  shift: "FIRST" | "SECOND";
  lessonIndex: number;
  startTime: string;
  endTime: string;
  subjectName?: string;
};

export type ProposedLesson = {
  id?: string;
  classGroupId: string;
  classLabel: string;
  teacherId: string;
  teacherName: string;
  roomId?: string | null;
  roomName?: string | null;
  weekday: number;
  shift: "FIRST" | "SECOND";
  lessonIndex: number;
  startTime: string;
  endTime: string;
  subjectName?: string;
};

export type ConflictKind = "class" | "teacher" | "room" | "time";

export type ScheduleConflict = {
  kind: ConflictKind;
  message: string;
  otherLessonId?: string;
};

export function findConflicts(
  proposed: ProposedLesson,
  occupied: OccupiedLesson[],
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  if (proposed.startTime >= proposed.endTime) {
    conflicts.push({
      kind: "time",
      message: "Время окончания должно быть позже времени начала",
    });
  }

  for (const other of occupied) {
    if (proposed.id && other.id === proposed.id) continue;
    if (other.weekday !== proposed.weekday) continue;
    if (!intervalsOverlap(proposed.startTime, proposed.endTime, other.startTime, other.endTime)) {
      continue;
    }

    if (other.classGroupId === proposed.classGroupId) {
      conflicts.push({
        kind: "class",
        message: `${proposed.classLabel} уже занят в ${weekdayLabel(proposed.weekday, true)} ${other.startTime}–${other.endTime}${other.subjectName ? ` (${other.subjectName})` : ""}`,
        otherLessonId: other.id,
      });
    }

    if (other.teacherId === proposed.teacherId) {
      conflicts.push({
        kind: "teacher",
        message: `${proposed.teacherName} уже ведёт урок в ${weekdayLabel(proposed.weekday, true)} ${other.startTime}–${other.endTime} у ${other.classLabel}${other.subjectName ? ` (${other.subjectName})` : ""}`,
        otherLessonId: other.id,
      });
    }

    if (proposed.roomId && other.roomId && other.roomId === proposed.roomId) {
      conflicts.push({
        kind: "room",
        message: `Кабинет ${proposed.roomName ?? proposed.roomId} уже занят в ${weekdayLabel(proposed.weekday, true)} ${other.startTime}–${other.endTime} (${other.classLabel}, ${shiftLabel(other.shift)})`,
        otherLessonId: other.id,
      });
    }
  }

  return conflicts;
}

export function hasHardConflicts(proposed: ProposedLesson, occupied: OccupiedLesson[]) {
  return findConflicts(proposed, occupied).length > 0;
}
