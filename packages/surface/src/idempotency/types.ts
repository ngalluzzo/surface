import type { Result } from "../execution/result";
import type { ExecutionError } from "../operation/types";

/**
 * Store for idempotency: cache operation results by (operationName, key) with TTL.
 * Used by executeWithIdempotency so duplicate requests (same key within TTL) return the cached result.
 */
export interface IdempotencyStore {
	get(
		operationName: string,
		key: string,
	): Promise<Result<unknown, ExecutionError> | null>;
	set(
		operationName: string,
		key: string,
		result: Result<unknown, ExecutionError>,
		ttlMs: number,
	): Promise<void>;
	/** Optional: explicit invalidation. */
	delete?(operationName: string, key: string): Promise<void>;
}
