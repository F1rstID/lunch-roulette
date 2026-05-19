// data.jsx — seed data and helpers for the lunch roulette prototype.
// All in-memory — refreshing the page goes back to seed.

const SEED_CANDIDATES = [
  { id: "c1", name: "김치찌개",       addedBy: "민지",   addedAt: "10:14" },
  { id: "c2", name: "돈까스",          addedBy: "현우",   addedAt: "10:22" },
  { id: "c3", name: "마라탕",          addedBy: "예린",   addedAt: "10:31" },
  { id: "c4", name: "냉면",            addedBy: "준호",   addedAt: "10:47" },
  { id: "c5", name: "샐러드 보울",     addedBy: "수아",   addedAt: "11:02" },
  { id: "c6", name: "쌀국수",          addedBy: "도윤",   addedAt: "11:09" },
  { id: "c7", name: "초밥",            addedBy: "지수",   addedAt: "11:18" },
  { id: "c8", name: "제육덮밥",        addedBy: "태민",   addedAt: "11:24" },
];

// Past-month log — fixed so it doesn't shuffle on reload.
// Keyed YYYY-MM-DD against this prototype's "today" (May 19, 2026 — a Tuesday).
const TODAY = { y: 2026, m: 5, d: 19 };

const LOG_SEED = [
  // April spillover
  { date: "2026-04-27", menu: "부대찌개",     winnerOf: 6, addedBy: "현우",   note: "" },
  { date: "2026-04-28", menu: "비빔밥",       winnerOf: 5, addedBy: "수아",   note: "" },
  { date: "2026-04-29", menu: "냉면",         winnerOf: 7, addedBy: "준호",   note: "더워서 다들 만족" },
  { date: "2026-04-30", menu: "초밥",         winnerOf: 4, addedBy: "지수",   note: "" },
  // May
  { date: "2026-05-01", menu: "공휴일",       winnerOf: 0, addedBy: null,    note: "근로자의 날", holiday: true },
  { date: "2026-05-04", menu: "김밥",         winnerOf: 8, addedBy: "민지",   note: "" },
  { date: "2026-05-05", menu: "공휴일",       winnerOf: 0, addedBy: null,    note: "어린이날",       holiday: true },
  { date: "2026-05-06", menu: "쌀국수",       winnerOf: 5, addedBy: "도윤",   note: "" },
  { date: "2026-05-07", menu: "돈까스",       winnerOf: 6, addedBy: "현우",   note: "" },
  { date: "2026-05-08", menu: "샐러드 보울",  winnerOf: 4, addedBy: "수아",   note: "다이어트 데이" },
  { date: "2026-05-11", menu: "마라탕",       winnerOf: 7, addedBy: "예린",   note: "" },
  { date: "2026-05-12", menu: "김치찌개",     winnerOf: 9, addedBy: "민지",   note: "" },
  { date: "2026-05-13", menu: "라멘",         winnerOf: 6, addedBy: "태민",   note: "" },
  { date: "2026-05-14", menu: "제육덮밥",     winnerOf: 5, addedBy: "태민",   note: "" },
  { date: "2026-05-15", menu: "햄버거",       winnerOf: 4, addedBy: "현우",   note: "" },
  { date: "2026-05-18", menu: "찜닭",         winnerOf: 7, addedBy: "지수",   note: "" },
  // 2026-05-19 → "today" — not yet decided
];

// Sequential bright-but-muted hues for wheel slices. Stays on one ~chroma so the
// wheel reads as a coherent palette, not a rainbow.
const SLICE_COLORS = [
  "oklch(0.78 0.10 60)",   // peach
  "oklch(0.82 0.08 110)",  // pale lime
  "oklch(0.78 0.09 180)",  // mint
  "oklch(0.78 0.09 230)",  // sky
  "oklch(0.78 0.10 290)",  // lilac
  "oklch(0.80 0.08 350)",  // rose
  "oklch(0.82 0.07 80)",   // wheat
  "oklch(0.80 0.09 150)",  // sage
  "oklch(0.78 0.10 30)",   // coral
  "oklch(0.82 0.08 260)",  // periwinkle
  "oklch(0.80 0.09 130)",  // pistachio
  "oklch(0.80 0.08 200)",  // teal
];

const ALL_USERS = ["민지", "현우", "예린", "준호", "수아", "도윤", "지수", "태민", "은서"];

// helpers
const pad2 = (n) => String(n).padStart(2, "0");
const fmtDate = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

// today's display string in Korean
const TODAY_KR = `2026년 5월 19일 화요일`;

Object.assign(window, {
  SEED_CANDIDATES,
  LOG_SEED,
  TODAY,
  TODAY_KR,
  SLICE_COLORS,
  ALL_USERS,
  pad2,
  fmtDate,
});
