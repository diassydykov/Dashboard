"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
      if (signError) {
        setError("Не удалось войти. Проверьте email и пароль.");
        return;
      }
      router.replace(search.get("next") || "/dashboard");
      router.refresh();
    } catch {
      setError("Не заданы переменные окружения Supabase.");
    } finally {
      setPending(false);
    }
  }

  const profileError = search.get("error");

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {profileError === "no-profile" ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          Профиль не найден. Попросите администратора выдать доступ к школе.
        </p>
      ) : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </Field>
      <Field label="Пароль">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Входим…" : "Войти"}
      </Button>
    </form>
  );
}
