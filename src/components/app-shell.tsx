"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/dashboard", label: "Дашборд" },
  { href: "/bells", label: "Звонки" },
  { href: "/import", label: "Импорт" },
  { href: "/curriculum", label: "Учебный план" },
  { href: "/schedule", label: "Расписание" },
];

export function AppShell({
  schoolName,
  yearName,
  userName,
  role,
  isSuperAdmin,
  children,
}: {
  schoolName: string;
  yearName: string;
  userName: string;
  role: string;
  isSuperAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const roleLabel =
    role === "super_admin" ? "Супер-админ" : role === "school_admin" ? "Завуч" : "Просмотр";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="no-print bg-ink text-paper">
        <div className="flex h-full flex-col px-5 py-6">
          <p className="text-[11px] tracking-[0.22em] text-paper/45 uppercase">Школы Казахстана</p>
          <Link href="/dashboard" className="mt-2 font-serif text-2xl leading-tight">
            Расписание
          </Link>
          <p className="mt-3 text-sm text-paper/70">{schoolName}</p>
          <p className="text-xs text-paper/45">{yearName}</p>
          <nav className="mt-8 space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm transition",
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "bg-white/10 text-white"
                    : "text-paper/70 hover:bg-white/5 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            ))}
            {isSuperAdmin ? (
              <Link
                href="/schools"
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm transition",
                  pathname === "/schools" ? "bg-white/10 text-white" : "text-paper/70 hover:bg-white/5",
                )}
              >
                Школы
              </Link>
            ) : null}
          </nav>
          <div className="mt-auto pt-8 text-sm">
            <p className="text-paper/90">{userName}</p>
            <p className="text-xs text-paper/45">{roleLabel}</p>
            <button
              type="button"
              onClick={logout}
              className="mt-3 text-xs text-paper/55 underline-offset-2 hover:text-white hover:underline"
            >
              Выйти
            </button>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</div>
      </div>
    </div>
  );
}
