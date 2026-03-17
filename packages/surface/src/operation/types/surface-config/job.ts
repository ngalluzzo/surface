import type { DefaultContext } from "../default-context";
import type { BaseSurfaceConfig } from "./base";

export interface JobSurfaceConfig<TPayload, C extends DefaultContext>
	extends BaseSurfaceConfig<TPayload, C> {
	queue: string;
	retries?: number;
	timeout?: number;
	backoff?: "fixed" | "exponential";
	/**
	 * When set, the job adapter uses this to derive a key for enqueue deduplication.
	 * Same key ⇒ runner can treat as same job (e.g. use as jobId so duplicate enqueues are no-ops).
	 */
	idempotencyKey?: (payload: TPayload, ctx: C) => string;
}
