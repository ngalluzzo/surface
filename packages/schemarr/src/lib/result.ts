// --- Result<T, E> discriminated union ---

export type Result<T, E> =
	| { readonly kind: "ok"; readonly value: T }
	| { readonly kind: "err"; readonly error: E };

// --- Constructors ---

export const ok = <T, E = never>(value: T): Result<T, E> => ({
	kind: "ok",
	value,
});

export const err = <E, T = never>(error: E): Result<T, E> => ({
	kind: "err",
	error,
});

// --- Guards ---

export const isOk = <T, E>(r: Result<T, E>): r is { kind: "ok"; value: T } =>
	r.kind === "ok";

export const isErr = <T, E>(r: Result<T, E>): r is { kind: "err"; error: E } =>
	r.kind === "err";

// --- Transforms ---

export const map = <T, U, E>(
	r: Result<T, E>,
	fn: (value: T) => U,
): Result<U, E> => (r.kind === "ok" ? ok(fn(r.value)) : r);

export const mapErr = <T, E, F>(
	r: Result<T, E>,
	fn: (error: E) => F,
): Result<T, F> => (r.kind === "err" ? err(fn(r.error)) : r);

export const flatMap = <T, U, E>(
	r: Result<T, E>,
	fn: (value: T) => Result<U, E>,
): Result<U, E> => (r.kind === "ok" ? fn(r.value) : r);

// --- Unwrap ---

export const unwrapOr = <T, E>(r: Result<T, E>, fallback: T): T =>
	r.kind === "ok" ? r.value : fallback;

export const unwrap = <T, E>(r: Result<T, E>): T => {
	if (r.kind === "ok") return r.value;
	throw new Error(`Unwrap called on Err: ${JSON.stringify(r.error)}`);
};

// --- Collect ---

export const collect = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
	const values: T[] = [];
	for (const r of results) {
		if (r.kind === "err") return r;
		values.push(r.value);
	}
	return ok(values);
};

// --- From throwing ---

export const fromThrowable = <T>(fn: () => T): Result<T, Error> => {
	try {
		return ok(fn());
	} catch (e) {
		return err(e instanceof Error ? e : new Error(String(e)));
	}
};
