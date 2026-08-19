import { requireAppContext } from "@/lib/auth";
import { ensureScheduleVersions, loadVersionLessons } from "@/lib/schedule/data";
import { classLabel, shiftLabel, WEEKDAYS } from "@/lib/time";

export default async function PrintSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ classGroupId?: string; teacherId?: string }>;
}) {
  const ctx = await requireAppContext();
  if (!ctx.year) return <p>Нет учебного года</p>;
  const params = await searchParams;
  const { published, draft } = await ensureScheduleVersions(ctx.school.id, ctx.year.id);
  const lessons = await loadVersionLessons(published.id);
  const source = lessons.length > 0 ? lessons : await loadVersionLessons(draft.id);
  const filtered = source.filter((lesson) => {
    if (params.classGroupId && lesson.classGroupId !== params.classGroupId) return false;
    if (params.teacherId && lesson.teacherId !== params.teacherId) return false;
    return true;
  });
  const days = ctx.year.includeSaturday ? WEEKDAYS : WEEKDAYS.filter((day) => day.value <= 5);
  const maxIndex = Math.max(ctx.year.lessonsPerDay, ...filtered.map((item) => item.lessonIndex), 1);

  return (
    <div className="print-page bg-white p-8 text-ink">
      <div className="no-print mb-6 text-sm">
        <a href="/schedule" className="text-copper underline">
          Назад к сетке
        </a>
        <span className="ml-4 text-ink-soft">Для печати: Ctrl+P</span>
      </div>
      <h1 className="font-serif text-3xl">{ctx.school.name}</h1>
      <p className="text-ink-soft">
        {ctx.year.name} · расписание {params.classGroupId ? "класса" : params.teacherId ? "учителя" : ""}
      </p>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-line px-2 py-1">Урок</th>
            {days.map((day) => (
              <th key={day.value} className="border border-line px-2 py-1">
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxIndex }, (_, i) => i + 1).map((index) => (
            <tr key={index}>
              <td className="border border-line px-2 py-2">{index}</td>
              {days.map((day) => {
                const cell = filtered.filter(
                  (lesson) => lesson.weekday === day.value && lesson.lessonIndex === index,
                );
                return (
                  <td key={day.value} className="border border-line px-2 py-2 align-top">
                    {cell.map((lesson) => (
                      <div key={lesson.id} className="mb-2">
                        <strong>{lesson.subject.name}</strong>
                        <div>
                          {classLabel(lesson.classGroup.grade.number, lesson.classGroup.letter)} ·{" "}
                          {lesson.teacher.shortName}
                        </div>
                        <div>
                          {lesson.startTime}–{lesson.endTime} · {shiftLabel(lesson.shift)}
                          {lesson.room ? ` · ${lesson.room.name}` : ""}
                        </div>
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
