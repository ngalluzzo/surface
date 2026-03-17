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

export interface EventBindingDefinition<
	TKey extends string = string,
	_TInput = unknown,
	TRef extends BindingRef<"event", string, string> = BindingRef<
		"event",
		string,
		string
	>,
> {
	key: TKey;
	ref: TRef;
	topic: string;
	source?: string;
}

export type EventBindingsRecord = Record<
	string,
	EventBindingDefinition<string, unknown>
>;

type EventBindingDefinitionFromContractEntry<
	TKey extends string,
	TEntry extends OperationContract,
> = EventBindingDefinition<
	TKey,
	TEntry["input"],
	BindingRef<
		"event",
		OperationNameFromBindingKey<TKey>,
		BindingNameFromBindingKey<TKey>
	>
>;

export type EventBindingsFromContract<R extends RegistryContract> = {
	[K in keyof R & string]: EventBindingDefinitionFromContractEntry<K, R[K]>;
};

export type EventBindingsFromRegistry<TRegistry> = {
	[K in NonStreamingSurfaceBindingKeysOf<TRegistry, "event"> &
		string]: EventBindingDefinition<
		K,
		SurfaceBindingsOf<TRegistry, "event">[K]["input"],
		SurfaceBindingsOf<TRegistry, "event">[K]["ref"]
	>;
};

export type EventMap<R extends RegistryContract> = {
	[K in keyof R & string]: { topic: string; source?: string };
};

export interface EventPublishLike {
	publish(
		topic: string,
		payload: unknown,
		options?: { source?: string },
	): Promise<void>;
}

type EventBindingInput<TBinding> =
	TBinding extends EventBindingDefinition<string, infer TInput>
		? TInput
		: never;

type EventBindingRefOf<TBinding> =
	TBinding extends EventBindingDefinition<string, unknown, infer TRef>
		? TRef
		: never;

export type EventClientPublish<TBindings extends EventBindingsRecord> = <
	K extends keyof TBindings,
>(
	binding: K | TBindings[K] | EventBindingRefOf<TBindings[K]>,
	payload: EventBindingInput<TBindings[K]>,
) => Promise<void>;

export type EventClientPublishUnknown = (
	binding: string | EventBindingDefinition | BindingRef,
	payload: unknown,
) => Promise<void>;
