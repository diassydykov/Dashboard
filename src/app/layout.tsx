import type { Metadata } from "next";
import { Manrope, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-manrope",
});

const sourceSerif = Source_Serif_4({
  subsets: ["cyrillic", "latin"],
  variable: "--font-source",
});

export const metadata: Metadata = {
  title: "Конструктор расписания",
  description: "Расписание уроков для школ Казахстана: смены, нагрузка, конфликты и черновик на 2026–2027 год.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${sourceSerif.variable} antialiased`}>{children}</body>
    </html>
  );
}
