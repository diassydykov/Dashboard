import * as XLSX from "xlsx";
import { parseClassLabel } from "@/lib/time";
import { TEMPLATE_COLUMNS, type TemplateType } from "@/lib/excel/templates";

export type ImportIssue = {
  row: number;
  column?: string;
  message: string;
};

export type ParsedClassRow = {
  row: number;
  grade: number;
  letter: string;
  language: string;
  shift: "FIRST" | "SECOND";
};

export type ParsedTeacherRow = {
  row: number;
  fullName: string;
  shortName: string;
  email: string | null;
  subjects: string[];
};

export type ParsedRoomRow = {
  row: number;
  name: string;
  capacity: number | null;
};

export type ParsedWorkloadRow = {
  row: number;
  classLabel: string;
  grade: number;
  letter: string;
  subject: string;
  hoursPerWeek: number;
  teacher: string;
  room: string | null;
  allowedDays: number[];
};

export type ParsedNormRow = {
  row: number;
  grade: number;
  subject: string;
  hoursPerWeek: number;
  language: string | null;
  planType: string | null;
};

const DAY_ALIASES: Record<string, number> = {
  пн: 1,
  понедельник: 1,
  "1": 1,
  вт: 2,
  вторник: 2,
  "2": 2,
  ср: 3,
  среда: 3,
  "3": 3,
  чт: 4,
  четверг: 4,
  "4": 4,
  пт: 5,
  пятница: 5,
  "5": 5,
  сб: 6,
  суббота: 6,
  "6": 6,
};

function cell(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function readSheetRows(buffer: ArrayBuffer | Buffer): {
  headers: string[];
  rows: Array<Record<string, unknown>>;
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const first = workbook.SheetNames[0];
  if (!first) {
    throw new Error("В файле нет листов");
  }
  const sheet = workbook.Sheets[first];
  if (!sheet) {
    throw new Error("Пустой лист");
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const headerRow = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? [];
  return {
    headers: headerRow.map((item) => normalizeHeader(String(item ?? ""))),
    rows,
  };
}

export function assertColumns(type: TemplateType, headers: string[]): ImportIssue[] {
  const expected = TEMPLATE_COLUMNS[type];
  const issues: ImportIssue[] = [];
  for (const column of expected) {
    if (!headers.includes(column)) {
      issues.push({
        row: 1,
        column,
        message: `Нет обязательной колонки «${column}». Ожидаются: ${expected.join(", ")}`,
      });
    }
  }
  return issues;
}

function normalizeLanguage(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (["каз", "қаз", "казахский", "қазақ", "kaz"].includes(raw)) return "каз";
  if (["рус", "русский", "rus"].includes(raw)) return "рус";
  return raw;
}

function normalizeShift(value: string): "FIRST" | "SECOND" | null {
  const raw = value.trim().toLowerCase();
  if (["1", "1 смена", "первая", "first"].includes(raw)) return "FIRST";
  if (["2", "2 смена", "вторая", "second"].includes(raw)) return "SECOND";
  return null;
}

function parseDays(value: string): { days: number[]; error?: string } {
  if (!value.trim()) return { days: [] };
  const parts = value.split(/[;,/|\s]+/).filter(Boolean);
  const days: number[] = [];
  for (const part of parts) {
    const mapped = DAY_ALIASES[part.toLowerCase()];
    if (!mapped) {
      return { days: [], error: `Неизвестный день «${part}»` };
    }
    days.push(mapped);
  }
  return { days: [...new Set(days)].sort() };
}

function parseHours(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0 || num > 40) return null;
  return num;
}

export function parseClassRows(rows: Array<Record<string, unknown>>): {
  data: ParsedClassRow[];
  issues: ImportIssue[];
} {
  const data: ParsedClassRow[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const gradeRaw = cell(row, "Параллель");
    const letterRaw = cell(row, "Буква");
    const languageRaw = cell(row, "Язык обучения");
    const shiftRaw = cell(row, "Смена");

    if (!gradeRaw && !letterRaw && !languageRaw && !shiftRaw) return;

    const grade = Number(gradeRaw);
    if (!Number.isInteger(grade) || grade < 1 || grade > 11) {
      issues.push({ row: rowNumber, column: "Параллель", message: "Параллель — целое число от 1 до 11" });
    }
    const letter = letterRaw.toUpperCase();
    if (!letter) {
      issues.push({ row: rowNumber, column: "Буква", message: "Укажите букву класса" });
    }
    const language = normalizeLanguage(languageRaw);
    if (!language) {
      issues.push({ row: rowNumber, column: "Язык обучения", message: "Укажите язык обучения (каз или рус)" });
    }
    const shift = normalizeShift(shiftRaw);
    if (!shift) {
      issues.push({ row: rowNumber, column: "Смена", message: "Смена должна быть 1 или 2" });
    }

    const key = `${grade}-${letter}`;
    if (seen.has(key)) {
      issues.push({ row: rowNumber, message: `Дубль класса ${grade}${letter}` });
    }
    seen.add(key);

    if (Number.isInteger(grade) && letter && language && shift) {
      data.push({ row: rowNumber, grade, letter, language, shift });
    }
  });

  return { data, issues };
}

export function parseTeacherRows(rows: Array<Record<string, unknown>>): {
  data: ParsedTeacherRow[];
  issues: ImportIssue[];
} {
  const data: ParsedTeacherRow[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const fullName = cell(row, "ФИО");
    const shortName = cell(row, "Краткое имя");
    const email = cell(row, "Email") || null;
    const subjectsRaw = cell(row, "Предметы");

    if (!fullName && !shortName && !subjectsRaw) return;

    if (!fullName) issues.push({ row: rowNumber, column: "ФИО", message: "ФИО обязательно" });
    if (!shortName) issues.push({ row: rowNumber, column: "Краткое имя", message: "Краткое имя обязательно" });
    const subjects = subjectsRaw
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (subjects.length === 0) {
      issues.push({ row: rowNumber, column: "Предметы", message: "Укажите хотя бы один предмет" });
    }
    if (fullName && seen.has(fullName.toLowerCase())) {
      issues.push({ row: rowNumber, column: "ФИО", message: `Дубль учителя «${fullName}»` });
    }
    if (fullName) seen.add(fullName.toLowerCase());
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push({ row: rowNumber, column: "Email", message: "Некорректный email" });
    }

    if (fullName && shortName && subjects.length > 0) {
      data.push({ row: rowNumber, fullName, shortName, email, subjects });
    }
  });

  return { data, issues };
}

export function parseRoomRows(rows: Array<Record<string, unknown>>): {
  data: ParsedRoomRow[];
  issues: ImportIssue[];
} {
  const data: ParsedRoomRow[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = cell(row, "Название");
    const capacityRaw = cell(row, "Вместимость");
    if (!name && !capacityRaw) return;
    if (!name) {
      issues.push({ row: rowNumber, column: "Название", message: "Название кабинета обязательно" });
      return;
    }
    if (seen.has(name.toLowerCase())) {
      issues.push({ row: rowNumber, message: `Дубль кабинета «${name}»` });
    }
    seen.add(name.toLowerCase());
    let capacity: number | null = null;
    if (capacityRaw) {
      const parsed = Number(capacityRaw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        issues.push({ row: rowNumber, column: "Вместимость", message: "Вместимость — целое число" });
      } else {
        capacity = parsed;
      }
    }
    data.push({ row: rowNumber, name, capacity });
  });

  return { data, issues };
}

export function parseWorkloadRows(rows: Array<Record<string, unknown>>): {
  data: ParsedWorkloadRow[];
  issues: ImportIssue[];
} {
  const data: ParsedWorkloadRow[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const classRaw = cell(row, "Класс");
    const subject = cell(row, "Предмет");
    const hoursRaw = cell(row, "Часов в неделю");
    const teacher = cell(row, "Учитель");
    const room = cell(row, "Кабинет") || null;
    const daysRaw = cell(row, "Разрешённые дни");

    if (!classRaw && !subject && !hoursRaw && !teacher) return;

    const parsedClass = parseClassLabel(classRaw.replace(/\s+/g, ""));
    if (!parsedClass) {
      issues.push({ row: rowNumber, column: "Класс", message: "Класс в формате 5А или 5 «А»" });
    }
    if (!subject) issues.push({ row: rowNumber, column: "Предмет", message: "Предмет обязателен" });
    const hours = parseHours(hoursRaw);
    if (hours === null || hours <= 0) {
      issues.push({ row: rowNumber, column: "Часов в неделю", message: "Укажите положительное число часов" });
    }
    if (!teacher) issues.push({ row: rowNumber, column: "Учитель", message: "Учитель обязателен" });
    const { days, error } = parseDays(daysRaw);
    if (error) issues.push({ row: rowNumber, column: "Разрешённые дни", message: error });

    if (parsedClass && subject) {
      const key = `${parsedClass.grade}${parsedClass.letter}:${subject.toLowerCase()}`;
      if (seen.has(key)) {
        issues.push({
          row: rowNumber,
          message: `Дубль нагрузки для ${parsedClass.grade}${parsedClass.letter} / ${subject}`,
        });
      }
      seen.add(key);
    }

    if (parsedClass && subject && hours && hours > 0 && teacher) {
      data.push({
        row: rowNumber,
        classLabel: `${parsedClass.grade}${parsedClass.letter}`,
        grade: parsedClass.grade,
        letter: parsedClass.letter,
        subject,
        hoursPerWeek: hours,
        teacher,
        room,
        allowedDays: days,
      });
    }
  });

  return { data, issues };
}

export function parseNormRows(rows: Array<Record<string, unknown>>): {
  data: ParsedNormRow[];
  issues: ImportIssue[];
} {
  const data: ParsedNormRow[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const gradeRaw = cell(row, "Параллель");
    const subject = cell(row, "Предмет");
    const hoursRaw = cell(row, "Часов в неделю");
    const language = normalizeLanguage(cell(row, "Язык обучения"));
    const planType = cell(row, "Тип плана") || null;

    if (!gradeRaw && !subject && !hoursRaw) return;

    const grade = Number(gradeRaw);
    if (!Number.isInteger(grade) || grade < 1 || grade > 11) {
      issues.push({ row: rowNumber, column: "Параллель", message: "Параллель — целое число от 1 до 11" });
    }
    if (!subject) issues.push({ row: rowNumber, column: "Предмет", message: "Предмет обязателен" });
    const hours = parseHours(hoursRaw);
    if (hours === null || hours < 0) {
      issues.push({ row: rowNumber, column: "Часов в неделю", message: "Укажите число часов" });
    }

    const key = `${grade}|${subject}|${language ?? ""}|${planType ?? ""}`;
    if (seen.has(key)) {
      issues.push({ row: rowNumber, message: "Дубль строки норматива" });
    }
    seen.add(key);

    if (Number.isInteger(grade) && subject && hours !== null && hours >= 0) {
      data.push({ row: rowNumber, grade, subject, hoursPerWeek: hours, language, planType });
    }
  });

  return { data, issues };
}

export function issuesToCsv(issues: ImportIssue[]): string {
  const lines = ["Строка;Колонка;Ошибка", ...issues.map((issue) => `${issue.row};${issue.column ?? ""};${issue.message}`)];
  return lines.join("\n");
}
