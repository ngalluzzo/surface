import { expect } from "bun:test";
import type { Result } from "../../result";
import { isErr, isOk } from "../../result";

/**
 * Assert a Result is Ok and return the unwrapped value.
 * Fails the test with the error message if Result is Err.
 */
export const expectOk = <T, E>(result: Result<T, E>): T => {
	if (isOk(result)) {
		return result.value;
	}
	if (result.kind === "err") {
		throw new Error(
			`Expected Ok but got Err: ${JSON.stringify(result.error, null, 2)}`,
		);
	}
	// This should never happen, but TypeScript needs it
	throw new Error("Invalid result state");
};

/**
 * Assert a Result is Err and return the unwrapped error.
 * Fails the test with the value if Result is Ok.
 */
export const expectErr = <T, E>(result: Result<T, E>): E => {
	if (isErr(result)) {
		return result.error;
	}
	if (result.kind === "ok") {
		throw new Error(
			`Expected Err but got Ok: ${JSON.stringify(result.value, null, 2)}`,
		);
	}
	// This should never happen, but TypeScript needs it
	throw new Error("Invalid result state");
};

/**
 * Assert a Result is Err with a specific error kind/code.
 */
export const expectErrKind = <T, E extends { kind: string }>(
	result: Result<T, E>,
	kind: E["kind"],
): E => {
	const error = expectErr(result);
	expect(error.kind).toBe(kind);
	return error;
};

/**
 * Assert a Result is Ok, then run an assertion fn on the value.
 */
export const expectOkWith = <T, E>(
	result: Result<T, E>,
	assertFn: (value: T) => void,
): void => {
	const value = expectOk(result);
	assertFn(value);
};

/**
 * Assert a Result is Err, then run an assertion fn on the error.
 */
export const expectErrWith = <T, E>(
	result: Result<T, E>,
	assertFn: (error: E) => void,
): void => {
	const error = expectErr(result);
	assertFn(error);
};
