import type { RegistryContract } from "../client/types";

/**
 * Adapter for enqueueing jobs. The app's queue implementation (BullMQ, Inngest, etc.)
 * provides this; the job client wraps it with typed enqueue(opName, payload, options?).
 */
export interface EnqueueLike {
	enqueue(
		name: string,
		payload: unknown,
		options?: { idempotencyKey?: string },
	): Promise<void>;
}

/**
 * Typed enqueue return: one overload or generic method that accepts operation name and
 * payload typed to the operation's input, plus optional idempotency key.
 */
export type JobClientEnqueue<R extends RegistryContract> = <K extends keyof R>(
	opName: K,
	payload: R[K]["input"],
	options?: { idempotencyKey?: string },
) => Promise<void>;
