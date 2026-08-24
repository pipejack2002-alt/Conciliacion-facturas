export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function formatMoneyExact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(s: string): string {
  if (!s) return "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

export function formatPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

export function daysAgo(iso: string): number | null {
  const m = (iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const then = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = Date.now();
  if (!Number.isFinite(then) || then > now) return 0;
  return Math.floor((now - then) / 86_400_000);
}
