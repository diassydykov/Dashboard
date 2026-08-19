"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { assertCanWrite, requireAppContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function upsertRequirementAction(formData: FormData) {
  const ctx = await requireAppContext();
  assertCanWrite(ctx);
  if (!ctx.year) return { ok: false as const, error: "Нет учебного года" };

  const classGroupId = String(formData.get("classGroupId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const teacherId = String(formData.get("teacherId") ?? "") || null;
  const roomId = String(formData.get("roomId") ?? "") || null;
  const hours = Number(formData.get("hoursPerWeek"));
  const allowedRaw = String(formData.get("allowedDays") ?? "");
  const allowedDays = allowedRaw
    .split(/[,\s]+/)
    .map(Number)
    .filter((item) => item >= 1 && item <= 6);

  if (!classGroupId || !subjectId || !Number.isFinite(hours) || hours <= 0) {
    return { ok: false as const, error: "Заполните класс, предмет и часы" };
  }

  const classGroup = await prisma.classGroup.findFirst({
    where: { id: classGroupId, schoolId: ctx.school.id, yearId: ctx.year.id },
  });
  if (!classGroup) return { ok: false as const, error: "Класс другой школы" };

  await prisma.curriculumRequirement.upsert({
    where: {
      yearId_classGroupId_subjectId: {
        yearId: ctx.year.id,
        classGroupId,
        subjectId,
      },
    },
    update: {
      hoursPerWeek: new Prisma.Decimal(hours),
      preferredTeacherId: teacherId,
      preferredRoomId: roomId,
      allowedDays,
    },
    create: {
      schoolId: ctx.school.id,
      yearId: ctx.year.id,
      classGroupId,
      subjectId,
      hoursPerWeek: new Prisma.Decimal(hours),
      preferredTeacherId: teacherId,
      preferredRoomId: roomId,
      allowedDays,
    },
  });
  revalidatePath("/curriculum");
  return { ok: true as const };
}

export async function deleteRequirementAction(id: string) {
  const ctx = await requireAppContext();
  assertCanWrite(ctx);
  await prisma.curriculumRequirement.deleteMany({
    where: { id, schoolId: ctx.school.id },
  });
  revalidatePath("/curriculum");
}

export async function activateNormVersionAction(id: string) {
  const ctx = await requireAppContext();
  assertCanWrite(ctx);
  if (!ctx.year) return;
  await prisma.$transaction([
    prisma.curriculumNormVersion.updateMany({
      where: { yearId: ctx.year.id },
      data: { isActive: false },
    }),
    prisma.curriculumNormVersion.updateMany({
      where: { id, schoolId: ctx.school.id, yearId: ctx.year.id },
      data: { isActive: true },
    }),
  ]);
  revalidatePath("/curriculum");
}

export async function createSubjectAction(formData: FormData) {
  const ctx = await requireAppContext();
  assertCanWrite(ctx);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.subject.upsert({
    where: { schoolId_name: { schoolId: ctx.school.id, name } },
    update: {},
    create: { schoolId: ctx.school.id, name },
  });
  revalidatePath("/curriculum");
}
