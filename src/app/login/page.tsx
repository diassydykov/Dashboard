import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-paper">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,#c45c26_0%,transparent_32%),radial-gradient(circle_at_80%_20%,#2d6a4f_0%,transparent_24%)] opacity-40" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 lg:flex-row lg:items-center lg:gap-20">
        <div className="max-w-xl">
          <p className="text-sm tracking-[0.2em] text-paper/60 uppercase">2026–2027</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-paper md:text-5xl">
            Конструктор школьного расписания
          </h1>
          <p className="mt-4 max-w-md text-paper/75">
            Две смены, свои звонки, импорт из Excel и сетка без конфликтов учителя, класса и кабинета.
          </p>
        </div>
        <div className="mt-10 w-full max-w-md rounded-3xl bg-paper p-8 text-ink shadow-2xl lg:mt-0">
          <h2 className="font-serif text-2xl">Вход для администрации</h2>
          <p className="mt-1 mb-6 text-sm text-ink-soft">Только сотрудники школы. Публичной регистрации нет.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
