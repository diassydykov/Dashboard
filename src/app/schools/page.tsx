import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card } from "@/components/ui";
import { selectSchoolAction } from "@/app/schools/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SchoolsPage() {
  const { profile } = await requireProfile();
  if (profile.role !== "super_admin") {
    redirect("/dashboard");
  }
  const schools = await prisma.school.findMany({ orderBy: { name: "asc" } });
  const currentId = profile.currentSchoolId ?? profile.schoolId;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/dashboard" className="text-sm text-copper underline">
        К рабочей школе
      </Link>
      <header className="mt-4 mb-6">
        <h1 className="font-serif text-4xl">Школы</h1>
        <p className="text-ink-soft">Супер-админ переключает контекст. Данные школ изолированы на сервере.</p>
      </header>
      <div className="grid gap-4">
        {schools.map((school) => (
          <Card key={school.id} className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{school.name}</p>
              <p className="text-sm text-ink-soft">{school.code}</p>
            </div>
            {currentId === school.id ? (
              <span className="text-sm text-pine">Текущая</span>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await selectSchoolAction(school.id);
                }}
              >
                <Button type="submit" variant="secondary">
                  Выбрать
                </Button>
              </form>
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}
