// Normalizes Israeli mobile numbers ("054-1234567", "+972541234567") to E.164.
export function normalizeIlPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let local: string;
  if (digits.startsWith("+972")) local = digits.slice(4);
  else if (digits.startsWith("972")) local = digits.slice(3);
  else if (digits.startsWith("0")) local = digits.slice(1);
  else return null;
  return /^5\d{8}$/.test(local) ? `+972${local}` : null;
}
