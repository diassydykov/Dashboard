import { PrismaClient, Shift, type Subject, type Teacher } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient();

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function slotsFrom(
  start: string,
  lessonMin: number,
  breaks: number[],
  count: number,
  weekdays: number[],
) {
  const [h, m] = start.split(":").map(Number);
  let cursor = (h ?? 0) * 60 + (m ?? 0);
  const daySlots: Array<{ lessonIndex: number; startTime: string; endTime: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const startMin = cursor;
    const endMin = cursor + lessonMin;
    daySlots.push({
      lessonIndex: i + 1,
      startTime: `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`,
      endTime: `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`,
    });
    cursor = endMin + (breaks[i] ?? 10);
  }
  return weekdays.flatMap((weekday) => daySlots.map((slot) => ({ weekday, ...slot })));
}

async function upsertAuthUser(email: string, password: string, fullName: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { fullName },
  });
  if (error && !error.message.toLowerCase().includes("already")) {
    console.warn(`Не удалось создать ${email}: ${error.message}`);
    return null;
  }
  if (data.user) return data.user.id;
  const { data: list } = await admin.auth.admin.listUsers();
  return list.users.find((user) => user.email === email)?.id ?? null;
}

async function main() {
  loadEnvFiles();
  if (!process.env.DATABASE_URL) {
    throw new Error("Нет DATABASE_URL. Заполните .env.local по образцу .env.example");
  }

  const school1 = await prisma.school.upsert({
    where: { code: "demo-1" },
    update: { name: "СОШ №1 (демо)" },
    create: { name: "СОШ №1 (демо)", code: "demo-1", timezone: "Asia/Almaty" },
  });
  const school2 = await prisma.school.upsert({
    where: { code: "demo-2" },
    update: { name: "СОШ №2 (демо)" },
    create: { name: "СОШ №2 (демо)", code: "demo-2", timezone: "Asia/Almaty" },
  });

  const year1 = await prisma.academicYear.upsert({
    where: { schoolId_name: { schoolId: school1.id, name: "2026–2027" } },
    update: { isActive: true, includeSaturday: false, lessonsPerDay: 7, weekCount: 34 },
    create: {
      schoolId: school1.id,
      name: "2026–2027",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-05-25"),
      weekCount: 34,
      includeSaturday: false,
      lessonsPerDay: 7,
      isActive: true,
    },
  });

  await prisma.academicYear.upsert({
    where: { schoolId_name: { schoolId: school2.id, name: "2026–2027" } },
    update: { isActive: true },
    create: {
      schoolId: school2.id,
      name: "2026–2027",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-05-25"),
      isActive: true,
    },
  });

  const grades = await Promise.all(
    [5, 6, 7].map((number) =>
      prisma.grade.upsert({
        where: { schoolId_number: { schoolId: school1.id, number } },
        update: {},
        create: { schoolId: school1.id, number },
      }),
    ),
  );
  const gradeByNumber = new Map(grades.map((grade) => [grade.number, grade]));

  await prisma.lesson.deleteMany({ where: { yearId: year1.id } });
  await prisma.classGroup.deleteMany({ where: { yearId: year1.id } });
  await prisma.bellScheduleProfile.deleteMany({ where: { yearId: year1.id } });
  await prisma.lessonDurationProfile.deleteMany({ where: { yearId: year1.id } });

  const durationPrimary = await prisma.lessonDurationProfile.create({
    data: {
      schoolId: school1.id,
      yearId: year1.id,
      name: "1–4 классы, 35 мин",
      durationMin: 35,
      gradeFrom: 1,
      gradeTo: 4,
      shift: Shift.FIRST,
    },
  });
  const durationMiddle = await prisma.lessonDurationProfile.create({
    data: {
      schoolId: school1.id,
      yearId: year1.id,
      name: "5–11 классы, 1 смена, 45 мин",
      durationMin: 45,
      gradeFrom: 5,
      gradeTo: 11,
      shift: Shift.FIRST,
    },
  });
  const durationSecond = await prisma.lessonDurationProfile.create({
    data: {
      schoolId: school1.id,
      yearId: year1.id,
      name: "5–11 классы, 2 смена, 40 мин",
      durationMin: 40,
      gradeFrom: 5,
      gradeTo: 11,
      shift: Shift.SECOND,
    },
  });
  void durationPrimary;

  const weekdays = [1, 2, 3, 4, 5];

  const firstShiftMiddle = await prisma.bellScheduleProfile.create({
    data: {
      schoolId: school1.id,
      yearId: year1.id,
      name: "1 смена, 5–11 классы",
      shift: Shift.FIRST,
      gradeFrom: 5,
      gradeTo: 11,
      slots: {
        create: slotsFrom("08:00", 45, [10, 15, 10, 10, 10, 10], 7, weekdays),
      },
    },
  });
  const firstShiftPrimary = await prisma.bellScheduleProfile.create({
    data: {
      schoolId: school1.id,
      yearId: year1.id,
      name: "1 смена, 1–4 классы",
      shift: Shift.FIRST,
      gradeFrom: 1,
      gradeTo: 4,
      slots: {
        create: slotsFrom("08:00", 35, [10, 20, 10, 10, 10], 5, weekdays),
      },
    },
  });
  const secondShift = await prisma.bellScheduleProfile.create({
    data: {
      schoolId: school1.id,
      yearId: year1.id,
      name: "2 смена, 5–11 классы",
      shift: Shift.SECOND,
      gradeFrom: 5,
      gradeTo: 11,
      slots: {
        create: slotsFrom("14:00", 40, [10, 10, 15, 10, 10, 10], 7, weekdays),
      },
    },
  });
  void firstShiftMiddle;
  void firstShiftPrimary;
  void secondShift;

  const class5A = await prisma.classGroup.create({
    data: {
      schoolId: school1.id,
      yearId: year1.id,
      gradeId: gradeByNumber.get(5)!.id,
      letter: "А",
      language: "рус",
      shift: Shift.FIRST,
      durationProfileId: durationMiddle.id,
    },
  });
  const class5B = await prisma.classGroup.create({
    data: {
      schoolId: school1.id,
      yearId: year1.id,
      gradeId: gradeByNumber.get(5)!.id,
      letter: "Б",
      language: "каз",
      shift: Shift.FIRST,
      durationProfileId: durationMiddle.id,
    },
  });
  const class6A = await prisma.classGroup.create({
    data: {
      schoolId: school1.id,
      yearId: year1.id,
      gradeId: gradeByNumber.get(6)!.id,
      letter: "А",
      language: "рус",
      shift: Shift.SECOND,
      durationProfileId: durationSecond.id,
    },
  });

  const subjectNames = ["Математика", "Русский язык", "Казахский язык", "История", "Биология", "Физкультура"];
  const subjects: Subject[] = [];
  for (const name of subjectNames) {
    subjects.push(
      await prisma.subject.upsert({
        where: { schoolId_name: { schoolId: school1.id, name } },
        update: {},
        create: { schoolId: school1.id, name, shortName: name.slice(0, 4) },
      }),
    );
  }
  const subject = (name: string) => subjects.find((item) => item.name === name)!;

  const teachersData = [
    { fullName: "Иванова Мария Петровна", shortName: "Иванова М. П.", subjects: ["Математика"] },
    { fullName: "Смагулова Айгуль Ерлановна", shortName: "Смагулова А. Е.", subjects: ["Казахский язык"] },
    { fullName: "Петров Сергей Иванович", shortName: "Петров С. И.", subjects: ["Русский язык"] },
    { fullName: "Нурланова Дина Кайратовна", shortName: "Нурланова Д. К.", subjects: ["История"] },
    { fullName: "Ким Анна Владимировна", shortName: "Ким А. В.", subjects: ["Биология"] },
    { fullName: "Оспанов Ербол Маратович", shortName: "Оспанов Е. М.", subjects: ["Физкультура"] },
  ];

  const teachers: Teacher[] = [];
  for (const item of teachersData) {
    const teacher = await prisma.teacher.upsert({
      where: { schoolId_fullName: { schoolId: school1.id, fullName: item.fullName } },
      update: { shortName: item.shortName, isActive: true },
      create: {
        schoolId: school1.id,
        fullName: item.fullName,
        shortName: item.shortName,
        isActive: true,
      },
    });
    await prisma.teacherSubject.deleteMany({ where: { teacherId: teacher.id } });
    await prisma.teacherSubject.createMany({
      data: item.subjects.map((name) => ({ teacherId: teacher.id, subjectId: subject(name).id })),
    });
    teachers.push(teacher);
  }
  const teacher = (name: string) => teachers.find((item) => item.fullName === name)!;

  const room12 = await prisma.room.upsert({
    where: { schoolId_name: { schoolId: school1.id, name: "Каб. 12" } },
    update: {},
    create: { schoolId: school1.id, name: "Каб. 12", capacity: 30 },
  });
  const gym = await prisma.room.upsert({
    where: { schoolId_name: { schoolId: school1.id, name: "Спортзал" } },
    update: {},
    create: { schoolId: school1.id, name: "Спортзал", capacity: 40 },
  });

  await prisma.curriculumRequirement.deleteMany({ where: { yearId: year1.id } });
  const workload: Array<{
    classId: string;
    subject: string;
    hours: number;
    teacher: string;
    roomId?: string;
  }> = [
    { classId: class5A.id, subject: "Математика", hours: 6, teacher: "Иванова Мария Петровна", roomId: room12.id },
    { classId: class5A.id, subject: "Русский язык", hours: 5, teacher: "Петров Сергей Иванович" },
    { classId: class5A.id, subject: "История", hours: 2, teacher: "Нурланова Дина Кайратовна" },
    { classId: class5A.id, subject: "Физкультура", hours: 3, teacher: "Оспанов Ербол Маратович", roomId: gym.id },
    { classId: class5B.id, subject: "Математика", hours: 6, teacher: "Иванова Мария Петровна", roomId: room12.id },
    { classId: class5B.id, subject: "Казахский язык", hours: 5, teacher: "Смагулова Айгуль Ерлановна" },
    { classId: class5B.id, subject: "Биология", hours: 2, teacher: "Ким Анна Владимировна" },
    { classId: class6A.id, subject: "Математика", hours: 5, teacher: "Иванова Мария Петровна" },
    { classId: class6A.id, subject: "Русский язык", hours: 4, teacher: "Петров Сергей Иванович" },
    { classId: class6A.id, subject: "История", hours: 2, teacher: "Нурланова Дина Кайратовна" },
  ];
  for (const item of workload) {
    await prisma.curriculumRequirement.create({
      data: {
        schoolId: school1.id,
        yearId: year1.id,
        classGroupId: item.classId,
        subjectId: subject(item.subject).id,
        hoursPerWeek: item.hours,
        preferredTeacherId: teacher(item.teacher).id,
        preferredRoomId: item.roomId,
        allowedDays: [1, 2, 3, 4, 5],
      },
    });
  }

  await prisma.curriculumNormVersion.deleteMany({ where: { yearId: year1.id } });
  await prisma.curriculumNormVersion.create({
    data: {
      schoolId: school1.id,
      yearId: year1.id,
      name: "Демонстрационный справочник (не официальные нормы)",
      isActive: true,
      source: "demo",
      notes: "Замените импортом Excel вашей школы. Методичка не зашита в код.",
      items: {
        create: [
          { gradeNumber: 5, language: "рус", planType: "базовый", subjectName: "Математика", hoursPerWeek: 6, subjectId: subject("Математика").id },
          { gradeNumber: 5, language: "рус", planType: "базовый", subjectName: "Русский язык", hoursPerWeek: 5, subjectId: subject("Русский язык").id },
          { gradeNumber: 5, language: "каз", planType: "базовый", subjectName: "Казахский язык", hoursPerWeek: 5, subjectId: subject("Казахский язык").id },
          { gradeNumber: 5, language: null, planType: "базовый", subjectName: "История", hoursPerWeek: 2, subjectId: subject("История").id },
          { gradeNumber: 5, language: null, planType: "базовый", subjectName: "Физкультура", hoursPerWeek: 3, subjectId: subject("Физкультура").id },
          { gradeNumber: 6, language: "рус", planType: "базовый", subjectName: "Математика", hoursPerWeek: 5, subjectId: subject("Математика").id },
        ],
      },
    },
  });

  await prisma.scheduleVersion.upsert({
    where: { yearId_kind: { yearId: year1.id, kind: "draft" } },
    update: { name: "Черновик" },
    create: { schoolId: school1.id, yearId: year1.id, kind: "draft", name: "Черновик" },
  });
  await prisma.scheduleVersion.upsert({
    where: { yearId_kind: { yearId: year1.id, kind: "published" } },
    update: { name: "Опубликовано" },
    create: { schoolId: school1.id, yearId: year1.id, kind: "published", name: "Опубликовано" },
  });

  const password = "DemoSchool2026!";
  const accounts = [
    { email: "zavuch@demo.school", fullName: "Завуч СОШ №1", role: "school_admin" as const, schoolId: school1.id },
    { email: "admin@demo.school", fullName: "Супер-админ", role: "super_admin" as const, schoolId: school1.id, currentSchoolId: school1.id },
    { email: "viewer@demo.school", fullName: "Просмотр", role: "viewer" as const, schoolId: school1.id },
  ];

  for (const account of accounts) {
    const userId = await upsertAuthUser(account.email, password, account.fullName);
    if (!userId) continue;
    await prisma.userProfile.upsert({
      where: { userId },
      update: {
        email: account.email,
        fullName: account.fullName,
        role: account.role,
        schoolId: account.schoolId,
        currentSchoolId: "currentSchoolId" in account ? account.currentSchoolId : account.schoolId,
      },
      create: {
        userId,
        email: account.email,
        fullName: account.fullName,
        role: account.role,
        schoolId: account.schoolId,
        currentSchoolId: "currentSchoolId" in account ? account.currentSchoolId : account.schoolId,
      },
    });
  }

  console.log("Сиды готовы.");
  console.log(`Школа: ${school1.name} (${school1.id}), год ${year1.name}`);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("SUPABASE_SERVICE_ROLE_KEY не задан — демо-пользователи Auth не созданы.");
    console.log("Создайте пользователя в Supabase и вставьте UserProfile вручную (см. README).");
  } else {
    console.log("Демо-вход:  zavuch@demo.school  /  DemoSchool2026!");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
