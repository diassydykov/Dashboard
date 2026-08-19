import { z } from "zod";

export const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Время в формате ЧЧ:ММ");

export const shiftSchema = z.enum(["FIRST", "SECOND"]);

export const lessonInputSchema = z.object({
  classGroupId: z.string().min(1, "Выберите класс"),
  subjectId: z.string().min(1, "Выберите предмет"),
  teacherId: z.string().min(1, "Выберите учителя"),
  roomId: z.string().optional().nullable(),
  weekday: z.number().int().min(1).max(6),
  lessonIndex: z.number().int().min(1).max(12),
  startTime: hhmm.optional(),
  endTime: hhmm.optional(),
});

export const academicYearSchema = z.object({
  name: z.string().min(4, "Укажите название года"),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  weekCount: z.number().int().min(1).max(52),
  includeSaturday: z.boolean(),
  lessonsPerDay: z.number().int().min(1).max(12),
});

export const bellSlotSchema = z.object({
  lessonIndex: z.number().int().min(1).max(12),
  startTime: hhmm,
  endTime: hhmm,
});

export const bellProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  shift: shiftSchema,
  gradeFrom: z.number().int().min(1).max(11),
  gradeTo: z.number().int().min(1).max(11),
  slots: z.array(bellSlotSchema).min(1, "Добавьте хотя бы один урок"),
});

export const durationProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  durationMin: z.number().int().min(20).max(90),
  gradeFrom: z.number().int().min(1).max(11),
  gradeTo: z.number().int().min(1).max(11),
  shift: shiftSchema.optional().nullable(),
});

export type LessonInput = z.infer<typeof lessonInputSchema>;
