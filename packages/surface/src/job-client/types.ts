import type {
	BindingNameFromBindingKey,
	BindingRef,
	OperationNameFromBindingKey,
} from "../bindings";
import type { OperationContract, RegistryContract } from "../client/types";
import type {
	NonStreamingSurfaceBindingKeysOf,
	SurfaceBindingsOf,
} from "../operation/types";

export interface EnqueueLike {
	enqueue(
		name: string,
		payload: unknown,
		options?: { idempotencyKey?: string },
	): Promise<void>;
}

export interface JobBindingDefinition<
	TKey extends string = string,
	_TInput = unknown,
	TRef extends BindingRef<"job", string, string> = BindingRef<
		"job",
		string,
		string
	>,
> {
	key: TKey;
	ref: TRef;
	queue: string;
}

export type JobBindingsRecord = Record<
	string,
	JobBindingDefinition<string, unknown>
>;

type JobBindingDefinitionFromContractEntry<
	TKey extends string,
	TEntry extends OperationContract,
> = JobBindingDefinition<
	TKey,
	TEntry["input"],
	BindingRef<
		"job",
		OperationNameFromBindingKey<TKey>,
		BindingNameFromBindingKey<TKey>
	>
>;

export type JobBindingsFromContract<R extends RegistryContract> = {
	[K in keyof R & string]: JobBindingDefinitionFromContractEntry<K, R[K]>;
};

export type JobBindingsFromRegistry<TRegistry> = {
	[K in NonStreamingSurfaceBindingKeysOf<TRegistry, "job"> &
		string]: JobBindingDefinition<
		K,
		SurfaceBindingsOf<TRegistry, "job">[K]["input"],
		SurfaceBindingsOf<TRegistry, "job">[K]["ref"]
	>;
};

type JobBindingInput<TBinding> =
	TBinding extends JobBindingDefinition<string, infer TInput> ? TInput : never;

type JobBindingRefOf<TBinding> =
	TBinding extends JobBindingDefinition<string, unknown, infer TRef>
		? TRef
		: never;

export type JobClientEnqueue<TBindings extends JobBindingsRecord> = <
	K extends keyof TBindings,
>(
	binding: K | TBindings[K] | JobBindingRefOf<TBindings[K]>,
	payload: JobBindingInput<TBindings[K]>,
	options?: { idempotencyKey?: string },
) => Promise<void>;

export type JobClientEnqueueUnknown = (
	binding: string | JobBindingDefinition | BindingRef,
	payload: unknown,
	options?: { idempotencyKey?: string },
) => Promise<void>;
