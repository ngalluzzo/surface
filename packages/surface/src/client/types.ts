import type {
	BindingNameFromBindingKey,
	BindingRef,
	OperationNameFromBindingKey,
} from "../bindings";
import type { Result } from "../execution/result";
import type {
	ExecutionError,
	NonStreamingSurfaceBindingKeysOf,
	RegistryContractOf,
	SurfaceBindingsOf,
} from "../operation/types";

/**
 * Contract for a single operation as seen by manual typed clients.
 */
export type OperationContract = {
	input: unknown;
	output: unknown;
};

/**
 * Manual fallback contract for clients. Primary path should derive from bindings.
 */
export type RegistryContract = Record<string, OperationContract>;

export interface HttpBindingDefinition<
	TKey extends string = string,
	_TInput = unknown,
	_TOutput = unknown,
	TRef extends BindingRef<"http", string, string> = BindingRef<
		"http",
		string,
		string
	>,
> {
	key: TKey;
	ref: TRef;
	method: string;
	path: string;
}

export type HttpBindingsRecord = Record<
	string,
	HttpBindingDefinition<string, unknown, unknown>
>;

type BindingInput<TBinding> =
	TBinding extends HttpBindingDefinition<string, infer TInput, unknown>
		? TInput
		: never;

type BindingOutput<TBinding> =
	TBinding extends HttpBindingDefinition<string, unknown, infer TOutput>
		? TOutput
		: never;

type BindingRefOf<TBinding> =
	TBinding extends HttpBindingDefinition<string, unknown, unknown, infer TRef>
		? TRef
		: never;

type HttpBindingDefinitionFromContractEntry<
	TKey extends string,
	TEntry extends OperationContract,
> = HttpBindingDefinition<
	TKey,
	TEntry["input"],
	TEntry["output"],
	BindingRef<
		"http",
		OperationNameFromBindingKey<TKey>,
		BindingNameFromBindingKey<TKey>
	>
>;

export type HttpBindingsFromContract<R extends RegistryContract> = {
	[K in keyof R & string]: HttpBindingDefinitionFromContractEntry<K, R[K]>;
};

export type HttpBindingsFromRegistry<TRegistry> = {
	[K in NonStreamingSurfaceBindingKeysOf<TRegistry, "http"> &
		string]: HttpBindingDefinition<
		K,
		SurfaceBindingsOf<TRegistry, "http">[K]["input"],
		SurfaceBindingsOf<TRegistry, "http">[K]["output"],
		SurfaceBindingsOf<TRegistry, "http">[K]["ref"]
	>;
};

/**
 * Backward-compatible method/path map keyed by serialized binding key.
 */
export type HttpMap<R extends RegistryContract> = {
	[K in keyof R & string]: { method: string; path: string };
};

export interface CreateClientOptions<TBindings extends HttpBindingsRecord> {
	baseUrl: string;
	headers?: () => Record<string, string>;
	bindings: TBindings;
}

export interface CreateClientOptionsFromContract<R extends RegistryContract> {
	baseUrl: string;
	headers?: () => Record<string, string>;
	httpMap: HttpMap<R>;
}

export type ClientMap<TBindings extends HttpBindingsRecord> = {
	[K in keyof TBindings]: (
		input: BindingInput<TBindings[K]>,
	) => Promise<Result<BindingOutput<TBindings[K]>, ExecutionError>>;
};

export type ClientInvoke<TBindings extends HttpBindingsRecord> = <
	K extends keyof TBindings,
>(
	binding: K | TBindings[K] | BindingRefOf<TBindings[K]>,
	input: BindingInput<TBindings[K]>,
) => Promise<Result<BindingOutput<TBindings[K]>, ExecutionError>>;

export type ClientInvokeUnknown = (
	binding: string | HttpBindingDefinition | BindingRef,
	input: unknown,
) => Promise<Result<unknown, ExecutionError>>;

export type HttpClient<TBindings extends HttpBindingsRecord> =
	ClientMap<TBindings> & {
		bindings: TBindings;
		invoke: ClientInvoke<TBindings>;
		invokeUnknown: ClientInvokeUnknown;
	};

export type RegistryClient<TRegistry> = HttpClient<
	HttpBindingsFromRegistry<TRegistry>
>;

export type ManualRegistryClient<R extends RegistryContract> = HttpClient<
	HttpBindingsFromContract<R>
>;

export type RegistryDerivedContract<TRegistry> = RegistryContractOf<TRegistry>;
