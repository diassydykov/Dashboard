import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { requireAppContext } from "@/lib/auth";
import { ensureScheduleVersions, loadVersionLessons } from "@/lib/schedule/data";
import { classLabel, shiftLabel, weekdayLabel } from "@/lib/time";

export async function GET(request: Request) {
  const ctx = await requireAppContext();
  if (!ctx.year) {
    return NextResponse.json({ error: "Нет учебного года" }, { status: 400 });
  }
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "published" ? "published" : "draft";
  const classGroupId = url.searchParams.get("classGroupId") || "";
  const teacherId = url.searchParams.get("teacherId") || "";
  const versions = await ensureScheduleVersions(ctx.school.id, ctx.year.id);
  const versionId = kind === "published" ? versions.published.id : versions.draft.id;
  const lessons = (await loadVersionLessons(versionId)).filter((lesson) => {
    if (classGroupId && lesson.classGroupId !== classGroupId) return false;
    if (teacherId && lesson.teacherId !== teacherId) return false;
    return true;
  });

  const rows = [
    ["Школа", ctx.school.name],
    ["Год", ctx.year.name],
    ["Версия", kind === "draft" ? "Черновик" : "Опубликовано"],
    [],
    ["День", "Смена", "Урок", "Начало", "Конец", "Класс", "Предмет", "Учитель", "Кабинет"],
    ...lessons.map((lesson) => [
      weekdayLabel(lesson.weekday),
      shiftLabel(lesson.shift),
      lesson.lessonIndex,
      lesson.startTime,
      lesson.endTime,
      classLabel(lesson.classGroup.grade.number, lesson.classGroup.letter),
      lesson.subject.name,
      lesson.teacher.fullName,
      lesson.room?.name ?? "",
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Расписание");
  const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  const name = `Расписание-${ctx.school.code}-${kind}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
