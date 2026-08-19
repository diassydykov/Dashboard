import { describe, expect, it } from "vitest";
import { findConflicts } from "@/lib/conflicts";
import { generateSchedule } from "@/lib/scheduler/generate";
import type { GeneratorInput } from "@/lib/scheduler/types";

const slots = [1, 2, 3, 4, 5].flatMap((weekday) =>
  [
    { weekday, lessonIndex: 1, startTime: "08:00", endTime: "08:45" },
    { weekday, lessonIndex: 2, startTime: "08:55", endTime: "09:40" },
    { weekday, lessonIndex: 3, startTime: "09:50", endTime: "10:35" },
  ],
);

function baseInput(overrides: Partial<GeneratorInput> = {}): GeneratorInput {
  return {
    classes: [
      { id: "c5a", label: "5 «А»", shift: "FIRST", slots },
      { id: "c5b", label: "5 «Б»", shift: "FIRST", slots },
    ],
    teachers: [
      { id: "t1", name: "Иванова" },
      { id: "t2", name: "Петров" },
    ],
    rooms: [
      { id: "r1", name: "Каб. 1" },
      { id: "r2", name: "Каб. 2" },
    ],
    requests: [],
    seed: 1,
    maxIterations: 20_000,
    timeBudgetMs: 3_000,
    ...overrides,
  };
}

describe("findConflicts", () => {
  const occupied = [
    {
      id: "l1",
      classGroupId: "c5a",
      classLabel: "5 «А»",
      teacherId: "t1",
      teacherName: "Иванова",
      roomId: "r1",
      roomName: "Каб. 1",
      weekday: 1,
      shift: "FIRST" as const,
      lessonIndex: 1,
      startTime: "08:00",
      endTime: "08:45",
      subjectName: "Математика",
    },
  ];

  it("detects teacher overlap", () => {
    const conflicts = findConflicts(
      {
        classGroupId: "c5b",
        classLabel: "5 «Б»",
        teacherId: "t1",
        teacherName: "Иванова",
        roomId: "r2",
        roomName: "Каб. 2",
        weekday: 1,
        shift: "FIRST",
        lessonIndex: 1,
        startTime: "08:00",
        endTime: "08:45",
      },
      occupied,
    );
    expect(conflicts.some((item) => item.kind === "teacher")).toBe(true);
  });

  it("detects class overlap", () => {
    const conflicts = findConflicts(
      {
        classGroupId: "c5a",
        classLabel: "5 «А»",
        teacherId: "t2",
        teacherName: "Петров",
        weekday: 1,
        shift: "FIRST",
        lessonIndex: 1,
        startTime: "08:10",
        endTime: "08:55",
      },
      occupied,
    );
    expect(conflicts.some((item) => item.kind === "class")).toBe(true);
  });

  it("detects room overlap", () => {
    const conflicts = findConflicts(
      {
        classGroupId: "c5b",
        classLabel: "5 «Б»",
        teacherId: "t2",
        teacherName: "Петров",
        roomId: "r1",
        roomName: "Каб. 1",
        weekday: 1,
        shift: "FIRST",
        lessonIndex: 1,
        startTime: "08:00",
        endTime: "08:45",
      },
      occupied,
    );
    expect(conflicts.some((item) => item.kind === "room")).toBe(true);
  });

  it("allows adjacent lessons that only touch", () => {
    const conflicts = findConflicts(
      {
        classGroupId: "c5a",
        classLabel: "5 «А»",
        teacherId: "t1",
        teacherName: "Иванова",
        weekday: 1,
        shift: "FIRST",
        lessonIndex: 2,
        startTime: "08:45",
        endTime: "09:30",
      },
      occupied,
    );
    expect(conflicts).toHaveLength(0);
  });
});

describe("generateSchedule", () => {
  it("places the required weekly hours without hard conflicts", () => {
    const result = generateSchedule(
      baseInput({
        requests: [
          {
            id: "math-5a",
            classId: "c5a",
            subjectId: "math",
            subjectName: "Математика",
            teacherId: "t1",
            roomId: "r1",
            hours: 4,
            allowedDays: [1, 2, 3, 4, 5],
          },
          {
            id: "rus-5b",
            classId: "c5b",
            subjectId: "rus",
            subjectName: "Русский",
            teacherId: "t2",
            roomId: "r2",
            hours: 3,
            allowedDays: [],
          },
        ],
      }),
    );

    expect(result.unplaced).toHaveLength(0);
    expect(result.placed).toHaveLength(7);
    expect(result.placed.filter((item) => item.requestId === "math-5a")).toHaveLength(4);

    const occupied = result.placed.map((lesson, index) => ({
      id: String(index),
      classGroupId: lesson.classId,
      classLabel: lesson.classId,
      teacherId: lesson.teacherId,
      teacherName: lesson.teacherId,
      roomId: lesson.roomId,
      roomName: lesson.roomId,
      weekday: lesson.weekday,
      shift: lesson.shift,
      lessonIndex: lesson.lessonIndex,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
    }));

    for (const lesson of occupied) {
      const others = occupied.filter((item) => item.id !== lesson.id);
      expect(findConflicts(lesson, others)).toHaveLength(0);
    }
  });

  it("does not place two classes with the same teacher in one slot", () => {
    const result = generateSchedule(
      baseInput({
        requests: [
          {
            id: "a",
            classId: "c5a",
            subjectId: "math",
            subjectName: "Математика",
            teacherId: "t1",
            roomId: null,
            hours: 3,
            allowedDays: [1],
          },
          {
            id: "b",
            classId: "c5b",
            subjectId: "math",
            subjectName: "Математика",
            teacherId: "t1",
            roomId: null,
            hours: 3,
            allowedDays: [1],
          },
        ],
      }),
    );

    const monday = result.placed.filter((item) => item.weekday === 1);
    const keys = monday.map((item) => `${item.teacherId}-${item.startTime}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("reports an impossible constraint set instead of publishing overlaps", () => {
    const tinySlots = [{ weekday: 1, lessonIndex: 1, startTime: "08:00", endTime: "08:45" }];
    const result = generateSchedule(
      baseInput({
        classes: [
          { id: "c5a", label: "5 «А»", shift: "FIRST", slots: tinySlots },
          { id: "c5b", label: "5 «Б»", shift: "FIRST", slots: tinySlots },
        ],
        requests: [
          {
            id: "a",
            classId: "c5a",
            subjectId: "math",
            subjectName: "Математика",
            teacherId: "t1",
            roomId: "r1",
            hours: 1,
            allowedDays: [1],
          },
          {
            id: "b",
            classId: "c5b",
            subjectId: "math",
            subjectName: "Математика",
            teacherId: "t1",
            roomId: "r1",
            hours: 1,
            allowedDays: [1],
          },
        ],
      }),
    );

    expect(result.placed.length + result.unplaced.length).toBe(2);
    expect(result.unplaced.length).toBeGreaterThan(0);
    expect(result.placed).toHaveLength(1);
  });
});
