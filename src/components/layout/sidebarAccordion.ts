/**
 * Acordeón EXCLUSIVO de los grupos top del sidebar (Comercial/Producción/…).
 * Distinto del acordeón interno de `LineGroup` (openLines, no-exclusivo,
 * multi-línea) — NO reusar ni fusionar estos 2 mecanismos.
 */

export function nextOpenGroup(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked;
}

export function resolveInitialOpenGroup(
  groups: { id: string; hasActiveChild: boolean }[],
): string | null {
  return groups.find((g) => g.hasActiveChild)?.id ?? null;
}

export function shouldShowGroupItems(args: {
  collapsed: boolean;
  openGroup: string | null;
  groupId: string;
}): boolean {
  if (args.collapsed) return true;
  return args.openGroup === args.groupId;
}
