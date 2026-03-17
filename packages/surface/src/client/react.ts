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
import type { Result } from "../execution/result";
import type { ExecutionError } from "../operation/types";
import type { ClientMap, RegistryContract } from "./types";

/**
 * useOperationQuery — for read-like operations (e.g. GET).
 * queryKey is [opName, input]; queryFn calls client[opName](input).
 */
export function useOperationQuery<
	R extends RegistryContract,
	K extends keyof R,
>(
	client: ClientMap<R>,
	opName: K,
	input: R[K]["input"],
	options?: Omit<
		UseQueryOptions<
			Result<R[K]["output"], ExecutionError>,
			ExecutionError,
			Result<R[K]["output"], ExecutionError>,
			[K, R[K]["input"]]
		>,
		"queryKey" | "queryFn"
	>,
): UseQueryResult<Result<R[K]["output"], ExecutionError>, ExecutionError> {
	return useQuery({
		...options,
		queryKey: [opName, input],
		queryFn: () => client[opName](input),
	});
}

/**
 * useOperationMutation — for write-like operations (e.g. POST/PUT/PATCH/DELETE).
 * Call mutate(input) or mutateAsync(input) with the operation payload.
 */
export function useOperationMutation<
	R extends RegistryContract,
	K extends keyof R,
>(
	client: ClientMap<R>,
	opName: K,
	options?: Omit<
		UseMutationOptions<
			Result<R[K]["output"], ExecutionError>,
			ExecutionError,
			R[K]["input"]
		>,
		"mutationFn"
	>,
): UseMutationResult<
	Result<R[K]["output"], ExecutionError>,
	ExecutionError,
	R[K]["input"]
> {
	return useMutation({
		...options,
		mutationFn: (input: R[K]["input"]) => client[opName](input),
	});
}
