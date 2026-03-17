import type { Result } from "../execution/result";
import type { ExecutionError } from "../operation/types";
import type { IdempotencyStore } from "./types";

interface Entry {
	result: Result<unknown, ExecutionError>;
	expiryMs: number;
}

/**
 * In-memory idempotency store. Entries expire after ttlMs; get returns null when expired.
 * Suitable for single-instance or tests. For multi-instance HTTP, use a shared store (e.g. Redis).
 */
export function createInMemoryIdempotencyStore(): IdempotencyStore {
	const map = new Map<string, Entry>();

	function slot(operationName: string, key: string): string {
		return `${operationName}:${key}`;
	}

	return {
		async get(
			operationName: string,
			key: string,
		): Promise<Result<unknown, ExecutionError> | null> {
			const entry = map.get(slot(operationName, key));
			if (!entry) return null;
			if (Date.now() >= entry.expiryMs) {
				map.delete(slot(operationName, key));
				return null;
			}
			return entry.result;
		},

		async set(
			operationName: string,
			key: string,
			result: Result<unknown, ExecutionError>,
			ttlMs: number,
		): Promise<void> {
			map.set(slot(operationName, key), {
				result,
				expiryMs: Date.now() + ttlMs,
			});
		},

		async delete(operationName: string, key: string): Promise<void> {
			map.delete(slot(operationName, key));
		},
	};
}
