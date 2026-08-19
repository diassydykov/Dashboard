import { requireAppContext } from "@/lib/auth";
import { ImportClient } from "@/app/(app)/import/import-client";
import { prisma } from "@/lib/prisma";

export default async function ImportPage() {
  const ctx = await requireAppContext();
  const batches = ctx.year
    ? await prisma.importBatch.findMany({
        where: { schoolId: ctx.school.id, yearId: ctx.year.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
    : [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-soft">Шаг 3 из 5</p>
        <h1 className="font-serif text-4xl">Импорт данных</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Скачайте шаблон, заполните и загрузите. Если есть ошибки — ничего не попадёт в базу. Нормы часов
          живут отдельным версионируемым справочником, а не в коде.
        </p>
      </header>
      <ImportClient canWrite={ctx.profile.role !== "viewer"} />
      {batches.length > 0 ? (
        <section>
          <h2 className="mb-3 font-medium">Последние загрузки</h2>
          <ul className="space-y-2 text-sm">
            {batches.map((batch) => (
              <li key={batch.id} className="rounded-lg bg-white px-3 py-2">
                {batch.fileName} · {batch.type} · {batch.status} · строк {batch.rowCount}, ошибок {batch.errorCount}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
