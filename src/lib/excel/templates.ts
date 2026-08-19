import * as XLSX from "xlsx";

export const TEMPLATE_COLUMNS = {
  classes: ["Параллель", "Буква", "Язык обучения", "Смена"] as const,
  teachers: ["ФИО", "Краткое имя", "Email", "Предметы"] as const,
  rooms: ["Название", "Вместимость"] as const,
  workload: ["Класс", "Предмет", "Часов в неделю", "Учитель", "Кабинет", "Разрешённые дни"] as const,
  norms: ["Параллель", "Предмет", "Часов в неделю", "Язык обучения", "Тип плана"] as const,
};

export const TEMPLATE_SAMPLES = {
  classes: [5, "А", "рус", "1"],
  teachers: ["Иванова Мария Петровна", "Иванова М. П.", "ivanova@school.kz", "Математика; Алгебра"],
  rooms: ["Каб. 12", 30],
  workload: ["5А", "Математика", 6, "Иванова Мария Петровна", "Каб. 12", "Пн,Вт,Ср,Чт,Пт"],
  norms: [5, "Математика", 6, "рус", "базовый"],
};

export const TEMPLATE_META: Record<
  keyof typeof TEMPLATE_COLUMNS,
  { fileName: string; title: string; notes: string[] }
> = {
  classes: {
    fileName: "Классы.xlsx",
    title: "Классы",
    notes: [
      "Обязательные колонки: Параллель, Буква, Язык обучения, Смена.",
      "Смена: 1 или 2.",
      "Язык обучения: каз / рус (или казахский / русский).",
      "Импорт — upsert по параллели и букве в выбранном учебном году.",
    ],
  },
  teachers: {
    fileName: "Учителя.xlsx",
    title: "Учителя",
    notes: [
      "Обязательные колонки: ФИО, Краткое имя, Предметы. Email необязателен.",
      "Несколько предметов в одной ячейке через ; или ,",
      "Импорт — upsert по ФИО внутри школы.",
    ],
  },
  rooms: {
    fileName: "Кабинеты.xlsx",
    title: "Кабинеты",
    notes: [
      "Обязательная колонка: Название. Вместимость необязательна.",
      "Импорт — upsert по названию кабинета.",
    ],
  },
  workload: {
    fileName: "Учебная нагрузка.xlsx",
    title: "Учебная нагрузка",
    notes: [
      "Обязательные колонки: Класс, Предмет, Часов в неделю, Учитель.",
      "Класс в формате 5А или 5 «А». Кабинет и разрешённые дни необязательны.",
      "Нормативные часы не подставляются автоматически: это нагрузка конкретной школы.",
      "Импорт — upsert по паре класс + предмет.",
    ],
  },
  norms: {
    fileName: "Нормы часов.xlsx",
    title: "Нормы часов (справочник)",
    notes: [
      "Это редактируемый справочник школы, не официальная методичка в коде.",
      "Обязательные колонки: Параллель, Предмет, Часов в неделю.",
      "Язык обучения и тип плана необязательны (например: рус / каз, базовый / с делением).",
      "Каждый импорт создаёт новую версию справочника.",
    ],
  },
};

export type TemplateType = keyof typeof TEMPLATE_COLUMNS;

function instructionSheet(type: TemplateType) {
  const meta = TEMPLATE_META[type];
  const rows = [
    ["Шаблон", meta.title],
    ["Файл", meta.fileName],
    [],
    ["Как заполнять"],
    ...meta.notes.map((note) => [note]),
    [],
    ["Важно"],
    ["Невалидный файл целиком отклоняется — частичная запись в базу не выполняется."],
    ["Стратегия: upsert по естественному ключу. Опция полной замены доступна на экране импорта."],
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

export function buildTemplateWorkbook(type: TemplateType): Buffer {
  const workbook = XLSX.utils.book_new();
  const headers = [...TEMPLATE_COLUMNS[type]];
  const sample = TEMPLATE_SAMPLES[type];
  const dataSheet = XLSX.utils.aoa_to_sheet([headers, sample]);
  dataSheet["!cols"] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Данные");
  XLSX.utils.book_append_sheet(workbook, instructionSheet(type), "Инструкция");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

export function downloadFileName(type: TemplateType) {
  return TEMPLATE_META[type].fileName;
}
