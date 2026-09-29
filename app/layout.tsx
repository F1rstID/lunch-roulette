import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "점심 룰렛 · Lunch Roulette",
  // 정적 문자열이라 설정값을 넣을 수 없다. 시각을 박으면 대시보드에서 추첨 시각을 바꾼 날 이 문장만
  // 혼자 거짓이 되므로 시각을 뺀다(SPIN-06).
  description: "매일 정해진 시각에 자동으로 돌아가는 익명 점심 매장 룰렛",
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
