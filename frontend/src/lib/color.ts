// Los colores de perfiles, cuentas y grupos los elige el usuario. Uno muy
// oscuro (p.ej. el navy de marca #2e3a48) desaparece sobre el fondo del modo
// oscuro, así que hay que adaptarlo.

/** Luminancia relativa WCAG (RGB linealizado); null si no es un hex #rrggbb. */
function relativeLuminance(hex: string): number | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isVeryDark(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const l = relativeLuminance(hex);
  return l !== null && l < 0.08;
}

/**
 * Color usable en ambos temas: si es muy oscuro se sustituye por el token de
 * serie secundaria (navy en claro, pizarra en oscuro). Pensado para series de
 * gráficas y puntos/barras pintados con `style`.
 */
export function adaptiveColor(hex: string | null | undefined, fallback = "var(--chart-2)"): string {
  if (!hex || relativeLuminance(hex) === null) return fallback;
  return isVeryDark(hex) ? "var(--chart-2)" : hex;
}

/** Clase para un elemento pintado con `hex` (p.ej. un icono con fondo de color) para que se vea en oscuro. */
export function darkBoost(hex: string | null | undefined): string {
  return isVeryDark(hex) ? "dark:brightness-[1.75]" : "";
}
