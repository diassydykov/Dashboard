"use server";

import { revalidatePath } from "next/cache";
import { assertCanWrite, requireAppContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { academicYearSchema } from "@/lib/validations";

export async function createYearAction(formData: FormData) {
  const ctx = await requireAppContext();
  assertCanWrite(ctx);
  const parsed = academicYearSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    weekCount: Number(formData.get("weekCount") ?? 34),
    includeSaturday: formData.get("includeSaturday") === "on",
    lessonsPerDay: Number(formData.get("lessonsPerDay") ?? 7),
  });
  if (!parsed.success) {
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.academicYear.updateMany({
      where: { schoolId: ctx.school.id },
      data: { isActive: false },
    });
    await tx.academicYear.create({
      data: {
        schoolId: ctx.school.id,
        name: parsed.data.name,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        weekCount: parsed.data.weekCount,
        includeSaturday: parsed.data.includeSaturday,
        lessonsPerDay: parsed.data.lessonsPerDay,
        isActive: true,
      },
    });
  });
  revalidatePath("/dashboard");
}

export async function activateYearAction(yearId: string) {
  const ctx = await requireAppContext();
  assertCanWrite(ctx);
  const year = await prisma.academicYear.findFirst({
    where: { id: yearId, schoolId: ctx.school.id },
  });
  if (!year) return;
  await prisma.$transaction([
    prisma.academicYear.updateMany({ where: { schoolId: ctx.school.id }, data: { isActive: false } }),
    prisma.academicYear.update({ where: { id: year.id }, data: { isActive: true } }),
  ]);
  revalidatePath("/dashboard");
}
