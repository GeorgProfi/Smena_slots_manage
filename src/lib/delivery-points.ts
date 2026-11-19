export function parseDeliveryPointsSetting(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((s) => String(s).trim()).filter(Boolean);
    }
  } catch {
    // legacy: plain text
  }
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function serializeDeliveryPoints(points: string[]): string {
  return JSON.stringify(points.map((p) => p.trim()).filter(Boolean));
}