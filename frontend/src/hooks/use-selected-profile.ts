import { useEffect, useState } from "react";
import { readIntParam, setIntParam } from "../lib/url-params";

const STORAGE_KEY = "sueldia:lastProfileId";

function readStoredProfileId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function persistProfileId(id: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // Modo privado estricto: se pierde al cerrar la pestaña, sin más.
  }
}

/**
 * Perfil seleccionado, recordado entre páginas (localStorage) para que
 * cambiar de pantalla no pierda la elección — antes cada página con
 * selector de perfil (Subir, Analítica, Mis nóminas...) volvía a por
 * defecto al primer perfil de la lista. Un `?perfil=` en la URL de
 * llegada (p. ej. un enlace desde otra pantalla) manda siempre sobre lo
 * guardado. `paramName` permite otro nombre de parámetro si una página ya
 * usa "perfil" para otra cosa (ninguna lo hace hoy).
 */
export function useSelectedProfile(
  profileIds: number[],
  paramName = "perfil",
): [number | null, (id: number) => void] {
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (selected != null || profileIds.length === 0) return;
    const fromUrl = readIntParam(paramName);
    const fromStorage = readStoredProfileId();
    const initial =
      (fromUrl != null && profileIds.includes(fromUrl) ? fromUrl : null) ??
      (fromStorage != null && profileIds.includes(fromStorage) ? fromStorage : null) ??
      profileIds[0];
    setSelected(initial);
    // Refleja en la URL también la resuelta por localStorage/por defecto,
    // no solo la que ya venía en la URL.
    setIntParam(paramName, initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileIds, selected]);

  const select = (id: number) => {
    setSelected(id);
    persistProfileId(id);
    setIntParam(paramName, id);
  };

  return [selected, select];
}
