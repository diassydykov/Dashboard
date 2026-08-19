"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function selectSchoolAction(schoolId: string) {
  const { profile } = await requireProfile();
  if (profile.role !== "super_admin") {
    return { ok: false as const, error: "Недостаточно прав" };
  }
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) return { ok: false as const, error: "Школа не найдена" };
  await prisma.userProfile.update({
    where: { id: profile.id },
    data: { currentSchoolId: school.id },
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
