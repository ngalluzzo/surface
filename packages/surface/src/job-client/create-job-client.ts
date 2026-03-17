import type { RegistryContract } from "../client/types";
import type { EnqueueLike, JobClientEnqueue } from "./types";

/**
 * Creates a type-safe job enqueue client. Payload is typed per operation;
 * idempotency key is optional for all operations (runner uses it when the op's job config defines it).
 */
export function createJobClient<R extends RegistryContract>(
	enqueue: EnqueueLike,
): { enqueue: JobClientEnqueue<R> } {
	return {
		enqueue: async (opName, payload, options) => {
			await enqueue.enqueue(opName as string, payload, options ?? undefined);
		},
	};
}
