// Colores elegidos por el usuario (cuentas, grupos): uno muy oscuro, como el
// navy de marca, desaparece sobre el fondo del modo oscuro. En claro se
// respeta tal cual; en oscuro se aclara con un filtro.
export function isVeryDark(hex: string | null | undefined): boolean {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.25;
}

/** Clase a añadir a un elemento pintado con `hex` para que se vea en oscuro. */
export function darkBoost(hex: string | null | undefined): string {
  return isVeryDark(hex) ? "dark:brightness-[1.75]" : "";
}
