import Link from "next/link";
import { requireAppContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui";
import { ensureScheduleVersions, loadVersionLessons } from "@/lib/schedule/data";
import { ScheduleClient } from "@/app/(app)/schedule/schedule-client";
import { classLabel } from "@/lib/time";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const ctx = await requireAppContext();
  if (!ctx.year) {
    return (
      <EmptyState
        title="Нет учебного года"
        text="Создайте год, звонки и нагрузку — затем сетку."
        action={
          <Link href="/dashboard" className="text-copper underline">
            На дашборд
          </Link>
        }
      />
    );
  }

  const params = await searchParams;
  const kind = params.kind === "published" ? "published" : "draft";
  const versions = await ensureScheduleVersions(ctx.school.id, ctx.year.id);
  const version = kind === "published" ? versions.published : versions.draft;
  const raw = await loadVersionLessons(version.id);
  const gridLessons = raw.map((lesson) => ({
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
    subjectId: lesson.subjectId,
    subjectName: lesson.subject.name,
  }));

  const [classes, teachers, subjects, rooms, requirements] = await Promise.all([
    prisma.classGroup.findMany({
      where: { yearId: ctx.year.id },
      include: { grade: true },
      orderBy: [{ grade: { number: "asc" } }, { letter: "asc" }],
    }),
    prisma.teacher.findMany({
      where: { schoolId: ctx.school.id, isActive: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.subject.findMany({ where: { schoolId: ctx.school.id }, orderBy: { name: "asc" } }),
    prisma.room.findMany({ where: { schoolId: ctx.school.id }, orderBy: { name: "asc" } }),
    prisma.curriculumRequirement.findMany({
      where: { yearId: ctx.year.id },
      include: { classGroup: { include: { grade: true } }, subject: true },
    }),
  ]);

  const planned = new Map<string, number>();
  for (const lesson of raw) {
    const key = `${lesson.classGroupId}:${lesson.subjectId}`;
    planned.set(key, (planned.get(key) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">Шаг 5 из 5 · {kind === "draft" ? "черновик" : "опубликовано"}</p>
          <h1 className="font-serif text-4xl">Расписание</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/schedule?kind=draft" className={kind === "draft" ? "font-medium" : "text-ink-soft"}>
            Черновик
          </Link>
          <span className="text-line">/</span>
          <Link
            href="/schedule?kind=published"
            className={kind === "published" ? "font-medium" : "text-ink-soft"}
          >
            Опубликовано
          </Link>
        </div>
      </header>
      <ScheduleClient
        canWrite={ctx.profile.role !== "viewer"}
        includeSaturday={ctx.year.includeSaturday}
        lessonsPerDay={ctx.year.lessonsPerDay}
        kind={kind}
        classes={classes.map((item) => ({
          id: item.id,
          label: classLabel(item.grade.number, item.letter),
        }))}
        teachers={teachers.map((item) => ({ id: item.id, label: item.fullName }))}
        subjects={subjects.map((item) => ({ id: item.id, label: item.name }))}
        rooms={rooms.map((item) => ({ id: item.id, label: item.name }))}
        lessons={gridLessons}
        hourStats={requirements.map((item) => ({
          key: item.id,
          label: `${classLabel(item.classGroup.grade.number, item.classGroup.letter)} · ${item.subject.name}`,
          required: Number(item.hoursPerWeek),
          planned: planned.get(`${item.classGroupId}:${item.subjectId}`) ?? 0,
        }))}
      />
    </div>
  );
}
