import { Prisma } from "@prisma/client";
import { findConflicts } from "@/lib/conflicts";
import { prisma } from "@/lib/prisma";
import { generateSchedule } from "@/lib/scheduler/generate";
import type { GeneratorInput } from "@/lib/scheduler/types";
import {
  ensureScheduleVersions,
  loadVersionLessons,
  mapOccupied,
  resolveBellProfile,
} from "@/lib/schedule/data";
import { classLabel } from "@/lib/time";
import type { LessonInput } from "@/lib/validations";

export class DomainError extends Error {
  constructor(
    message: string,
    public details?: string[],
  ) {
    super(message);
    this.name = "DomainError";
  }
}

async function loadClassContext(yearId: string, classGroupId: string) {
  const classGroup = await prisma.classGroup.findFirst({
    where: { id: classGroupId, yearId },
    include: { grade: true },
  });
  if (!classGroup) {
    throw new DomainError("Класс не найден");
  }
  const profiles = await prisma.bellScheduleProfile.findMany({
    where: { yearId },
    include: { slots: true },
  });
  const profile = resolveBellProfile(profiles, classGroup.shift, classGroup.grade.number);
  return { classGroup, profile };
}

export async function upsertLesson(params: {
  schoolId: string;
  yearId: string;
  payload: LessonInput;
  lessonId?: string;
}) {
  const { draft } = await ensureScheduleVersions(params.schoolId, params.yearId);
  const { classGroup, profile } = await loadClassContext(params.yearId, params.payload.classGroupId);
  if (!profile) {
    throw new DomainError("Нет профиля звонков для этой смены и параллели");
  }

  const slot = profile.slots.find(
    (item) => item.weekday === params.payload.weekday && item.lessonIndex === params.payload.lessonIndex,
  );
  if (!slot) {
    throw new DomainError("Нет такого урока в сетке звонков на выбранный день");
  }

  const startTime = params.payload.startTime ?? slot.startTime;
  const endTime = params.payload.endTime ?? slot.endTime;

  const [teacher, subject, room] = await Promise.all([
    prisma.teacher.findFirst({ where: { id: params.payload.teacherId, schoolId: params.schoolId } }),
    prisma.subject.findFirst({ where: { id: params.payload.subjectId, schoolId: params.schoolId } }),
    params.payload.roomId
      ? prisma.room.findFirst({ where: { id: params.payload.roomId, schoolId: params.schoolId } })
      : Promise.resolve(null),
  ]);
  if (!teacher) throw new DomainError("Учитель не найден");
  if (!subject) throw new DomainError("Предмет не найден");
  if (params.payload.roomId && !room) throw new DomainError("Кабинет не найден");

  const occupied = mapOccupied(await loadVersionLessons(draft.id));
  const conflicts = findConflicts(
    {
      id: params.lessonId,
      classGroupId: classGroup.id,
      classLabel: classLabel(classGroup.grade.number, classGroup.letter),
      teacherId: teacher.id,
      teacherName: teacher.shortName || teacher.fullName,
      roomId: room?.id ?? null,
      roomName: room?.name ?? null,
      weekday: params.payload.weekday,
      shift: classGroup.shift,
      lessonIndex: params.payload.lessonIndex,
      startTime,
      endTime,
      subjectName: subject.name,
    },
    occupied,
  );
  if (conflicts.length > 0) {
    throw new DomainError("Урок создаёт конфликт", conflicts.map((item) => item.message));
  }

  const data = {
    schoolId: params.schoolId,
    yearId: params.yearId,
    versionId: draft.id,
    classGroupId: classGroup.id,
    subjectId: subject.id,
    teacherId: teacher.id,
    roomId: room?.id ?? null,
    weekday: params.payload.weekday,
    shift: classGroup.shift,
    lessonIndex: params.payload.lessonIndex,
    startTime,
    endTime,
  };

  if (params.lessonId) {
    const existing = await prisma.lesson.findFirst({
      where: { id: params.lessonId, versionId: draft.id, schoolId: params.schoolId },
    });
    if (!existing) throw new DomainError("Урок не найден в черновике");
    return prisma.lesson.update({ where: { id: existing.id }, data });
  }

  try {
    return await prisma.lesson.create({ data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError("У этого класса уже есть урок в этом слоте");
    }
    throw error;
  }
}

export async function deleteLesson(schoolId: string, yearId: string, lessonId: string) {
  const { draft } = await ensureScheduleVersions(schoolId, yearId);
  const existing = await prisma.lesson.findFirst({
    where: { id: lessonId, versionId: draft.id, schoolId },
  });
  if (!existing) throw new DomainError("Урок не найден в черновике");
  await prisma.lesson.delete({ where: { id: existing.id } });
}

export async function generateDraftSchedule(schoolId: string, yearId: string, seed = 202627) {
  const year = await prisma.academicYear.findFirst({
    where: { id: yearId, schoolId },
  });
  if (!year) throw new DomainError("Учебный год не найден");
  const { draft } = await ensureScheduleVersions(schoolId, yearId);

  const [classes, teachers, rooms, requirements, profiles] = await Promise.all([
    prisma.classGroup.findMany({ where: { yearId, schoolId }, include: { grade: true } }),
    prisma.teacher.findMany({ where: { schoolId, isActive: true } }),
    prisma.room.findMany({ where: { schoolId } }),
    prisma.curriculumRequirement.findMany({
      where: { yearId, schoolId },
      include: { subject: true, classGroup: { include: { grade: true } } },
    }),
    prisma.bellScheduleProfile.findMany({
      where: { yearId, schoolId },
      include: { slots: true },
    }),
  ]);

  const weekdays = year.includeSaturday ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];

  const input: GeneratorInput = {
    seed,
    classes: classes.map((item) => {
      const profile = resolveBellProfile(profiles, item.shift, item.grade.number);
      const slots = (profile?.slots ?? [])
        .filter((slot) => weekdays.includes(slot.weekday))
        .map((slot) => ({
          weekday: slot.weekday,
          lessonIndex: slot.lessonIndex,
          startTime: slot.startTime,
          endTime: slot.endTime,
        }));
      return {
        id: item.id,
        label: classLabel(item.grade.number, item.letter),
        shift: item.shift,
        slots,
      };
    }),
    teachers: teachers.map((item) => ({ id: item.id, name: item.shortName || item.fullName })),
    rooms: rooms.map((item) => ({ id: item.id, name: item.name })),
    requests: requirements
      .filter((item) => item.preferredTeacherId)
      .map((item) => ({
        id: item.id,
        classId: item.classGroupId,
        subjectId: item.subjectId,
        subjectName: item.subject.name,
        teacherId: item.preferredTeacherId as string,
        roomId: item.preferredRoomId,
        hours: Number(item.hoursPerWeek),
        allowedDays: item.allowedDays,
      })),
  };

  const missingTeacher = requirements.filter((item) => !item.preferredTeacherId);
  const result = generateSchedule(input);

  await prisma.$transaction(async (tx) => {
    await tx.lesson.deleteMany({ where: { versionId: draft.id } });
    if (result.placed.length > 0) {
      await tx.lesson.createMany({
        data: result.placed.map((lesson) => {
          const classGroup = classes.find((item) => item.id === lesson.classId)!;
          return {
            schoolId,
            yearId,
            versionId: draft.id,
            classGroupId: lesson.classId,
            subjectId: lesson.subjectId,
            teacherId: lesson.teacherId,
            roomId: lesson.roomId,
            requirementId: lesson.requestId,
            weekday: lesson.weekday,
            shift: classGroup.shift,
            lessonIndex: lesson.lessonIndex,
            startTime: lesson.startTime,
            endTime: lesson.endTime,
          };
        }),
      });
    }
    await tx.scheduleVersion.update({
      where: { id: draft.id },
      data: { name: `Черновик · seed ${result.seed}` },
    });
  });

  return {
    ...result,
    skippedWithoutTeacher: missingTeacher.map((item) => ({
      classLabel: classLabel(item.classGroup.grade.number, item.classGroup.letter),
      subjectName: item.subject.name,
      reason: "Не назначен учитель в нагрузке",
      suggestion: "Укажите преподавателя в учебном плане",
    })),
  };
}

export async function publishDraft(schoolId: string, yearId: string) {
  const { draft, published } = await ensureScheduleVersions(schoolId, yearId);
  const lessons = await loadVersionLessons(draft.id);
  const occupied = mapOccupied(lessons);
  const conflicts: string[] = [];
  for (const lesson of occupied) {
    const others = occupied.filter((item) => item.id !== lesson.id);
    for (const conflict of findConflicts(lesson, others)) {
      conflicts.push(conflict.message);
    }
  }
  if (conflicts.length > 0) {
    throw new DomainError("Нельзя опубликовать расписание с конфликтами", [...new Set(conflicts)]);
  }

  await prisma.$transaction(async (tx) => {
    await tx.lesson.deleteMany({ where: { versionId: published.id } });
    if (lessons.length > 0) {
      await tx.lesson.createMany({
        data: lessons.map((lesson) => ({
          schoolId,
          yearId,
          versionId: published.id,
          classGroupId: lesson.classGroupId,
          subjectId: lesson.subjectId,
          teacherId: lesson.teacherId,
          roomId: lesson.roomId,
          requirementId: lesson.requirementId,
          weekday: lesson.weekday,
          shift: lesson.shift,
          lessonIndex: lesson.lessonIndex,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
        })),
      });
    }
    await tx.scheduleVersion.update({
      where: { id: published.id },
      data: { name: `Опубликовано ${new Date().toLocaleString("ru-KZ", { timeZone: "Asia/Almaty" })}` },
    });
  });
}

export async function collectAllConflicts(versionId: string) {
  const lessons = await loadVersionLessons(versionId);
  const occupied = mapOccupied(lessons);
  const messages: string[] = [];
  for (const lesson of occupied) {
    const others = occupied.filter((item) => item.id !== lesson.id);
    for (const conflict of findConflicts(lesson, others)) {
      messages.push(conflict.message);
    }
  }
  return [...new Set(messages)];
}
