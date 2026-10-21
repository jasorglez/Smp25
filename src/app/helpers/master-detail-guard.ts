/** Returns true only when a master has an ID that can safely own detail rows. */
export function hasPersistedMasterId(id: unknown, isNew = false): boolean {
  if (isNew || id === null || id === undefined) return false;
  const value = String(id).trim();
  if (!value || /^(temp|tmp|new)[_-]/i.test(value)) return false;
  const numericId = Number(value);
  return Number.isNaN(numericId) || numericId > 0;
}
