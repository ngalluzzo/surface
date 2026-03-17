import type { Result } from "./result";
import { isErr, isOk } from "./result";

/**
 * Left-to-right function composition.
 * pipe(a, f, g) = g(f(a))
 */
export function pipe<A>(a: A): A;
export function pipe<A, B>(a: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
): D;
export function pipe<A, B, C, D, E>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
): F;
export function pipe(a: unknown, ...fns: ((x: unknown) => unknown)[]): unknown {
	return fns.reduce((acc, fn) => fn(acc), a);
}

/**
 * Compose functions left-to-right, returning a new function.
 * const f = flow(a2b, b2c) → f(a) = c
 */
export function flow<A, B>(ab: (a: A) => B): (a: A) => B;
export function flow<A, B, C>(ab: (a: A) => B, bc: (b: B) => C): (a: A) => C;
export function flow<A, B, C, D>(
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
): (a: A) => D;
export function flow<A, B, C, D, E>(
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
): (a: A) => E;
export function flow(
	...fns: ((x: unknown) => unknown)[]
): (a: unknown) => unknown {
	return (a) => fns.reduce((acc, fn) => fn(acc), a);
}

/**
 * Result-aware pipe: short-circuits on first Err.
 * Each function receives the unwrapped Ok value and returns a new Result.
 */
export function pipeResult<T, E>(initial: Result<T, E>): Result<T, E>;
export function pipeResult<A, B, E>(
	initial: Result<A, E>,
	ab: (a: A) => Result<B, E>,
): Result<B, E>;
export function pipeResult<A, B, C, E>(
	initial: Result<A, E>,
	ab: (a: A) => Result<B, E>,
	bc: (b: B) => Result<C, E>,
): Result<C, E>;
export function pipeResult<A, B, C, D, E>(
	initial: Result<A, E>,
	ab: (a: A) => Result<B, E>,
	bc: (b: B) => Result<C, E>,
	cd: (c: C) => Result<D, E>,
): Result<D, E>;
export function pipeResult<A, B, C, D, F, E>(
	initial: Result<A, E>,
	ab: (a: A) => Result<B, E>,
	bc: (b: B) => Result<C, E>,
	cd: (c: C) => Result<D, E>,
	de: (d: D) => Result<F, E>,
): Result<F, E>;
export function pipeResult(
	initial: Result<unknown, unknown>,
	...fns: ((x: unknown) => Result<unknown, unknown>)[]
): Result<unknown, unknown> {
	let acc: Result<unknown, unknown> = initial;
	for (const fn of fns) {
		if (isErr(acc)) return acc;
		acc = fn(isOk(acc) ? acc.value : acc);
	}
	return acc;
}
