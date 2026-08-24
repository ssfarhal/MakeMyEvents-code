// Add new codes to this list. Codes are case-insensitive.
export const VALID_REFERENCE_CODES: string[] = [
  'MME011103',
];

export const isValidReferenceCode = (input: string): boolean => {
  const norm = (input || '').trim().toUpperCase();
  return VALID_REFERENCE_CODES.map((c) => c.toUpperCase()).includes(norm);
};
