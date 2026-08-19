import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppContext = {
  userId: string;
  email: string;
  profile: {
    id: string;
    fullName: string;
    role: Role;
    schoolId: string | null;
    currentSchoolId: string | null;
  };
  school: {
    id: string;
    name: string;
    code: string;
    timezone: string;
  };
  year: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    weekCount: number;
    includeSaturday: boolean;
    lessonsPerDay: number;
    isActive: boolean;
  } | null;
};

export async function getSessionUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireProfile() {
  const user = await requireUser();
  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) {
    redirect("/login?error=no-profile");
  }
  return { user, profile, email: user.email ?? "" };
}

function resolveSchoolId(profile: {
  role: Role;
  schoolId: string | null;
  currentSchoolId: string | null;
}): string | null {
  if (profile.role === "super_admin") {
    return profile.currentSchoolId ?? profile.schoolId;
  }
  return profile.schoolId;
}

export async function requireAppContext(): Promise<AppContext> {
  const user = await requireUser();
  const email = user.email ?? "";

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    redirect("/login?error=no-profile");
  }

  const schoolId = resolveSchoolId(profile);
  if (!schoolId) {
    if (profile.role === "super_admin") {
      redirect("/schools");
    }
    redirect("/login?error=no-school");
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
  });

  if (!school) {
    redirect("/login?error=no-school");
  }

  if (profile.role !== "super_admin" && profile.schoolId !== school.id) {
    redirect("/login?error=forbidden");
  }

  const year =
    (await prisma.academicYear.findFirst({
      where: { schoolId: school.id, isActive: true },
      orderBy: { startDate: "desc" },
    })) ??
    (await prisma.academicYear.findFirst({
      where: { schoolId: school.id },
      orderBy: { startDate: "desc" },
    }));

  return {
    userId: user.id,
    email,
    profile: {
      id: profile.id,
      fullName: profile.fullName,
      role: profile.role,
      schoolId: profile.schoolId,
      currentSchoolId: profile.currentSchoolId,
    },
    school,
    year,
  };
}

export function assertCanWrite(ctx: AppContext) {
  if (ctx.profile.role === "viewer") {
    throw new Error("Недостаточно прав: режим просмотра");
  }
}

export function assertSchool(ctx: AppContext, schoolId: string) {
  if (ctx.school.id !== schoolId) {
    throw new Error("Нет доступа к данным другой школы");
  }
}
