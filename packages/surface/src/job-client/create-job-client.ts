import type { BindingRef } from "../bindings";
import { isBindingRef, serializeBindingRef } from "../bindings";
import type { RegistryContract } from "../client/types";
import type { EnqueueLike, JobClientEnqueueWithBinding } from "./types";

/**
 * Creates a type-safe job enqueue client. Payload is typed per operation;
 * idempotency key is optional for all operations (runner uses it when the op's job config defines it).
 */
export function createJobClient<R extends RegistryContract>(
	enqueue: EnqueueLike,
): { enqueue: JobClientEnqueueWithBinding<R> } {
	return {
		enqueue: async (
			opName: string | BindingRef,
			payload: unknown,
			options?: { idempotencyKey?: string },
		) => {
			const name = isBindingRef(opName)
				? serializeBindingRef(opName)
				: (opName as string);
			await enqueue.enqueue(name, payload, options ?? undefined);
		},
	};
}
