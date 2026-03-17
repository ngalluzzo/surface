import type { BindingDefinition, BindingRef } from "../bindings";
import type { Result } from "../execution/result";
import type { ExecutionError } from "../operation/types";

/**
 * Contract for a single operation as seen by typed clients.
 * The app (or shared package) defines a registry type mapping operation names to input/output.
 */
export type OperationContract = {
	input: unknown;
	output: unknown;
};

/**
 * Registry type for clients: object mapping operation name to { input, output }.
 * Example: type AppRegistry = { "registrations.register": { input: RegInput; output: RegOutput }; };
 */
export type RegistryContract = Record<string, OperationContract>;

/**
 * HTTP method + path for each operation. Required at runtime for the HTTP client.
 * Can be built from the server registry via buildHttpMapFromRegistry or maintained manually.
 */
export type HttpMap<R extends RegistryContract> = {
	[K in keyof R]: { method: string; path: string };
};

export interface HttpBindingDefinition<TKey extends string = string>
	extends BindingDefinition<TKey> {
	method: string;
	path: string;
}

export type HttpBindings<R extends RegistryContract> = {
	[K in keyof R]: HttpBindingDefinition<K & string>;
};

/**
 * Options for createClient. httpMap provides method/path per binding key at runtime.
 */
export interface CreateClientOptions<R extends RegistryContract> {
	baseUrl: string;
	/** Optional headers (e.g. Authorization). Called per request. */
	headers?: () => Record<string, string>;
	/** Preferred binding definitions keyed by serialized binding key. */
	bindings?: HttpBindings<R>;
	/** Backward-compatible method/path map keyed by serialized binding key. */
	httpMap?: HttpMap<R>;
}

/**
 * Return type of createClient: one async function per binding key, returning Result<Output, ExecutionError>.
 */
export type ClientMap<R extends RegistryContract> = {
	[K in keyof R]: (
		input: R[K]["input"],
	) => Promise<Result<R[K]["output"], ExecutionError>>;
};

export interface ClientInvoke<R extends RegistryContract> {
	<K extends keyof R>(
		binding: K | HttpBindingDefinition<K & string>,
		input: R[K]["input"],
	): Promise<Result<R[K]["output"], ExecutionError>>;
	(
		binding: BindingRef,
		input: unknown,
	): Promise<Result<unknown, ExecutionError>>;
}

export type HttpClient<R extends RegistryContract> = ClientMap<R> & {
	bindings: HttpBindings<R>;
	invoke: ClientInvoke<R>;
};
