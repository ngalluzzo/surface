import type { ZodType } from "zod";
import type {
	AnyOperation,
	DefaultContext,
	ExposeSurface,
	Operation,
	OperationRegistry,
	SurfaceBindingConfigMap,
	SurfaceBindings,
} from "../operation/types";
import type { OperationRegistryWithHooks } from "./define-registry";

export interface NormalizedSurfaceBinding<
	S extends ExposeSurface,
	C extends DefaultContext = DefaultContext,
	TPayload = unknown,
> {
	bindingId: string;
	bindingName: string;
	surface: S;
	operationName: string;
	op: Operation<ZodType, TPayload, unknown, string, C>;
	config: SurfaceBindingConfigMap<TPayload, C>[S];
}

/**
 * Normalizes the current expose model into explicit binding records.
 * Each surface can expose one or more named bindings per operation.
 * Adapters consume this normalized form instead of reaching into op.expose directly.
 */
export function normalizeOperationSurfaceBindings<
	S extends ExposeSurface,
	TPayload,
	TOutput,
	TError extends string,
	C extends DefaultContext = DefaultContext,
>(
	op: Operation<ZodType, TPayload, TOutput, TError, C>,
	surface: S,
) : NormalizedSurfaceBinding<S, C, TPayload>[] {
	const bindings = op.expose[surface] as
		| SurfaceBindings<SurfaceBindingConfigMap<TPayload, C>[S]>
		| undefined;
	if (bindings === undefined) return [];

	return Object.entries(bindings).map(([bindingName, config]) => ({
		bindingId: `${op.name}:${bindingName}`,
		bindingName,
		surface,
		operationName: op.name,
		op,
		config,
	}));
}

export function normalizeSurfaceBindings<
	S extends ExposeSurface,
	C extends DefaultContext = DefaultContext,
>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	surface: S,
): NormalizedSurfaceBinding<S, C>[] {
	const bindings: NormalizedSurfaceBinding<S, C>[] = [];
	for (const [, op] of registry) {
		bindings.push(
			...normalizeOperationSurfaceBindings(op as AnyOperation<C>, surface),
		);
	}
	return bindings;
}

export function getSurfaceBindingLookupKey<
	S extends ExposeSurface,
	C extends DefaultContext = DefaultContext,
	TPayload = unknown,
>(binding: NormalizedSurfaceBinding<S, C, TPayload>): string {
	return binding.bindingName === "default"
		? binding.operationName
		: binding.bindingId;
}

export function resolveOperationSurfaceBinding<
	S extends ExposeSurface,
	TPayload,
	TOutput,
	TError extends string,
	C extends DefaultContext = DefaultContext,
>(
	op: Operation<ZodType, TPayload, TOutput, TError, C>,
	surface: S,
	bindingName?: string,
): NormalizedSurfaceBinding<S, C, TPayload> | undefined {
	const bindings = normalizeOperationSurfaceBindings(op, surface);
	if (bindings.length === 0) return undefined;

	if (bindingName !== undefined) {
		return bindings.find((binding) => binding.bindingName === bindingName);
	}

	if (bindings.length === 1) return bindings[0];
	const defaultBinding = bindings.find(
		(binding) => binding.bindingName === "default",
	);
	if (defaultBinding) return defaultBinding;

	throw new Error(
		`Operation "${op.name}" exposes multiple ${surface} bindings; specify a binding name`,
	);
}
