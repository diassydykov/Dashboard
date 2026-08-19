"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import {
  activateNormVersionAction,
  createSubjectAction,
  deleteRequirementAction,
  upsertRequirementAction,
} from "@/app/(app)/curriculum/actions";
import { classLabel, weekdayLabel } from "@/lib/time";

type RequirementRow = {
  id: string;
  hoursPerWeek: number;
  allowedDays: number[];
  classGroup: { id: string; letter: string; grade: { number: number } };
  subject: { id: string; name: string };
  preferredTeacher: { id: string; fullName: string } | null;
  preferredRoom: { id: string; name: string } | null;
  planned: number;
};

export function CurriculumClient({
  canWrite,
  weekCount,
  classes,
  subjects,
  teachers,
  rooms,
  requirements,
  norms,
}: {
  canWrite: boolean;
  weekCount: number;
  classes: Array<{ id: string; letter: string; language: string; grade: { number: number } }>;
  subjects: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; fullName: string }>;
  rooms: Array<{ id: string; name: string }>;
  requirements: RequirementRow[];
  norms: Array<{
    id: string;
    name: string;
    source: string;
    isActive: boolean;
    notes: string | null;
    items: Array<{
      id: string;
      gradeNumber: number;
      language: string | null;
      planType: string | null;
      subjectName: string;
      hoursPerWeek: number;
    }>;
  }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const activeNorm = norms.find((item) => item.isActive);

  return (
    <div className="space-y-8">
      <Card className="space-y-3">
        <h2 className="font-serif text-2xl">Справочник норм часов</h2>
        <p className="text-sm text-ink-soft">
          Нормативы не зашиты в код: методичка не даёт полной удобной таблицы на все комбинации. Завуч загружает
          свою версию через Excel на странице импорта. Демо-данные помечены отдельно.
        </p>
        <div className="flex flex-wrap gap-2">
          {norms.map((version) => (
            <button
              key={version.id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${version.isActive ? "bg-ink text-paper" : "border border-line bg-white"}`}
              onClick={() =>
                startTransition(async () => {
                  await activateNormVersionAction(version.id);
                  router.refresh();
                })
              }
            >
              {version.name}
              {version.source === "demo" ? " · демо" : ""}
            </button>
          ))}
        </div>
        {activeNorm ? (
          <div className="overflow-x-auto">
            {activeNorm.source === "demo" ? (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-warn">
                Это демонстрационный справочник, не официальные нормы МОН РК.
              </p>
            ) : null}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="py-2">Параллель</th>
                  <th>Предмет</th>
                  <th>Часов/нед</th>
                  <th>Язык</th>
                  <th>Тип плана</th>
                </tr>
              </thead>
              <tbody>
                {activeNorm.items.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="py-2">{item.gradeNumber}</td>
                    <td>{item.subjectName}</td>
                    <td>{item.hoursPerWeek}</td>
                    <td>{item.language ?? "—"}</td>
                    <td>{item.planType ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Справочник пуст. Импортируйте «Нормы часов.xlsx».</p>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-serif text-2xl">Нагрузка классов</h2>
          <p className="text-sm text-ink-soft">
            Требуется / запланировано / осталось — по черновику расписания. За год: часы × {weekCount} недель
            (настраивается в учебном годе).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-soft">
                <th className="py-2">Класс</th>
                <th>Предмет</th>
                <th>Учитель</th>
                <th>Кабинет</th>
                <th>Требуется</th>
                <th>В сетке</th>
                <th>Осталось</th>
                <th>Дни</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((row) => {
                const left = row.hoursPerWeek - row.planned;
                return (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-2">
                      {classLabel(row.classGroup.grade.number, row.classGroup.letter)}
                    </td>
                    <td>{row.subject.name}</td>
                    <td>{row.preferredTeacher?.fullName ?? "не назначен"}</td>
                    <td>{row.preferredRoom?.name ?? "—"}</td>
                    <td>{row.hoursPerWeek}</td>
                    <td>{row.planned}</td>
                    <td>
                      <Badge tone={left === 0 ? "good" : left > 0 ? "warn" : "bad"}>
                        {left}
                      </Badge>
                    </td>
                    <td>
                      {row.allowedDays.length
                        ? row.allowedDays.map((day) => weekdayLabel(day, true)).join(" ")
                        : "все"}
                    </td>
                    <td>
                      {canWrite ? (
                        <button
                          type="button"
                          className="text-danger"
                          onClick={() =>
                            startTransition(async () => {
                              await deleteRequirementAction(row.id);
                              router.refresh();
                            })
                          }
                        >
                          Удалить
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canWrite ? (
          <form
            className="grid gap-3 md:grid-cols-6"
            action={(formData) => {
              startTransition(async () => {
                await upsertRequirementAction(formData);
                router.refresh();
              });
            }}
          >
            <Select name="classGroupId" required defaultValue="">
              <option value="" disabled>
                Класс
              </option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {classLabel(item.grade.number, item.letter)} ({item.language})
                </option>
              ))}
            </Select>
            <Select name="subjectId" required defaultValue="">
              <option value="" disabled>
                Предмет
              </option>
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Select name="teacherId" defaultValue="">
              <option value="">Учитель</option>
              {teachers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                </option>
              ))}
            </Select>
            <Select name="roomId" defaultValue="">
              <option value="">Кабинет</option>
              {rooms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Input name="hoursPerWeek" type="number" min={1} max={20} step="0.5" placeholder="Часов/нед" required />
            <div className="flex gap-2">
              <Input name="allowedDays" placeholder="Дни: 1,2,3,4,5" />
              <Button type="submit" disabled={pending}>
                Сохранить
              </Button>
            </div>
          </form>
        ) : null}

        {canWrite ? (
          <form action={createSubjectAction} className="flex max-w-md gap-2">
            <Input name="name" placeholder="Новый предмет" required />
            <Button variant="secondary" type="submit">
              Добавить предмет
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
