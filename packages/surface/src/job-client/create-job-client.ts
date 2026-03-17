import type { BindingRef } from "../bindings";
import {
	isBindingRef,
	parseBindingKey,
	serializeBindingRef,
} from "../bindings";
import type { RegistryContract } from "../client/types";
import type {
	EnqueueLike,
	JobBindingDefinition,
	JobBindingsFromContract,
	JobBindingsRecord,
	JobClientEnqueue,
	JobClientEnqueueUnknown,
} from "./types";

export interface CreateJobClientOptions<TBindings extends JobBindingsRecord> {
	enqueue: EnqueueLike;
	bindings: TBindings;
}

export interface CreateJobClientOptionsFromContract<
	R extends RegistryContract,
> {
	enqueue: EnqueueLike;
	jobBindings: { [K in keyof R & string]: { queue: string } };
}

function resolveJobBindingKey(binding: string | { key: string }): string {
	return typeof binding === "string" ? binding : binding.key;
}

function resolveJobClientBindingKey(
	binding: string | { key: string } | BindingRef,
): string {
	if (isBindingRef(binding)) {
		if (binding.surface !== "job") {
			throw new Error(
				`Job client received ${binding.surface} binding ref; expected job`,
			);
		}
		return serializeBindingRef(binding);
	}

	return resolveJobBindingKey(binding as string | { key: string });
}

export function createJobClient<const TBindings extends JobBindingsRecord>(
	options: CreateJobClientOptions<TBindings>,
): {
	bindings: TBindings;
	enqueue: JobClientEnqueue<TBindings>;
	enqueueUnknown: JobClientEnqueueUnknown;
} {
	const enqueueLike = options.enqueue;
	const { bindings } = options;

	const enqueueByKey = async (
		key: string,
		payload: unknown,
		clientOptions?: { idempotencyKey?: string },
	): Promise<void> => {
		const binding = bindings[key as keyof TBindings];
		if (!binding) {
			throw new Error(`Unknown job binding: ${key}`);
		}
		await enqueueLike.enqueue(binding.key, payload, clientOptions);
	};

	return {
		bindings,
		enqueue: (async (
			binding: unknown,
			payload: unknown,
			clientOptions?: { idempotencyKey?: string },
		) => {
			const key = resolveJobClientBindingKey(
				binding as string | JobBindingDefinition | BindingRef,
			);
			await enqueueByKey(key, payload, clientOptions);
		}) as JobClientEnqueue<TBindings>,
		enqueueUnknown: async (
			binding: string | JobBindingDefinition | BindingRef,
			payload: unknown,
			clientOptions?: { idempotencyKey?: string },
		) => {
			const key = resolveJobClientBindingKey(binding);
			await enqueueByKey(key, payload, clientOptions);
		},
	};
}

export function createJobClientFromBindings<R extends RegistryContract>(
	options: CreateJobClientOptionsFromContract<R>,
): {
	bindings: JobBindingsFromContract<R>;
	enqueue: JobClientEnqueue<JobBindingsFromContract<R>>;
	enqueueUnknown: JobClientEnqueueUnknown;
} {
	const bindings = Object.fromEntries(
		Object.entries(options.jobBindings).map(([key, binding]) => [
			key,
			{
				key,
				ref: parseBindingKey("job", key),
				queue: binding.queue,
			},
		]),
	) as JobBindingsFromContract<R>;

	return createJobClient({
		enqueue: options.enqueue,
		bindings,
	});
}
