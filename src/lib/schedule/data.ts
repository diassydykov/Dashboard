import { Prisma, type Shift } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classLabel } from "@/lib/time";

export async function ensureScheduleVersions(schoolId: string, yearId: string) {
  const draft = await prisma.scheduleVersion.upsert({
    where: { yearId_kind: { yearId, kind: "draft" } },
    update: {},
    create: { schoolId, yearId, kind: "draft", name: "Черновик" },
  });
  const published = await prisma.scheduleVersion.upsert({
    where: { yearId_kind: { yearId, kind: "published" } },
    update: {},
    create: { schoolId, yearId, kind: "published", name: "Опубликовано" },
  });
  return { draft, published };
}

export function resolveBellProfile<T extends { shift: Shift; gradeFrom: number; gradeTo: number }>(
  profiles: T[],
  shift: Shift,
  gradeNumber: number,
) {
  return (
    profiles.find((item) => item.shift === shift && gradeNumber >= item.gradeFrom && gradeNumber <= item.gradeTo) ??
    null
  );
}

export async function getSlotsForClass(yearId: string, classGroupId: string, weekday?: number) {
  const classGroup = await prisma.classGroup.findFirst({
    where: { id: classGroupId, yearId },
    include: { grade: true },
  });
  if (!classGroup) return [];

  const profiles = await prisma.bellScheduleProfile.findMany({
    where: { yearId },
    include: { slots: { orderBy: [{ weekday: "asc" }, { lessonIndex: "asc" }] } },
  });
  const profile = resolveBellProfile(profiles, classGroup.shift, classGroup.grade.number);
  if (!profile) return [];
  return profile.slots.filter((slot) => (weekday ? slot.weekday === weekday : true));
}

const lessonInclude = {
  classGroup: { include: { grade: true } },
  subject: true,
  teacher: true,
  room: true,
} satisfies Prisma.LessonInclude;

export type LessonWithRefs = Prisma.LessonGetPayload<{ include: typeof lessonInclude }>;

export function mapOccupied(lessons: LessonWithRefs[]) {
  return lessons.map((lesson) => ({
    id: lesson.id,
    classGroupId: lesson.classGroupId,
    classLabel: classLabel(lesson.classGroup.grade.number, lesson.classGroup.letter),
    teacherId: lesson.teacherId,
    teacherName: lesson.teacher.shortName || lesson.teacher.fullName,
    roomId: lesson.roomId,
    roomName: lesson.room?.name ?? null,
    weekday: lesson.weekday,
    shift: lesson.shift,
    lessonIndex: lesson.lessonIndex,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    subjectName: lesson.subject.name,
  }));
}

export async function loadVersionLessons(versionId: string) {
  return prisma.lesson.findMany({
    where: { versionId },
    include: lessonInclude,
    orderBy: [{ weekday: "asc" }, { lessonIndex: "asc" }],
  });
}
