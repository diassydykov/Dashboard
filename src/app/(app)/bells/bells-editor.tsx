"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { findBellOverlaps, breaksBetween } from "@/lib/bells";
import { durationMinutes, fromMinutes, toMinutes } from "@/lib/time";
import {
  deleteBellProfileAction,
  saveBellProfileAction,
  saveDurationProfileAction,
  saveYearFlagsAction,
} from "@/app/(app)/bells/actions";

type Slot = { lessonIndex: number; startTime: string; endTime: string };

type Profile = {
  id: string;
  name: string;
  shift: "FIRST" | "SECOND";
  gradeFrom: number;
  gradeTo: number;
  slots: Array<{ weekday: number; lessonIndex: number; startTime: string; endTime: string }>;
};

type Duration = {
  id: string;
  name: string;
  durationMin: number;
  gradeFrom: number;
  gradeTo: number;
  shift: "FIRST" | "SECOND" | null;
};

function uniqueDaySlots(slots: Profile["slots"]): Slot[] {
  const monday = slots.filter((slot) => slot.weekday === 1);
  const source = monday.length > 0 ? monday : slots;
  const map = new Map<number, Slot>();
  for (const slot of source) {
    map.set(slot.lessonIndex, {
      lessonIndex: slot.lessonIndex,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
  }
  return [...map.values()].sort((a, b) => a.lessonIndex - b.lessonIndex);
}

function Timeline({ slots }: { slots: Slot[] }) {
  if (slots.length === 0) {
    return <p className="text-sm text-ink-soft">Добавьте уроки, чтобы увидеть ленту дня.</p>;
  }
  const start = Math.min(...slots.map((slot) => toMinutes(slot.startTime)));
  const end = Math.max(...slots.map((slot) => toMinutes(slot.endTime)));
  const span = Math.max(end - start, 1);
  const breaks = breaksBetween(slots);

  return (
    <div className="space-y-3">
      <div className="relative h-16 overflow-hidden rounded-xl bg-paper">
        {slots.map((slot) => {
          const left = ((toMinutes(slot.startTime) - start) / span) * 100;
          const width = (durationMinutes(slot.startTime, slot.endTime) / span) * 100;
          return (
            <div
              key={slot.lessonIndex}
              className="absolute top-3 h-10 rounded-md bg-ink text-[11px] text-paper"
              style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }}
              title={`Урок ${slot.lessonIndex}`}
            >
              <div className="px-1.5 py-1 leading-tight">
                {slot.lessonIndex}
                <div className="opacity-70">
                  {slot.startTime}–{slot.endTime}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-ink-soft">
        {breaks.map((item) => (
          <span key={item.afterLesson} className="rounded-full bg-paper-2 px-2 py-1">
            Перемена после {item.afterLesson}: {item.minutes} мин ({item.start}–{item.end})
          </span>
        ))}
      </div>
    </div>
  );
}

export function BellsEditor({
  year,
  profiles,
  durations,
  canWrite,
}: {
  year: { includeSaturday: boolean; lessonsPerDay: number };
  profiles: Profile[];
  durations: Duration[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? "new");
  const selected = profiles.find((item) => item.id === selectedId);
  const [form, setForm] = useState(() => ({
    name: selected?.name ?? "1 смена, 5–11 классы",
    shift: selected?.shift ?? ("FIRST" as const),
    gradeFrom: selected?.gradeFrom ?? 5,
    gradeTo: selected?.gradeTo ?? 11,
    slots: selected ? uniqueDaySlots(selected.slots) : defaultSlots(45, 7, "08:00"),
  }));
  const [error, setError] = useState<string | null>(null);

  const overlaps = useMemo(() => findBellOverlaps(form.slots), [form.slots]);

  function loadProfile(id: string) {
    setSelectedId(id);
    const next = profiles.find((item) => item.id === id);
    if (!next) {
      setForm({
        name: "Новый профиль звонков",
        shift: "FIRST",
        gradeFrom: 1,
        gradeTo: 4,
        slots: defaultSlots(35, 5, "08:00"),
      });
      return;
    }
    setForm({
      name: next.name,
      shift: next.shift,
      gradeFrom: next.gradeFrom,
      gradeTo: next.gradeTo,
      slots: uniqueDaySlots(next.slots),
    });
  }

  function updateSlot(index: number, patch: Partial<Slot>) {
    setForm((prev) => ({
      ...prev,
      slots: prev.slots.map((slot) => (slot.lessonIndex === index ? { ...slot, ...patch } : slot)),
    }));
  }

  function addLesson() {
    setForm((prev) => {
      const last = prev.slots[prev.slots.length - 1];
      const start = last ? fromMinutes(toMinutes(last.endTime) + 10) : "08:00";
      const end = fromMinutes(toMinutes(start) + 45);
      return {
        ...prev,
        slots: [...prev.slots, { lessonIndex: prev.slots.length + 1, startTime: start, endTime: end }],
      };
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveBellProfileAction({
        id: selectedId === "new" ? undefined : selectedId,
        ...form,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-4">
        <form action={saveYearFlagsAction} className="flex flex-wrap items-end gap-4">
          <Field label="Максимум уроков в день">
            <Input name="lessonsPerDay" type="number" min={1} max={12} defaultValue={year.lessonsPerDay} />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="includeSaturday" defaultChecked={year.includeSaturday} />
            Суббота в сетке
          </label>
          {canWrite ? <Button variant="secondary">Сохранить настройки года</Button> : null}
        </form>
      </Card>

      <div className="flex flex-wrap gap-2">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => loadProfile(profile.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${selectedId === profile.id ? "bg-ink text-paper" : "bg-white border border-line"}`}
          >
            {profile.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => loadProfile("new")}
          className={`rounded-full px-3 py-1.5 text-sm ${selectedId === "new" ? "bg-ink text-paper" : "bg-white border border-line"}`}
        >
          + Новый профиль
        </button>
      </div>

      <Card className="space-y-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Название профиля">
            <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </Field>
          <Field label="Смена">
            <Select
              value={form.shift}
              onChange={(e) => setForm((prev) => ({ ...prev, shift: e.target.value as "FIRST" | "SECOND" }))}
            >
              <option value="FIRST">1 смена</option>
              <option value="SECOND">2 смена</option>
            </Select>
          </Field>
          <Field label="С параллели">
            <Input
              type="number"
              min={1}
              max={11}
              value={form.gradeFrom}
              onChange={(e) => setForm((prev) => ({ ...prev, gradeFrom: Number(e.target.value) }))}
            />
          </Field>
          <Field label="По параллель">
            <Input
              type="number"
              min={1}
              max={11}
              value={form.gradeTo}
              onChange={(e) => setForm((prev) => ({ ...prev, gradeTo: Number(e.target.value) }))}
            />
          </Field>
        </div>

        <Timeline slots={form.slots} />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-soft">
                <th className="pb-2">Урок</th>
                <th className="pb-2">Начало</th>
                <th className="pb-2">Конец</th>
                <th className="pb-2">Длительность</th>
              </tr>
            </thead>
            <tbody>
              {form.slots.map((slot) => (
                <tr key={slot.lessonIndex} className="border-t border-line">
                  <td className="py-2">{slot.lessonIndex}</td>
                  <td>
                    <Input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateSlot(slot.lessonIndex, { startTime: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => updateSlot(slot.lessonIndex, { endTime: e.target.value })}
                    />
                  </td>
                  <td>{durationMinutes(slot.startTime, slot.endTime)} мин</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {overlaps.length > 0 ? (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {overlaps.map((item) => item.message).join(". ")}
          </div>
        ) : (
          <p className="text-sm text-pine">Интервалы не пересекаются. Перемена = пауза между уроками.</p>
        )}
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={addLesson}>
              Добавить урок
            </Button>
            <Button type="button" onClick={save} disabled={pending || overlaps.length > 0}>
              {pending ? "Сохраняем…" : "Сохранить профиль"}
            </Button>
            {selectedId !== "new" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  startTransition(async () => {
                    await deleteBellProfileAction(selectedId);
                    router.refresh();
                    loadProfile("new");
                  })
                }
              >
                Удалить
              </Button>
            ) : null}
          </div>
        ) : (
          <Badge>Только просмотр</Badge>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-serif text-2xl">Профили длительности</h2>
          <p className="text-sm text-ink-soft">
            Нужны, чтобы разные параллели могли иметь 30, 35, 40 или 45 минут. Звонки задаются вручную выше.
          </p>
        </div>
        <ul className="space-y-2 text-sm">
          {durations.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 rounded-lg bg-paper px-3 py-2">
              <span>{item.name}</span>
              <span className="text-ink-soft">
                {item.durationMin} мин · {item.gradeFrom}–{item.gradeTo}
                {item.shift ? ` · ${item.shift === "FIRST" ? "1 смена" : "2 смена"}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {canWrite ? (
          <form
            className="grid gap-3 md:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              startTransition(async () => {
                await saveDurationProfileAction({
                  name: String(data.get("name")),
                  durationMin: Number(data.get("durationMin")),
                  gradeFrom: Number(data.get("gradeFrom")),
                  gradeTo: Number(data.get("gradeTo")),
                  shift: (String(data.get("shift")) || null) as "FIRST" | "SECOND" | null,
                });
                router.refresh();
              });
            }}
          >
            <Input name="name" placeholder="Название" required />
            <Input name="durationMin" type="number" placeholder="Минут" defaultValue={45} required />
            <Input name="gradeFrom" type="number" placeholder="С" defaultValue={5} required />
            <Input name="gradeTo" type="number" placeholder="По" defaultValue={11} required />
            <div className="flex gap-2">
              <Select name="shift" defaultValue="FIRST">
                <option value="FIRST">1 смена</option>
                <option value="SECOND">2 смена</option>
              </Select>
              <Button type="submit">Добавить</Button>
            </div>
          </form>
        ) : null}
      </Card>
    </div>
  );
}

function defaultSlots(minutes: number, count: number, start: string): Slot[] {
  let cursor = toMinutes(start);
  const slots: Slot[] = [];
  for (let i = 0; i < count; i += 1) {
    const startTime = fromMinutes(cursor);
    const endTime = fromMinutes(cursor + minutes);
    slots.push({ lessonIndex: i + 1, startTime, endTime });
    cursor += minutes + (i === 1 ? 15 : 10);
  }
  return slots;
}
