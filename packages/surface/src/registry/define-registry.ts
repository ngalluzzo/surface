import type {
	AnyOperation,
	DefaultContext,
	ExposeSurface,
	LifecycleHooks,
	OperationRegistry,
} from "../operation/types";

export type OperationRegistryWithHooks<
	C extends DefaultContext = DefaultContext,
> = OperationRegistry<C> & { hooks?: LifecycleHooks };

/**
 * Defines a domain registry — a named collection of operations.
 * Domain registries are composed into the root registry by consumers.
 */
export function defineRegistry<C extends DefaultContext = DefaultContext>(
	domain: string,
	operations: AnyOperation<C>[],
): OperationRegistry<C> {
	const map = new Map<string, AnyOperation<C>>();
	for (const op of operations) {
		if (map.has(op.name)) {
			throw new Error(
				`Duplicate operation name "${op.name}" in registry "${domain}"`,
			);
		}
		map.set(op.name, op as AnyOperation<C>);
	}
	return map;
}

/**
 * Merges domain registries into a single root registry.
 * When options.hooks is provided, the returned registry carries them.
 */
export function composeRegistries<C extends DefaultContext = DefaultContext>(
	registries: OperationRegistry<C>[],
	options?: { hooks?: LifecycleHooks },
): OperationRegistryWithHooks<C> {
	const root = new Map() as OperationRegistryWithHooks<C>;
	for (const registry of registries) {
		for (const [name, op] of registry) {
			if (root.has(name)) {
				throw new Error(`Duplicate operation name "${name}" across registries`);
			}
			root.set(name, op as AnyOperation<C>);
		}
	}
	if (options?.hooks) {
		root.hooks = options.hooks;
	}
	return root;
}

/**
 * Filters a registry to only operations exposed on a given surface.
 * Preserves .hooks from the input registry.
 */
export function forSurface<C extends DefaultContext = DefaultContext>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	surface: ExposeSurface,
): OperationRegistryWithHooks<C> {
	const filtered = new Map() as OperationRegistryWithHooks<C>;
	for (const [name, op] of registry) {
		if (op.expose[surface] !== undefined) {
			filtered.set(name, op as AnyOperation<C>);
		}
	}
	if ("hooks" in registry && registry.hooks) {
		filtered.hooks = registry.hooks;
	}
	return filtered;
}
