export const SAMPLE_RETENTION_HOURS = 96;

export function calculateSampleExpiration(openedAt: Date) {
  return new Date(openedAt.getTime() + SAMPLE_RETENTION_HOURS * 60 * 60 * 1000);
}

