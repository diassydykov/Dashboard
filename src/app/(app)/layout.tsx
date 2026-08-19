import { requireAppContext } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAppContext();
  return (
    <AppShell
      schoolName={ctx.school.name}
      yearName={ctx.year?.name ?? "Учебный год не выбран"}
      userName={ctx.profile.fullName}
      role={ctx.profile.role}
      isSuperAdmin={ctx.profile.role === "super_admin"}
    >
      {children}
    </AppShell>
  );
}
