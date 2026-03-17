import type { ZodType } from "zod";
import type { BindingMeta, BindingRef } from "../bindings";
import { execute } from "../execution/execute";
import type { Result } from "../execution/result";
import type {
	BaseSurfaceConfig,
	DefaultContext,
	ExecutionError,
	ExposeSurface,
	LifecycleHooks,
	Operation,
} from "../operation/types";
import type { IdempotencyStore } from "./types";

/**
 * Returns an execute-like function that uses the store for idempotency:
 * when options.idempotencyKey is set, checks the store first; on cache hit returns cached result;
 * on miss runs execute() and on success stores the result with the given TTL.
 * When idempotencyKey is absent, behaves like execute().
 */
export function executeWithIdempotency(
	store: IdempotencyStore,
	ttlMs: number,
): typeof execute {
	return async <
		TPayload,
		TOutput,
		TError extends string,
		C extends DefaultContext = DefaultContext,
	>(
		op: Operation<ZodType, TPayload, TOutput, TError, C>,
		raw: unknown,
		ctx: C,
		surface: ExposeSurface,
		surfaceConfig: BaseSurfaceConfig<TPayload, C> | undefined,
		options?: {
			hooks?: LifecycleHooks;
			signal?: AbortSignal;
			dryRun?: boolean;
			idempotencyKey?: string;
			binding?: BindingRef | BindingMeta;
		},
	): Promise<Result<TOutput, ExecutionError>> => {
		const key = options?.idempotencyKey;
		if (!key) {
			return execute(op, raw, ctx, surface, surfaceConfig, options);
		}

		const cached = await store.get(op.name, key);
		if (cached !== null) {
			return cached as Result<TOutput, ExecutionError>;
		}

		const result = await execute(
			op,
			raw,
			ctx,
			surface,
			surfaceConfig,
			options,
		);
		if (result.ok) {
			await store.set(op.name, key, result, ttlMs);
		}
		return result;
	};
}
