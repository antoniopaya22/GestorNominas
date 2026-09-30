// Leer/escribir un parámetro numérico de la URL sin recargar la página
// (window.history.replaceState) — usado para que una selección (perfil,
// nómina abierta...) sea compartible/recargable, sin meter un router.

export function readIntParam(name: string): number | null {
  if (typeof window === "undefined") return null;
  const v = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isInteger(v) && v > 0 ? v : null;
}

export function setIntParam(name: string, value: number | null) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, String(value));
  else url.searchParams.delete(name);
  window.history.replaceState(null, "", url);
}
