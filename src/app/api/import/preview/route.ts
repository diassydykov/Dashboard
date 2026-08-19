import { NextResponse } from "next/server";
import { requireAppContext } from "@/lib/auth";
import {
  assertColumns,
  parseClassRows,
  parseNormRows,
  parseRoomRows,
  parseTeacherRows,
  parseWorkloadRows,
  readSheetRows,
  type ImportIssue,
} from "@/lib/excel/parse";
import { TEMPLATE_COLUMNS, TEMPLATE_META, type TemplateType } from "@/lib/excel/templates";
import { recordImport } from "@/lib/import/apply";

const TYPES: TemplateType[] = ["classes", "teachers", "rooms", "workload", "norms"];

export async function POST(request: Request) {
  const ctx = await requireAppContext();
  const form = await request.formData();
  const file = form.get("file");
  const type = String(form.get("type") ?? "") as TemplateType;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Прикрепите файл" }, { status: 400 });
  }
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: "Неизвестный тип импорта" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { headers, rows } = readSheetRows(buffer);
  const issues: ImportIssue[] = assertColumns(type, headers);

  let preview: unknown[] = [];
  if (issues.length === 0) {
    if (type === "classes") {
      const parsed = parseClassRows(rows);
      issues.push(...parsed.issues);
      preview = parsed.data;
    } else if (type === "teachers") {
      const parsed = parseTeacherRows(rows);
      issues.push(...parsed.issues);
      preview = parsed.data;
    } else if (type === "rooms") {
      const parsed = parseRoomRows(rows);
      issues.push(...parsed.issues);
      preview = parsed.data;
    } else if (type === "workload") {
      const parsed = parseWorkloadRows(rows);
      issues.push(...parsed.issues);
      preview = parsed.data;
    } else {
      const parsed = parseNormRows(rows);
      issues.push(...parsed.issues);
      preview = parsed.data;
    }
  }

  await recordImport({
    schoolId: ctx.school.id,
    yearId: ctx.year?.id ?? null,
    type,
    fileName: file.name,
    createdBy: ctx.userId,
    rowCount: preview.length,
    errorCount: issues.length,
    report: { issues, headers },
    applied: false,
  });

  return NextResponse.json({
    type,
    fileName: file.name,
    headers,
    expected: TEMPLATE_COLUMNS[type],
    meta: TEMPLATE_META[type],
    rowCount: preview.length,
    issues,
    preview,
    valid: issues.length === 0 && preview.length > 0,
    strategy:
      type === "norms"
        ? "Каждый успешный импорт создаёт новую активную версию справочника."
        : "Upsert по естественному ключу. Частично невалидный файл не записывается.",
  });
}
