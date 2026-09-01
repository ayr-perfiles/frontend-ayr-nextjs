/**
 * Iniciales de un nombre para el `AvatarFallback`: como mucho dos letras, en
 * mayúsculas. Devuelve `fallback` si no hay nombre utilizable.
 */
export function initials(name: string | null | undefined, fallback = "?") {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || fallback;
}
