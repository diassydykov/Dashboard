import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <p className="text-sm tracking-[0.2em] text-ink-soft uppercase">404</p>
      <h1 className="mt-2 font-serif text-4xl">Страница не найдена</h1>
      <p className="mt-3 text-ink-soft">Проверьте адрес или вернитесь к расписанию.</p>
      <Link href="/dashboard" className="mt-6 inline-block text-copper underline">
        На дашборд
      </Link>
    </main>
  );
}
