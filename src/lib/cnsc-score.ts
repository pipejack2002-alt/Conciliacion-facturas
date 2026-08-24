/** Anexo técnico 2676: escala 0–100, dos decimales truncados (no redondeados). */
export function trunc100(correct: number, total: number): number {
  if (!total) return 0;
  return Math.trunc((correct / total) * 10000) / 100;
}

export function formatPuntaje(n: number): string {
  return n.toFixed(2);
}
