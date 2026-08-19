import { Prisma, type ImportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ParsedClassRow,
  ParsedNormRow,
  ParsedRoomRow,
  ParsedTeacherRow,
  ParsedWorkloadRow,
} from "@/lib/excel/parse";

export async function applyClassImport(params: {
  schoolId: string;
  yearId: string;
  rows: ParsedClassRow[];
  replaceAll: boolean;
}) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.classGroup.findMany({
      where: { yearId: params.yearId, schoolId: params.schoolId },
      include: { grade: true },
    });
    const keep = new Set<string>();

    for (const row of params.rows) {
      const grade = await tx.grade.upsert({
        where: { schoolId_number: { schoolId: params.schoolId, number: row.grade } },
        update: {},
        create: { schoolId: params.schoolId, number: row.grade },
      });
      const found = existing.find(
        (item) => item.grade.number === row.grade && item.letter === row.letter,
      );
      if (found) {
        await tx.classGroup.update({
          where: { id: found.id },
          data: { language: row.language, shift: row.shift, gradeId: grade.id },
        });
        keep.add(found.id);
      } else {
        const created = await tx.classGroup.create({
          data: {
            schoolId: params.schoolId,
            yearId: params.yearId,
            gradeId: grade.id,
            letter: row.letter,
            language: row.language,
            shift: row.shift,
          },
        });
        keep.add(created.id);
      }
    }

    if (params.replaceAll) {
      await tx.classGroup.deleteMany({
        where: { yearId: params.yearId, schoolId: params.schoolId, id: { notIn: [...keep] } },
      });
    }
  });
}

export async function applyTeacherImport(params: {
  schoolId: string;
  rows: ParsedTeacherRow[];
  replaceAll: boolean;
}) {
  await prisma.$transaction(async (tx) => {
    const keep = new Set<string>();
    for (const row of params.rows) {
      const teacher = await tx.teacher.upsert({
        where: { schoolId_fullName: { schoolId: params.schoolId, fullName: row.fullName } },
        update: { shortName: row.shortName, email: row.email, isActive: true },
        create: {
          schoolId: params.schoolId,
          fullName: row.fullName,
          shortName: row.shortName,
          email: row.email,
          isActive: true,
        },
      });
      keep.add(teacher.id);

      const subjectIds: string[] = [];
      for (const name of row.subjects) {
        const subject = await tx.subject.upsert({
          where: { schoolId_name: { schoolId: params.schoolId, name } },
          update: {},
          create: { schoolId: params.schoolId, name, shortName: name.slice(0, 6) },
        });
        subjectIds.push(subject.id);
      }
      await tx.teacherSubject.deleteMany({ where: { teacherId: teacher.id } });
      await tx.teacherSubject.createMany({
        data: subjectIds.map((subjectId) => ({ teacherId: teacher.id, subjectId })),
      });
    }

    if (params.replaceAll) {
      await tx.teacher.updateMany({
        where: { schoolId: params.schoolId, id: { notIn: [...keep] } },
        data: { isActive: false },
      });
    }
  });
}

export async function applyRoomImport(params: {
  schoolId: string;
  rows: ParsedRoomRow[];
  replaceAll: boolean;
}) {
  await prisma.$transaction(async (tx) => {
    const keep = new Set<string>();
    for (const row of params.rows) {
      const room = await tx.room.upsert({
        where: { schoolId_name: { schoolId: params.schoolId, name: row.name } },
        update: { capacity: row.capacity },
        create: { schoolId: params.schoolId, name: row.name, capacity: row.capacity },
      });
      keep.add(room.id);
    }
    if (params.replaceAll) {
      await tx.room.deleteMany({
        where: { schoolId: params.schoolId, id: { notIn: [...keep] } },
      });
    }
  });
}

export async function applyWorkloadImport(params: {
  schoolId: string;
  yearId: string;
  rows: ParsedWorkloadRow[];
  replaceAll: boolean;
  issues: Array<{ row: number; message: string }>;
}) {
  const classes = await prisma.classGroup.findMany({
    where: { yearId: params.yearId, schoolId: params.schoolId },
    include: { grade: true },
  });
  const teachers = await prisma.teacher.findMany({ where: { schoolId: params.schoolId } });
  const rooms = await prisma.room.findMany({ where: { schoolId: params.schoolId } });

  const resolved: Array<{
    classGroupId: string;
    subjectName: string;
    hours: number;
    teacherId: string;
    roomId: string | null;
    allowedDays: number[];
  }> = [];

  for (const row of params.rows) {
    const classGroup = classes.find(
      (item) => item.grade.number === row.grade && item.letter === row.letter,
    );
    if (!classGroup) {
      params.issues.push({ row: row.row, message: `Класс ${row.classLabel} не найден. Сначала импортируйте классы.` });
      continue;
    }
    const teacher = teachers.find((item) => item.fullName.toLowerCase() === row.teacher.toLowerCase());
    if (!teacher) {
      params.issues.push({ row: row.row, message: `Учитель «${row.teacher}» не найден. Сначала импортируйте учителей.` });
      continue;
    }
    let roomId: string | null = null;
    if (row.room) {
      const room = rooms.find((item) => item.name.toLowerCase() === row.room!.toLowerCase());
      if (!room) {
        params.issues.push({ row: row.row, message: `Кабинет «${row.room}» не найден` });
        continue;
      }
      roomId = room.id;
    }
    resolved.push({
      classGroupId: classGroup.id,
      subjectName: row.subject,
      hours: row.hoursPerWeek,
      teacherId: teacher.id,
      roomId,
      allowedDays: row.allowedDays,
    });
  }

  if (params.issues.length > 0) return;

  await prisma.$transaction(async (tx) => {
    const keep = new Set<string>();
    for (const row of resolved) {
      const subject = await tx.subject.upsert({
        where: { schoolId_name: { schoolId: params.schoolId, name: row.subjectName } },
        update: {},
        create: { schoolId: params.schoolId, name: row.subjectName },
      });
      const requirement = await tx.curriculumRequirement.upsert({
        where: {
          yearId_classGroupId_subjectId: {
            yearId: params.yearId,
            classGroupId: row.classGroupId,
            subjectId: subject.id,
          },
        },
        update: {
          hoursPerWeek: new Prisma.Decimal(row.hours),
          preferredTeacherId: row.teacherId,
          preferredRoomId: row.roomId,
          allowedDays: row.allowedDays,
        },
        create: {
          schoolId: params.schoolId,
          yearId: params.yearId,
          classGroupId: row.classGroupId,
          subjectId: subject.id,
          hoursPerWeek: new Prisma.Decimal(row.hours),
          preferredTeacherId: row.teacherId,
          preferredRoomId: row.roomId,
          allowedDays: row.allowedDays,
        },
      });
      keep.add(requirement.id);
    }
    if (params.replaceAll) {
      await tx.curriculumRequirement.deleteMany({
        where: { yearId: params.yearId, schoolId: params.schoolId, id: { notIn: [...keep] } },
      });
    }
  });
}

export async function applyNormImport(params: {
  schoolId: string;
  yearId: string;
  rows: ParsedNormRow[];
  fileName: string;
}) {
  const subjects = await prisma.subject.findMany({ where: { schoolId: params.schoolId } });
  await prisma.$transaction(async (tx) => {
    await tx.curriculumNormVersion.updateMany({
      where: { yearId: params.yearId },
      data: { isActive: false },
    });
    await tx.curriculumNormVersion.create({
      data: {
        schoolId: params.schoolId,
        yearId: params.yearId,
        name: `Импорт ${new Date().toLocaleString("ru-KZ", { timeZone: "Asia/Almaty" })}`,
        isActive: true,
        source: "import",
        notes: params.fileName,
        items: {
          create: params.rows.map((row) => ({
            gradeNumber: row.grade,
            language: row.language,
            planType: row.planType,
            subjectName: row.subject,
            hoursPerWeek: new Prisma.Decimal(row.hoursPerWeek),
            subjectId: subjects.find((item) => item.name.toLowerCase() === row.subject.toLowerCase())?.id,
          })),
        },
      },
    });
  });
}

export async function recordImport(params: {
  schoolId: string;
  yearId: string | null;
  type: ImportType;
  fileName: string;
  createdBy: string;
  rowCount: number;
  errorCount: number;
  report: unknown;
  applied: boolean;
}) {
  return prisma.importBatch.create({
    data: {
      schoolId: params.schoolId,
      yearId: params.yearId,
      type: params.type,
      status: params.applied ? "applied" : params.errorCount > 0 ? "failed" : "previewed",
      fileName: params.fileName,
      rowCount: params.rowCount,
      errorCount: params.errorCount,
      reportJson: params.report as Prisma.InputJsonValue,
      createdBy: params.createdBy,
    },
  });
}
