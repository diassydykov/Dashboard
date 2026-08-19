import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-copper text-white hover:bg-copper-dark",
    secondary: "bg-white text-ink border border-line hover:bg-paper-2",
    ghost: "bg-transparent text-ink hover:bg-paper-2",
    danger: "bg-danger text-white hover:opacity-90",
  } as const;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none ring-copper/30 focus:ring-2",
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none ring-copper/30 focus:ring-2",
        props.className,
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none ring-copper/30 focus:ring-2",
        props.className,
      )}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-ink-soft/70">{hint}</span> : null}
    </label>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-[0_1px_0_rgba(23,32,43,0.04)]", className)}>
      {children}
    </section>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "copper";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-paper-2 text-ink-soft",
    good: "bg-pine/10 text-pine",
    warn: "bg-amber-100 text-warn",
    bad: "bg-red-100 text-danger",
    copper: "bg-copper/10 text-copper-dark",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/70 px-6 py-12 text-center">
      <h3 className="font-serif text-xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
