export interface LinkCandidate {
  id: number;
  accountId: number;
  accountName: string;
  amount: number;
  date: string;
  payee: string | null;
}

/**
 * Ordena candidatas a "esta es la transacción de esta nómina" — nunca
 * decide por el usuario, solo pone primero las más parecidas. Se descartan
 * las que ni de lejos cuadran en importe (más del 10% u 20€, lo que sea
 * mayor) para no enseñar ingresos que evidentemente no son esta nómina.
 */
export function scoreLinkCandidates(
  candidates: LinkCandidate[],
  targetAmount: number,
  targetDateMs: number | null,
  limit = 5,
): LinkCandidate[] {
  const amountTolerance = Math.max(targetAmount * 0.1, 20);

  return candidates
    .map((t) => ({
      candidate: t,
      amountDiff: Math.abs(t.amount - targetAmount),
      dateDiff: targetDateMs !== null ? Math.abs(new Date(t.date).getTime() - targetDateMs) : 0,
    }))
    .filter((t) => t.amountDiff <= amountTolerance)
    .sort((a, b) => a.amountDiff - b.amountDiff || a.dateDiff - b.dateDiff)
    .slice(0, limit)
    .map((t) => t.candidate);
}

/** Fecha de referencia para comparar: día 28 del mes de la nómina (fecha
 *  habitual de pago), o null si no se pudo extraer el periodo. */
export function payslipReferenceDateMs(periodYear: number | null, periodMonth: number | null): number | null {
  if (!periodYear || !periodMonth) return null;
  return new Date(periodYear, periodMonth - 1, 28).getTime();
}
