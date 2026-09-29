export interface Point {
  x: number;
  y: number;
}

/** Escala una serie de valores a coordenadas SVG dentro de width×height (con padding vertical). */
export function toPoints(values: number[], width: number, height: number, pad = 12): Point[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  return values.map((v, i) => ({
    x: +(i * step).toFixed(2),
    y: +(pad + (1 - (v - min) / range) * (height - pad * 2)).toFixed(2),
  }));
}

/** Curva suave (Catmull-Rom → Bézier) que pasa por todos los puntos. */
export function smoothPath(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function areaPath(points: Point[], height: number): string {
  const last = points[points.length - 1];
  return `${smoothPath(points)} L ${last.x} ${height} L ${points[0].x} ${height} Z`;
}
