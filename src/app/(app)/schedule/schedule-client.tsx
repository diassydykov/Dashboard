"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import { shiftLabel, WEEKDAYS, weekdayLabel } from "@/lib/time";
import { findConflicts, type OccupiedLesson } from "@/lib/conflicts";
import {
  deleteLessonAction,
  generateAction,
  publishAction,
  saveLessonAction,
} from "@/app/(app)/schedule/actions";

export type GridLesson = OccupiedLesson & {
  subjectId: string;
  subjectName: string;
};

type Option = { id: string; label: string; extra?: string };

export function ScheduleClient({
  canWrite,
  includeSaturday,
  lessonsPerDay,
  kind,
  classes,
  teachers,
  subjects,
  rooms,
  lessons,
  hourStats,
}: {
  canWrite: boolean;
  includeSaturday: boolean;
  lessonsPerDay: number;
  kind: "draft" | "published";
  classes: Option[];
  teachers: Option[];
  subjects: Option[];
  rooms: Option[];
  lessons: GridLesson[];
  hourStats: Array<{ key: string; label: string; required: number; planned: number }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filterClass, setFilterClass] = useState(classes[0]?.id ?? "");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterRoom, setFilterRoom] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [editor, setEditor] = useState<null | {
    lessonId?: string;
    classGroupId: string;
    subjectId: string;
    teacherId: string;
    roomId: string;
    weekday: number;
    lessonIndex: number;
  }>(null);
  const [error, setError] = useState<string[] | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const days = includeSaturday ? WEEKDAYS : WEEKDAYS.filter((day) => day.value <= 5);
  const indexes = Array.from({ length: lessonsPerDay }, (_, i) => i + 1);

  const visible = useMemo(() => {
    return lessons.filter((lesson) => {
      if (filterClass && lesson.classGroupId !== filterClass) return false;
      if (filterTeacher && lesson.teacherId !== filterTeacher) return false;
      if (filterRoom && lesson.roomId !== filterRoom) return false;
      if (filterShift && lesson.shift !== filterShift) return false;
      return true;
    });
  }, [lessons, filterClass, filterTeacher, filterRoom, filterShift]);

  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    for (const lesson of lessons) {
      const others = lessons.filter((item) => item.id !== lesson.id);
      if (findConflicts(lesson, others).length > 0 && lesson.id) ids.add(lesson.id);
    }
    return ids;
  }, [lessons]);

  function openCell(weekday: number, lessonIndex: number, existing?: GridLesson) {
    setError(null);
    setEditor({
      lessonId: existing?.id,
      classGroupId: existing?.classGroupId ?? filterClass,
      subjectId: existing?.subjectId ?? subjects[0]?.id ?? "",
      teacherId: existing?.teacherId ?? teachers[0]?.id ?? "",
      roomId: existing?.roomId ?? "",
      weekday,
      lessonIndex,
    });
  }

  function save() {
    if (!editor) return;
    startTransition(async () => {
      const result = await saveLessonAction(
        {
          classGroupId: editor.classGroupId,
          subjectId: editor.subjectId,
          teacherId: editor.teacherId,
          roomId: editor.roomId || null,
          weekday: editor.weekday,
          lessonIndex: editor.lessonIndex,
        },
        editor.lessonId,
      );
      if (!result.ok) {
        setError([result.error, ...(result.details ?? [])]);
        return;
      }
      setEditor(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">Все классы</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
        <Select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}>
          <option value="">Все учителя</option>
          {teachers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
        <Select value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
          <option value="">Все кабинеты</option>
          {rooms.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
        <Select value={filterShift} onChange={(e) => setFilterShift(e.target.value)}>
          <option value="">Обе смены</option>
          <option value="FIRST">1 смена</option>
          <option value="SECOND">2 смена</option>
        </Select>
        <a
          className="text-sm text-copper underline"
          href={`/api/schedule/export?kind=${kind}&classGroupId=${filterClass}&teacherId=${filterTeacher}`}
        >
          Excel
        </a>
        <a className="text-sm text-copper underline" href={`/schedule/print?classGroupId=${filterClass}`}>
          Печать
        </a>
      </div>

      {canWrite && kind === "draft" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              startTransition(async () => {
                if (!confirm("Сгенерировать черновик? Текущая сетка черновика будет заменена.")) return;
                const result = await generateAction();
                if (!result.ok) {
                  setReport(result.error);
                  return;
                }
                const extras = [
                  ...result.unplaced.map(
                    (item) => `${item.subjectName}: ${item.reason}. ${item.suggestion}`,
                  ),
                  ...result.skippedWithoutTeacher.map(
                    (item) => `${item.classLabel} · ${item.subjectName}: ${item.reason}. ${item.suggestion}`,
                  ),
                ];
                setReport(
                  [
                    `Размещено ${result.placed} уроков. Не размещено: ${extras.length}. Итераций: ${result.iterations}${result.timedOut ? ", сработал лимит времени" : ""}.`,
                    ...extras,
                  ].join("\n"),
                );
                router.refresh();
              })
            }
            disabled={pending}
          >
            Сгенерировать расписание
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              startTransition(async () => {
                if (!confirm("Опубликовать черновик? Конфликтное расписание опубликовать нельзя.")) return;
                const result = await publishAction();
                if (!result.ok) {
                  setError([result.error, ...(result.details ?? [])]);
                  return;
                }
                setReport("Черновик опубликован.");
                router.refresh();
              })
            }
            disabled={pending}
          >
            Опубликовать
          </Button>
        </div>
      ) : null}

      {report ? (
        <pre className="whitespace-pre-wrap rounded-lg bg-paper px-3 py-2 text-sm">{report}</pre>
      ) : null}
      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {error.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-paper">
              <th className="px-3 py-2 text-left">Урок</th>
              {days.map((day) => (
                <th key={day.value} className="px-3 py-2 text-left">
                  {day.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indexes.map((index) => (
              <tr key={index} className="border-t border-line align-top">
                <td className="px-3 py-2 text-ink-soft">{index}</td>
                {days.map((day) => {
                  const cellLessons = visible.filter(
                    (lesson) => lesson.weekday === day.value && lesson.lessonIndex === index,
                  );
                  return (
                    <td key={day.value} className="px-1 py-1">
                      <div className="min-h-[72px] space-y-1">
                        {cellLessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => openCell(day.value, index, lesson)}
                            className={`block w-full rounded-lg px-2 py-1.5 text-left ${lesson.id && conflictIds.has(lesson.id) ? "bg-red-100" : "bg-paper"}`}
                          >
                            <div className="font-medium">{lesson.subjectName}</div>
                            <div className="text-xs text-ink-soft">
                              {lesson.classLabel} · {lesson.teacherName}
                              {lesson.roomName ? ` · ${lesson.roomName}` : ""}
                            </div>
                            <div className="text-[11px] text-ink-soft/80">
                              {lesson.startTime}–{lesson.endTime} · {shiftLabel(lesson.shift)}
                            </div>
                          </button>
                        ))}
                        {canWrite && kind === "draft" ? (
                          <button
                            type="button"
                            className="w-full rounded-lg border border-dashed border-line py-1 text-xs text-ink-soft hover:border-copper"
                            onClick={() => openCell(day.value, index)}
                          >
                            + урок
                          </button>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Нагрузка: требуется / запланировано / осталось</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {hourStats.map((item) => {
            const left = item.required - item.planned;
            return (
              <div key={item.key} className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm">
                <span>{item.label}</span>
                <span>
                  {item.required} / {item.planned} /{" "}
                  <Badge tone={left === 0 ? "good" : left > 0 ? "warn" : "bad"}>{left}</Badge>
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {editor ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
          <Card className="w-full max-w-lg space-y-4">
            <h2 className="font-serif text-2xl">
              {editor.lessonId ? "Урок" : "Новый урок"} · {weekdayLabel(editor.weekday, true)} · №{editor.lessonIndex}
            </h2>
            <Field label="Класс">
              <Select
                value={editor.classGroupId}
                onChange={(e) => setEditor({ ...editor, classGroupId: e.target.value })}
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Предмет">
              <Select
                value={editor.subjectId}
                onChange={(e) => setEditor({ ...editor, subjectId: e.target.value })}
              >
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Учитель">
              <Select
                value={editor.teacherId}
                onChange={(e) => setEditor({ ...editor, teacherId: e.target.value })}
              >
                {teachers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Кабинет">
              <Select value={editor.roomId} onChange={(e) => setEditor({ ...editor, roomId: e.target.value })}>
                <option value="">Без кабинета</option>
                {rooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            {error ? (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
                {error.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={save} disabled={pending || !canWrite}>
                Сохранить
              </Button>
              {editor.lessonId && canWrite ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteLessonAction(editor.lessonId!);
                      setEditor(null);
                      router.refresh();
                    })
                  }
                >
                  Удалить
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => setEditor(null)}>
                Закрыть
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
