/**
 * storage.ts — fail-safe localStorage access. Private mode / disabled storage
 * throws on access; callers shouldn't have to care, so everything degrades to a
 * no-op (writes) or null (reads).
 */

export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
