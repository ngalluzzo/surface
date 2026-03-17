import {
	assertValidExposeBindingNames,
	assertValidOperationName,
} from "../bindings";
import type {
	AnyOperation,
	ExposedSurfacesOf,
	ExposeSurface,
	LifecycleHooks,
	OperationRegistry,
	OperationRegistryWithHooks,
	OperationsOf,
} from "../operation/types";

// biome-ignore lint/suspicious/noExplicitAny: registry helpers intentionally erase context variance while preserving operation literals.
type ErasedRegistryContext = any;

type RegistryOperationUnion<
	TRegistries extends readonly OperationRegistry<
		ErasedRegistryContext,
		readonly AnyOperation[]
	>[],
> = OperationsOf<TRegistries[number]>[number];

type OperationsExposedOnSurface<
	TRegistry extends
		| OperationRegistry<ErasedRegistryContext, readonly AnyOperation[]>
		| OperationRegistryWithHooks<
				ErasedRegistryContext,
				readonly AnyOperation[]
		  >,
	TSurface extends ExposeSurface,
> = OperationsOf<TRegistry>[number] extends infer TOperation
	? TOperation extends AnyOperation
		? TSurface extends ExposedSurfacesOf<TOperation>
			? TOperation
			: never
		: never
	: never;

function createRegistryShape<
	TOperations extends readonly AnyOperation[],
	TRegistry extends
		| OperationRegistry<ErasedRegistryContext, TOperations>
		| OperationRegistryWithHooks<ErasedRegistryContext, TOperations>,
>(base: {
	domain: string;
	operations: TOperations;
	map: TRegistry["map"];
	hooks?: LifecycleHooks;
}): TRegistry {
	return {
		domain: base.domain,
		operations: base.operations,
		map: base.map,
		...(base.hooks ? { hooks: base.hooks } : {}),
		get size() {
			return base.map.size;
		},
		get(name: string) {
			return base.map.get(name as never);
		},
		has(name: string) {
			return base.map.has(name as never);
		},
		[Symbol.iterator]() {
			return base.map[Symbol.iterator]();
		},
	} as unknown as TRegistry;
}

export function defineRegistry<
	const TOperations extends readonly AnyOperation[],
>(
	domain: string,
	operations: TOperations,
): OperationRegistry<ErasedRegistryContext, TOperations> {
	const map = new Map<string, AnyOperation>();
	for (const op of operations) {
		assertValidOperationName(op.name);
		assertValidExposeBindingNames(op.expose as Record<string, unknown>);
		if (map.has(op.name)) {
			throw new Error(
				`Duplicate operation name "${op.name}" in registry "${domain}"`,
			);
		}
		map.set(op.name, op);
	}

	return createRegistryShape({
		domain,
		operations,
		map: map as OperationRegistry<ErasedRegistryContext, TOperations>["map"],
	});
}

/**
 * Merges domain registries into a single root registry.
 * When options.hooks is provided, the returned registry carries them.
 */
export function composeRegistries<
	const TRegistries extends readonly OperationRegistry<
		ErasedRegistryContext,
		readonly AnyOperation[]
	>[],
>(
	registries: TRegistries,
	options?: { hooks?: LifecycleHooks },
): OperationRegistryWithHooks<
	ErasedRegistryContext,
	readonly RegistryOperationUnion<TRegistries>[]
> {
	const operations: RegistryOperationUnion<TRegistries>[] = [];
	const map = new Map<string, RegistryOperationUnion<TRegistries>>();

	for (const registry of registries) {
		for (const [name, op] of registry) {
			if (map.has(name)) {
				throw new Error(`Duplicate operation name "${name}" across registries`);
			}
			map.set(name, op as RegistryOperationUnion<TRegistries>);
			operations.push(op as RegistryOperationUnion<TRegistries>);
		}
	}

	return createRegistryShape({
		domain: "root",
		operations: operations as readonly RegistryOperationUnion<TRegistries>[],
		map: map as OperationRegistryWithHooks<
			ErasedRegistryContext,
			readonly RegistryOperationUnion<TRegistries>[]
		>["map"],
		...(options?.hooks ? { hooks: options.hooks } : {}),
	});
}

/**
 * Filters a registry to only operations exposed on a given surface.
 * Preserves .hooks from the input registry.
 */
export function forSurface<
	TRegistry extends
		| OperationRegistry<ErasedRegistryContext, readonly AnyOperation[]>
		| OperationRegistryWithHooks<
				ErasedRegistryContext,
				readonly AnyOperation[]
		  >,
	TSurface extends ExposeSurface,
>(
	registry: TRegistry,
	surface: TSurface,
): OperationRegistryWithHooks<
	ErasedRegistryContext,
	readonly OperationsExposedOnSurface<TRegistry, TSurface>[]
> {
	const operations = registry.operations.filter((op) => {
		const bindings = op.expose[surface];
		return bindings !== undefined && Object.keys(bindings).length > 0;
	}) as unknown as readonly OperationsExposedOnSurface<TRegistry, TSurface>[];

	const filtered = defineRegistry(`for:${surface}`, operations);
	return createRegistryShape({
		...filtered,
		...("hooks" in registry && registry.hooks ? { hooks: registry.hooks } : {}),
	});
}
