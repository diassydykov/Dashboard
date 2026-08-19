export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function unique<T>(items: T[]) {
  return [...new Set(items)];
}
