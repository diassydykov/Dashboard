import { NextResponse } from "next/server";
import { buildTemplateWorkbook, downloadFileName, type TemplateType } from "@/lib/excel/templates";
import { requireAppContext } from "@/lib/auth";

const TYPES: TemplateType[] = ["classes", "teachers", "rooms", "workload", "norms"];

export async function GET(
  _request: Request,
  context: { params: Promise<{ type: string }> },
) {
  await requireAppContext();
  const { type } = await context.params;
  if (!TYPES.includes(type as TemplateType)) {
    return NextResponse.json({ error: "Неизвестный шаблон" }, { status: 404 });
  }
  const kind = type as TemplateType;
  const buffer = buildTemplateWorkbook(kind);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadFileName(kind))}`,
    },
  });
}
