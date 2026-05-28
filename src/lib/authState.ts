/**
 * Tiny module-global bridge so _layout.tsx can pass the auth callback URL
 * to app/auth/callback.tsx without going through router params or AsyncStorage.
 *
 * Usage:
 *   _layout.tsx  → setPendingCallbackUrl(url)   before router.replace("/auth/callback")
 *   callback.tsx → consumePendingCallbackUrl()  on mount (returns the URL once, then null)
 */

let _pending: string | null = null;

export function setPendingCallbackUrl(url: string): void {
  _pending = url;
}

/** Returns the pending URL and clears it (one-time consume). */
export function consumePendingCallbackUrl(): string | null {
  const url = _pending;
  _pending = null;
  return url;
}
