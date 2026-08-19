import Link from "next/link";
import { requireAppContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureScheduleVersions } from "@/lib/schedule/data";
import { collectAllConflicts } from "@/lib/schedule/service";
import { Badge, Button, Card, EmptyState, Field, Input } from "@/components/ui";
import { activateYearAction, createYearAction } from "@/app/(app)/dashboard/actions";

export default async function DashboardPage() {
  const ctx = await requireAppContext();
  const years = await prisma.academicYear.findMany({
    where: { schoolId: ctx.school.id },
    orderBy: { startDate: "desc" },
  });

  if (!ctx.year) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-sm text-ink-soft">Шаг 1 из 5</p>
          <h1 className="font-serif text-4xl">Создайте учебный год</h1>
        </header>
        <EmptyState
          title="Пока нет учебного года"
          text="Начните с 2026–2027. Затем настройте звонки, импортируйте классы и нагрузку."
        />
        <Card className="max-w-lg space-y-4">
          <form action={createYearAction} className="space-y-4">
            <Field label="Название">
              <Input name="name" defaultValue="2026–2027" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Начало">
                <Input name="startDate" type="date" defaultValue="2026-09-01" required />
              </Field>
              <Field label="Окончание">
                <Input name="endDate" type="date" defaultValue="2027-05-25" required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Учебных недель">
                <Input name="weekCount" type="number" defaultValue={34} min={1} max={52} />
              </Field>
              <Field label="Уроков в день (макс.)">
                <Input name="lessonsPerDay" type="number" defaultValue={7} min={1} max={12} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="includeSaturday" />
              Включать субботу
            </label>
            <Button type="submit">Создать год</Button>
          </form>
        </Card>
      </div>
    );
  }

  const yearId = ctx.year.id;
  const { draft } = await ensureScheduleVersions(ctx.school.id, yearId);
  const [classes, teachers, requirements, bells, lessons, conflicts] = await Promise.all([
    prisma.classGroup.count({ where: { yearId } }),
    prisma.teacher.count({ where: { schoolId: ctx.school.id, isActive: true } }),
    prisma.curriculumRequirement.count({ where: { yearId } }),
    prisma.bellScheduleProfile.count({ where: { yearId } }),
    prisma.lesson.count({ where: { versionId: draft.id } }),
    collectAllConflicts(draft.id),
  ]);

  const steps = [
    { n: 1, title: "Школа и год", done: true, href: "/dashboard" },
    { n: 2, title: "Звонки", done: bells > 0, href: "/bells" },
    { n: 3, title: "Импорт", done: classes > 0 && teachers > 0, href: "/import" },
    { n: 4, title: "Нагрузка", done: requirements > 0, href: "/curriculum" },
    { n: 5, title: "Генерация", done: lessons > 0, href: "/schedule" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">{ctx.school.name}</p>
          <h1 className="font-serif text-4xl">{ctx.year.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/bells">
            <Button variant="secondary">Настроить звонки</Button>
          </Link>
          <Link href="/schedule">
            <Button>Открыть сетку</Button>
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-ink-soft">Классы</p>
          <p className="mt-1 font-serif text-3xl">{classes}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Учителя</p>
          <p className="mt-1 font-serif text-3xl">{teachers}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Строки нагрузки</p>
          <p className="mt-1 font-serif text-3xl">{requirements}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Конфликты в черновике</p>
          <p className="mt-1 font-serif text-3xl">{conflicts.length}</p>
          {conflicts.length > 0 ? <Badge tone="bad">нужно исправить</Badge> : <Badge tone="good">чисто</Badge>}
        </Card>
      </div>

      <Card>
        <h2 className="font-serif text-2xl">Как заполнить год</h2>
        <ol className="mt-5 grid gap-3 md:grid-cols-5">
          {steps.map((step) => (
            <li key={step.n}>
              <Link
                href={step.href}
                className="block rounded-xl border border-line bg-paper/60 p-4 hover:border-copper/40"
              >
                <p className="text-xs text-ink-soft">Шаг {step.n}</p>
                <p className="mt-1 font-medium">{step.title}</p>
                <p className="mt-2">
                  <Badge tone={step.done ? "good" : "neutral"}>{step.done ? "готово" : "открыть"}</Badge>
                </p>
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      {years.length > 1 ? (
        <Card>
          <h2 className="mb-3 font-medium">Учебные годы</h2>
          <ul className="space-y-2">
            {years.map((year) => (
              <li key={year.id} className="flex items-center justify-between gap-3">
                <span>
                  {year.name} {year.isActive ? <Badge tone="copper">активный</Badge> : null}
                </span>
                {!year.isActive ? (
                  <form
                    action={async () => {
                      "use server";
                      await activateYearAction(year.id);
                    }}
                  >
                    <Button variant="secondary" type="submit">
                      Сделать активным
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
