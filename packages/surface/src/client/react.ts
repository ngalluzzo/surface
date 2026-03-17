/**
 * Thin TanStack Query wrapper over the HTTP client.
 * useOperationQuery for read-like operations, useOperationMutation for write-like.
 * Peer dependency: @tanstack/react-query, react.
 */
import type {
	UseMutationOptions,
	UseMutationResult,
	UseQueryOptions,
	UseQueryResult,
} from "@tanstack/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ExecutionError } from "../operation/types";
import type { ClientMap, HttpBindingsRecord } from "./types";

type ClientResult<
	TBindings extends HttpBindingsRecord,
	K extends keyof TBindings,
> = Awaited<ReturnType<ClientMap<TBindings>[K]>>;

/**
 * useOperationQuery — for read-like operations (e.g. GET).
 * queryKey is [opName, input]; queryFn calls client[opName](input).
 */
export function useOperationQuery<
	TBindings extends HttpBindingsRecord,
	K extends keyof TBindings,
>(
	client: ClientMap<TBindings>,
	opName: K,
	input: Parameters<ClientMap<TBindings>[K]>[0],
	options?: Omit<
		UseQueryOptions<
			ClientResult<TBindings, K>,
			ExecutionError,
			ClientResult<TBindings, K>,
			[K, Parameters<ClientMap<TBindings>[K]>[0]]
		>,
		"queryKey" | "queryFn"
	>,
): UseQueryResult<ClientResult<TBindings, K>, ExecutionError> {
	return useQuery({
		...options,
		queryKey: [opName, input],
		queryFn: (() => client[opName](input)) as () => Promise<
			ClientResult<TBindings, K>
		>,
	}) as UseQueryResult<ClientResult<TBindings, K>, ExecutionError>;
}

/**
 * useOperationMutation — for write-like operations (e.g. POST/PUT/PATCH/DELETE).
 * Call mutate(input) or mutateAsync(input) with the operation payload.
 */
export function useOperationMutation<
	TBindings extends HttpBindingsRecord,
	K extends keyof TBindings,
>(
	client: ClientMap<TBindings>,
	opName: K,
	options?: Omit<
		UseMutationOptions<
			ClientResult<TBindings, K>,
			ExecutionError,
			Parameters<ClientMap<TBindings>[K]>[0]
		>,
		"mutationFn"
	>,
): UseMutationResult<
	ClientResult<TBindings, K>,
	ExecutionError,
	Parameters<ClientMap<TBindings>[K]>[0]
> {
	return useMutation({
		...options,
		mutationFn: ((input: Parameters<ClientMap<TBindings>[K]>[0]) =>
			client[opName](input)) as (
			input: Parameters<ClientMap<TBindings>[K]>[0],
		) => Promise<ClientResult<TBindings, K>>,
	}) as UseMutationResult<
		ClientResult<TBindings, K>,
		ExecutionError,
		Parameters<ClientMap<TBindings>[K]>[0]
	>;
}
