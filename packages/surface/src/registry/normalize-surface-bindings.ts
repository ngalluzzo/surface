import type {
	AnyOperation,
	DefaultContext,
	ExposeSurface,
	OperationRegistry,
	SurfaceConfigMap,
} from "../operation/types";
import type { OperationRegistryWithHooks } from "./define-registry";

export interface NormalizedSurfaceBinding<
	S extends ExposeSurface,
	C extends DefaultContext = DefaultContext,
> {
	bindingId: string;
	bindingName: string;
	surface: S;
	operationName: string;
	op: AnyOperation<C>;
	config: SurfaceConfigMap<unknown, C>[S];
}

/**
 * Normalizes the current expose model into explicit binding records.
 * Today each surface yields at most one synthetic "default" binding per operation.
 * This is the seam future multi-binding support can expand behind without
 * changing adapter iteration logic.
 */
export function normalizeOperationSurfaceBindings<
	S extends ExposeSurface,
	C extends DefaultContext = DefaultContext,
>(
	op: AnyOperation<C>,
	surface: S,
): NormalizedSurfaceBinding<S, C>[] {
	const config = op.expose[surface] as SurfaceConfigMap<unknown, C>[S] | undefined;
	if (config === undefined) return [];

	return [
		{
			bindingId: `${op.name}:default`,
			bindingName: "default",
			surface,
			operationName: op.name,
			op,
			config,
		},
	];
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
