import type { ZodType } from "zod";

export interface JobDefinitionOptions {
	retries?: number;
	timeout?: number;
	backoff?: "fixed" | "exponential";
}

export interface JobDefinitionLike<T = unknown> {
	name: string;
	schema: ZodType<T>;
	handler: (payload: T, ctx: unknown) => Promise<void>;
	options?: JobDefinitionOptions;
	/**
	 * When set, the runner can use this to derive a key for enqueue deduplication
	 * (e.g. use as jobId so duplicate enqueues with the same key are no-ops).
	 */
	idempotencyKey?: (payload: T, ctx?: unknown) => string;
}

export interface JobRunnerLike {
	register(definition: JobDefinitionLike<unknown>): void;
}

export class NonRetryableError extends Error {
	readonly nonRetryable = true;
	constructor(message: string) {
		super(message);
		this.name = "NonRetryableError";
	}
}
