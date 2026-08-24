const EXAM_KEY = "cuaderno-2676-cnsc-exam";
const PRACTICE_KEY = "cuaderno-2676-practice";

export type ExamSession = {
  v: 1;
  cargoId: string;
  ids: string[];
  answers: Record<string, string>;
  flagged: string[];
  index: number;
  startedAt: number;
  /** Remaining countdown; null = sin tiempo. Only ticks while the exam is open. */
  remainingMs: number | null;
  endsAt?: number | null;
};

export type PracticeSession = {
  v: 1;
  cargoId: string;
  bank: string;
  title: string;
  ids: string[];
  log: Record<string, string>;
  index: number;
  picked: string | null;
  revealed: boolean;
};

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(key) ??
      (key === EXAM_KEY ? sessionStorage.getItem(key) : null);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  if (key === EXAM_KEY) sessionStorage.removeItem(key);
}

function remove(key: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

export function loadExamSession(): ExamSession | null {
  const s = read<ExamSession>(EXAM_KEY);
  if (!s || s.v !== 1 || !Array.isArray(s.ids)) return null;
  if (s.remainingMs == null && s.endsAt) {
    s.remainingMs = Math.max(0, s.endsAt - Date.now());
  }
  return s;
}

export function saveExamSession(s: ExamSession) {
  write(EXAM_KEY, s);
}

export function clearExamSession() {
  remove(EXAM_KEY);
}

export function loadPracticeSession(): PracticeSession | null {
  const s = read<PracticeSession>(PRACTICE_KEY);
  if (!s || s.v !== 1 || !Array.isArray(s.ids) || !s.bank) return null;
  return s;
}

export function savePracticeSession(s: PracticeSession) {
  write(PRACTICE_KEY, s);
}

export function clearPracticeSession() {
  remove(PRACTICE_KEY);
}
