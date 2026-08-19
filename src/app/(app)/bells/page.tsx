import { requireAppContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui";
import { BellsEditor } from "@/app/(app)/bells/bells-editor";
import Link from "next/link";

export default async function BellsPage() {
  const ctx = await requireAppContext();
  if (!ctx.year) {
    return (
      <EmptyState
        title="Сначала учебный год"
        text="Создайте 2026–2027 на дашборде, затем задайте две смены и звонки."
        action={
          <Link href="/dashboard" className="text-copper underline">
            К дашборду
          </Link>
        }
      />
    );
  }

  const [profiles, durations] = await Promise.all([
    prisma.bellScheduleProfile.findMany({
      where: { yearId: ctx.year.id, schoolId: ctx.school.id },
      include: { slots: { orderBy: [{ weekday: "asc" }, { lessonIndex: "asc" }] } },
      orderBy: [{ shift: "asc" }, { gradeFrom: "asc" }],
    }),
    prisma.lessonDurationProfile.findMany({
      where: { yearId: ctx.year.id, schoolId: ctx.school.id },
      orderBy: { gradeFrom: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-soft">Шаг 2 из 5 · {ctx.year.name}</p>
        <h1 className="font-serif text-4xl">Настройки звонков</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Две смены, ручное начало и конец каждого урока. Перемена — это разрыв между уроками. Для 1–4 и 5–11
          заведите отдельные профили, если длительность разная.
        </p>
      </header>
      <BellsEditor
        year={{ includeSaturday: ctx.year.includeSaturday, lessonsPerDay: ctx.year.lessonsPerDay }}
        profiles={profiles}
        durations={durations}
        canWrite={ctx.profile.role !== "viewer"}
      />
    </div>
  );
}
