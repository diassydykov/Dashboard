import { NextResponse } from "next/server";
import { assertCanWrite, requireAppContext } from "@/lib/auth";
import {
  applyClassImport,
  applyNormImport,
  applyRoomImport,
  applyTeacherImport,
  applyWorkloadImport,
  recordImport,
} from "@/lib/import/apply";
import type { TemplateType } from "@/lib/excel/templates";
import type {
  ParsedClassRow,
  ParsedNormRow,
  ParsedRoomRow,
  ParsedTeacherRow,
  ParsedWorkloadRow,
} from "@/lib/excel/parse";

export async function POST(request: Request) {
  const ctx = await requireAppContext();
  try {
    assertCanWrite(ctx);
  } catch {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  if (!ctx.year) {
    return NextResponse.json({ error: "Сначала создайте учебный год" }, { status: 400 });
  }

  const body = (await request.json()) as {
    type: TemplateType;
    fileName: string;
    replaceAll?: boolean;
    rows: unknown[];
  };

  const replaceAll = Boolean(body.replaceAll);
  const schoolId = ctx.school.id;
  const yearId = ctx.year.id;

  try {
    if (body.type === "classes") {
      await applyClassImport({ schoolId, yearId, rows: body.rows as ParsedClassRow[], replaceAll });
    } else if (body.type === "teachers") {
      await applyTeacherImport({ schoolId, rows: body.rows as ParsedTeacherRow[], replaceAll });
    } else if (body.type === "rooms") {
      await applyRoomImport({ schoolId, rows: body.rows as ParsedRoomRow[], replaceAll });
    } else if (body.type === "workload") {
      const issues: Array<{ row: number; message: string }> = [];
      await applyWorkloadImport({
        schoolId,
        yearId,
        rows: body.rows as ParsedWorkloadRow[],
        replaceAll,
        issues,
      });
      if (issues.length > 0) {
        await recordImport({
          schoolId,
          yearId,
          type: body.type,
          fileName: body.fileName,
          createdBy: ctx.userId,
          rowCount: body.rows.length,
          errorCount: issues.length,
          report: { issues },
          applied: false,
        });
        return NextResponse.json({ error: "Связанные справочники не найдены", issues }, { status: 400 });
      }
    } else if (body.type === "norms") {
      await applyNormImport({
        schoolId,
        yearId,
        rows: body.rows as ParsedNormRow[],
        fileName: body.fileName,
      });
    } else {
      return NextResponse.json({ error: "Неизвестный тип" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка импорта" },
      { status: 500 },
    );
  }

  await recordImport({
    schoolId,
    yearId,
    type: body.type,
    fileName: body.fileName,
    createdBy: ctx.userId,
    rowCount: body.rows.length,
    errorCount: 0,
    report: { replaceAll, imported: body.rows.length },
    applied: true,
  });

  return NextResponse.json({ ok: true });
}
