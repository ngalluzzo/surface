/**
 * Result<T, E> — standard return shape for operations that can fail without throwing.
 * Owned by this package so it has no dependency on app-specific type packages.
 */
export type Result<T, E = string> =
	| { ok: true; value: T }
	| { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
