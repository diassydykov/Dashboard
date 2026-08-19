import { requireAppContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui";
import { CurriculumClient } from "@/app/(app)/curriculum/curriculum-client";
import { ensureScheduleVersions } from "@/lib/schedule/data";
import Link from "next/link";

export default async function CurriculumPage() {
  const ctx = await requireAppContext();
  if (!ctx.year) {
    return (
      <EmptyState
        title="Нужен учебный год"
        text="Создайте год, затем заполните нагрузку."
        action={
          <Link href="/dashboard" className="text-copper underline">
            На дашборд
          </Link>
        }
      />
    );
  }

  const { draft } = await ensureScheduleVersions(ctx.school.id, ctx.year.id);
  const [classes, subjects, teachers, rooms, requirements, lessons, norms] = await Promise.all([
    prisma.classGroup.findMany({
      where: { yearId: ctx.year.id },
      include: { grade: true },
      orderBy: [{ grade: { number: "asc" } }, { letter: "asc" }],
    }),
    prisma.subject.findMany({ where: { schoolId: ctx.school.id }, orderBy: { name: "asc" } }),
    prisma.teacher.findMany({
      where: { schoolId: ctx.school.id, isActive: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.room.findMany({ where: { schoolId: ctx.school.id }, orderBy: { name: "asc" } }),
    prisma.curriculumRequirement.findMany({
      where: { yearId: ctx.year.id },
      include: {
        classGroup: { include: { grade: true } },
        subject: true,
        preferredTeacher: true,
        preferredRoom: true,
      },
      orderBy: [{ classGroup: { grade: { number: "asc" } } }],
    }),
    prisma.lesson.findMany({ where: { versionId: draft.id }, select: { classGroupId: true, subjectId: true } }),
    prisma.curriculumNormVersion.findMany({
      where: { yearId: ctx.year.id },
      include: { items: { orderBy: [{ gradeNumber: "asc" }, { subjectName: "asc" }] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const planned = new Map<string, number>();
  for (const lesson of lessons) {
    const key = `${lesson.classGroupId}:${lesson.subjectId}`;
    planned.set(key, (planned.get(key) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-soft">Шаг 4 из 5</p>
        <h1 className="font-serif text-4xl">Учебный план</h1>
      </header>
      <CurriculumClient
        canWrite={ctx.profile.role !== "viewer"}
        weekCount={ctx.year.weekCount}
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        rooms={rooms}
        requirements={requirements.map((item) => ({
          id: item.id,
          hoursPerWeek: Number(item.hoursPerWeek),
          allowedDays: item.allowedDays,
          classGroup: item.classGroup,
          subject: item.subject,
          preferredTeacher: item.preferredTeacher,
          preferredRoom: item.preferredRoom,
          planned: planned.get(`${item.classGroupId}:${item.subjectId}`) ?? 0,
        }))}
        norms={norms.map((version) => ({
          ...version,
          items: version.items.map((item) => ({ ...item, hoursPerWeek: Number(item.hoursPerWeek) })),
        }))}
      />
    </div>
  );
}
