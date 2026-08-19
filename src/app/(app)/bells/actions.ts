"use server";

import { revalidatePath } from "next/cache";
import { Shift } from "@prisma/client";
import { assertCanWrite, requireAppContext } from "@/lib/auth";
import { findBellOverlaps } from "@/lib/bells";
import { prisma } from "@/lib/prisma";
import { WEEKDAYS } from "@/lib/time";
import { bellProfileSchema, durationProfileSchema } from "@/lib/validations";

function needYear() {
  return { ok: false as const, error: "Сначала создайте учебный год" };
}

export async function saveYearFlagsAction(formData: FormData) {
  const ctx = await requireAppContext();
  assertCanWrite(ctx);
  if (!ctx.year) return;
  await prisma.academicYear.update({
    where: { id: ctx.year.id },
    data: {
      includeSaturday: formData.get("includeSaturday") === "on",
      lessonsPerDay: Number(formData.get("lessonsPerDay") ?? ctx.year.lessonsPerDay),
    },
  });
  revalidatePath("/bells");
}

export async function saveBellProfileAction(input: {
  id?: string;
  name: string;
  shift: "FIRST" | "SECOND";
  gradeFrom: number;
  gradeTo: number;
  slots: Array<{ lessonIndex: number; startTime: string; endTime: string }>;
}) {
  const ctx = await requireAppContext();
  assertCanWrite(ctx);
  if (!ctx.year) return needYear();
  const parsed = bellProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Проверьте название, параллели и времена уроков" };
  }
  if (parsed.data.gradeFrom > parsed.data.gradeTo) {
    return { ok: false as const, error: "Диапазон параллелей задан неверно" };
  }
  const overlaps = findBellOverlaps(parsed.data.slots);
  if (overlaps.length > 0) {
    return { ok: false as const, error: overlaps.map((item) => item.message).join(". ") };
  }

  const others = await prisma.bellScheduleProfile.findMany({
    where: {
      yearId: ctx.year.id,
      shift: parsed.data.shift,
      ...(parsed.data.id ? { id: { not: parsed.data.id } } : {}),
    },
  });
  const rangeClash = others.find(
    (item) => !(parsed.data.gradeTo < item.gradeFrom || parsed.data.gradeFrom > item.gradeTo),
  );
  if (rangeClash) {
    return {
      ok: false as const,
      error: `Диапазон параллелей пересекается с профилем «${rangeClash.name}»`,
    };
  }

  const weekdays = ctx.year.includeSaturday ? WEEKDAYS.map((d) => d.value) : WEEKDAYS.filter((d) => d.value < 6).map((d) => d.value);

  if (parsed.data.id) {
    const existing = await prisma.bellScheduleProfile.findFirst({
      where: { id: parsed.data.id, schoolId: ctx.school.id, yearId: ctx.year.id },
    });
    if (!existing) return { ok: false as const, error: "Профиль не найден" };
    await prisma.$transaction([
      prisma.bellSlot.deleteMany({ where: { profileId: existing.id } }),
      prisma.bellScheduleProfile.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name,
          shift: parsed.data.shift,
          gradeFrom: parsed.data.gradeFrom,
          gradeTo: parsed.data.gradeTo,
          slots: {
            create: weekdays.flatMap((weekday) =>
              parsed.data.slots.map((slot) => ({
                weekday,
                lessonIndex: slot.lessonIndex,
                startTime: slot.startTime,
                endTime: slot.endTime,
              })),
            ),
          },
        },
      }),
    ]);
  } else {
    await prisma.bellScheduleProfile.create({
      data: {
        schoolId: ctx.school.id,
        yearId: ctx.year.id,
        name: parsed.data.name,
        shift: parsed.data.shift as Shift,
        gradeFrom: parsed.data.gradeFrom,
        gradeTo: parsed.data.gradeTo,
        slots: {
          create: weekdays.flatMap((weekday) =>
            parsed.data.slots.map((slot) => ({
              weekday,
              lessonIndex: slot.lessonIndex,
              startTime: slot.startTime,
              endTime: slot.endTime,
            })),
          ),
        },
      },
    });
  }
  revalidatePath("/bells");
  return { ok: true as const };
}

export async function deleteBellProfileAction(id: string) {
  const ctx = await requireAppContext();
  assertCanWrite(ctx);
  if (!ctx.year) return needYear();
  await prisma.bellScheduleProfile.deleteMany({
    where: { id, schoolId: ctx.school.id, yearId: ctx.year.id },
  });
  revalidatePath("/bells");
  return { ok: true as const };
}

export async function saveDurationProfileAction(input: {
  id?: string;
  name: string;
  durationMin: number;
  gradeFrom: number;
  gradeTo: number;
  shift: "FIRST" | "SECOND" | null;
}) {
  const ctx = await requireAppContext();
  assertCanWrite(ctx);
  if (!ctx.year) return needYear();
  const parsed = durationProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Проверьте профиль длительности" };
  if (parsed.data.id) {
    await prisma.lessonDurationProfile.updateMany({
      where: { id: parsed.data.id, schoolId: ctx.school.id, yearId: ctx.year.id },
      data: {
        name: parsed.data.name,
        durationMin: parsed.data.durationMin,
        gradeFrom: parsed.data.gradeFrom,
        gradeTo: parsed.data.gradeTo,
        shift: parsed.data.shift,
      },
    });
  } else {
    await prisma.lessonDurationProfile.create({
      data: {
        schoolId: ctx.school.id,
        yearId: ctx.year.id,
        name: parsed.data.name,
        durationMin: parsed.data.durationMin,
        gradeFrom: parsed.data.gradeFrom,
        gradeTo: parsed.data.gradeTo,
        shift: parsed.data.shift,
      },
    });
  }
  revalidatePath("/bells");
  return { ok: true as const };
}
