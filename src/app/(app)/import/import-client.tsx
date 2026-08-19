"use client";

import { useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { TEMPLATE_COLUMNS, TEMPLATE_META, TEMPLATE_SAMPLES, type TemplateType } from "@/lib/excel/templates";
import { issuesToCsv, type ImportIssue } from "@/lib/excel/parse";

const TYPES: TemplateType[] = ["classes", "teachers", "rooms", "workload", "norms"];

type PreviewResponse = {
  type: TemplateType;
  fileName: string;
  rowCount: number;
  issues: ImportIssue[];
  preview: unknown[];
  valid: boolean;
  strategy: string;
  error?: string;
};

export function ImportClient({ canWrite }: { canWrite: boolean }) {
  const [type, setType] = useState<TemplateType>("classes");
  const [replaceAll, setReplaceAll] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const meta = TEMPLATE_META[type];
  const columns = TEMPLATE_COLUMNS[type];
  const sample = TEMPLATE_SAMPLES[type];

  async function onFile(file: File) {
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("type", type);
    form.set("file", file);
    const response = await fetch("/api/import/preview", { method: "POST", body: form });
    const json = (await response.json()) as PreviewResponse;
    setPreview(json);
    setBusy(false);
  }

  async function confirm() {
    if (!preview?.valid) return;
    setBusy(true);
    const response = await fetch("/api/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: preview.type,
        fileName: preview.fileName,
        replaceAll,
        rows: preview.preview,
      }),
    });
    const json = (await response.json()) as { ok?: boolean; error?: string; issues?: ImportIssue[] };
    setBusy(false);
    if (!response.ok) {
      setMessage(json.error ?? "Импорт отклонён");
      if (json.issues) setPreview({ ...preview, issues: json.issues, valid: false });
      return;
    }
    setMessage("Импорт выполнен. Частичная запись не используется: файл принят целиком.");
    setPreview(null);
  }

  function downloadErrors() {
    if (!preview) return;
    const blob = new Blob([issuesToCsv(preview.issues)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ошибки-импорта.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TYPES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setType(item);
              setPreview(null);
              setMessage(null);
            }}
            className={`rounded-full px-3 py-1.5 text-sm ${type === item ? "bg-ink text-paper" : "border border-line bg-white"}`}
          >
            {TEMPLATE_META[item].title}
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl">{meta.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{meta.notes[0]}</p>
          </div>
          <a href={`/api/templates/${type}`}>
            <Button variant="secondary" type="button">
              Скачать {meta.fileName}
            </Button>
          </a>
        </div>
        <div>
          <p className="text-sm font-medium">Обязательные колонки</p>
          <p className="mt-1 text-sm text-ink-soft">{columns.join(" · ")}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Образец строки</p>
          <code className="mt-1 block overflow-x-auto rounded-lg bg-paper px-3 py-2 text-xs">
            {columns.map((column, index) => `${column}: ${String(sample[index] ?? "")}`).join("  |  ")}
          </code>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {meta.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="rounded-lg bg-paper px-3 py-2 text-sm">
          Стратегия: <strong>upsert по ключу</strong>
          {type === "norms" ? " (новая версия справочника)." : "."} Файл с ошибками целиком отклоняется.
        </p>
        {type !== "norms" ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} />
            Полностью заменить этот справочник (удалить записи, которых нет в файле)
          </label>
        ) : null}
        {canWrite ? (
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        ) : (
          <Badge>Только просмотр</Badge>
        )}
      </Card>

      {preview ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-medium">{preview.fileName}</h3>
            <Badge tone={preview.valid ? "good" : "bad"}>
              {preview.valid ? `${preview.rowCount} строк готовы` : `${preview.issues.length} ошибок`}
            </Badge>
          </div>
          {preview.issues.length > 0 ? (
            <div className="space-y-2">
              <div className="max-h-64 overflow-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-paper text-left">
                      <th className="px-3 py-2">Строка</th>
                      <th className="px-3 py-2">Колонка</th>
                      <th className="px-3 py-2">Причина</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.issues.map((issue, index) => (
                      <tr key={`${issue.row}-${index}`} className="border-t border-line">
                        <td className="px-3 py-2">{issue.row}</td>
                        <td className="px-3 py-2">{issue.column ?? "—"}</td>
                        <td className="px-3 py-2">{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="secondary" type="button" onClick={downloadErrors}>
                Скачать отчёт об ошибках
              </Button>
            </div>
          ) : (
            <p className="text-sm text-pine">Ошибок нет. Подтвердите запись в базу.</p>
          )}
          {canWrite && preview.valid ? (
            <Button type="button" onClick={confirm} disabled={busy}>
              {busy ? "Записываем…" : "Подтвердить импорт"}
            </Button>
          ) : null}
        </Card>
      ) : null}
      {message ? <p className="text-sm text-pine">{message}</p> : null}
    </div>
  );
}
