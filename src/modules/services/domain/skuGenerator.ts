interface DisplayNameParams {
  description?: string;
}

export function generateDisplayName({ description }: DisplayNameParams): string {
  const parts = ['SERVICIO'];
  if (description) parts.push(description);
  return parts.join(' ').toUpperCase();
}
