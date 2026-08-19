"use server";

import { revalidatePath } from "next/cache";
import { assertCanWrite, requireAppContext } from "@/lib/auth";
import { DomainError, deleteLesson, generateDraftSchedule, publishDraft, upsertLesson } from "@/lib/schedule/service";
import { lessonInputSchema } from "@/lib/validations";

function fail(error: unknown) {
  if (error instanceof DomainError) {
    return { ok: false as const, error: error.message, details: error.details ?? [] };
  }
  return { ok: false as const, error: error instanceof Error ? error.message : "Ошибка", details: [] };
}

export async function saveLessonAction(input: unknown, lessonId?: string) {
  const ctx = await requireAppContext();
  try {
    assertCanWrite(ctx);
    if (!ctx.year) return { ok: false as const, error: "Нет учебного года", details: [] };
    const parsed = lessonInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false as const, error: "Проверьте поля урока", details: [] };
    await upsertLesson({
      schoolId: ctx.school.id,
      yearId: ctx.year.id,
      payload: parsed.data,
      lessonId,
    });
    revalidatePath("/schedule");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteLessonAction(lessonId: string) {
  const ctx = await requireAppContext();
  try {
    assertCanWrite(ctx);
    if (!ctx.year) return fail(new Error("Нет учебного года"));
    await deleteLesson(ctx.school.id, ctx.year.id, lessonId);
    revalidatePath("/schedule");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function generateAction(seed?: number) {
  const ctx = await requireAppContext();
  try {
    assertCanWrite(ctx);
    if (!ctx.year) return fail(new Error("Нет учебного года"));
    const result = await generateDraftSchedule(ctx.school.id, ctx.year.id, seed ?? 202627);
    revalidatePath("/schedule");
    return {
      ok: true as const,
      placed: result.placed.length,
      unplaced: result.unplaced,
      skippedWithoutTeacher: result.skippedWithoutTeacher,
      timedOut: result.timedOut,
      iterations: result.iterations,
      seed: result.seed,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function publishAction() {
  const ctx = await requireAppContext();
  try {
    assertCanWrite(ctx);
    if (!ctx.year) return fail(new Error("Нет учебного года"));
    await publishDraft(ctx.school.id, ctx.year.id);
    revalidatePath("/schedule");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
