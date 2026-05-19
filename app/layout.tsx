import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "점심 룰렛 · Lunch Roulette",
  description: "매일 11:55에 자동으로 돌아가는 익명 점심 메뉴 룰렛",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
