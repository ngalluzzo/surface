import type { BindingDefinition, BindingKey, BindingRef } from "../bindings";
import { bindingRef, serializeBindingRef } from "../bindings";
import type {
	AnyOperation,
	ExposeSurface,
	OperationNameOf,
	OperationRegistry,
	OperationRegistryWithHooks,
	OperationsOf,
} from "../operation/types";

// biome-ignore lint/suspicious/noExplicitAny: normalized binding helpers intentionally erase registry context variance.
type ErasedRegistryContext = any;

type SurfaceBindingMapFor<
	TOperation extends AnyOperation,
	S extends ExposeSurface,
> = Extract<TOperation["expose"][S], Record<string, unknown>>;

type SurfaceBindingNamesFor<
	TOperation extends AnyOperation,
	S extends ExposeSurface,
> = Extract<keyof SurfaceBindingMapFor<TOperation, S>, string>;

export type OperationSurfaceBindingUnion<
	TOperation extends AnyOperation,
	S extends ExposeSurface,
> = {
	[TBindingName in SurfaceBindingNamesFor<
		TOperation,
		S
	>]: NormalizedSurfaceBinding<S, TOperation, TBindingName>;
}[SurfaceBindingNamesFor<TOperation, S>];

type NormalizedSurfaceBindingConfig<
	TOperation extends AnyOperation,
	S extends ExposeSurface,
	TBindingName extends string,
> = SurfaceBindingMapFor<TOperation, S>[Extract<
	TBindingName,
	keyof SurfaceBindingMapFor<TOperation, S>
>];

export type RegistrySurfaceBindingUnion<
	TRegistry extends
		| OperationRegistry<ErasedRegistryContext, readonly AnyOperation[]>
		| OperationRegistryWithHooks<
				ErasedRegistryContext,
				readonly AnyOperation[]
		  >,
	S extends ExposeSurface,
> = NormalizedSurfaceBinding<
	S,
	OperationsOf<TRegistry>[number],
	SurfaceBindingNamesFor<OperationsOf<TRegistry>[number], S>
>;

export type ResolvedOperationSurfaceBinding<
	TOperation extends AnyOperation,
	S extends ExposeSurface,
	TBindingName extends string | undefined = undefined,
> = [TBindingName] extends [string]
	?
			| Extract<
					OperationSurfaceBindingUnion<TOperation, S>,
					{ bindingName: TBindingName }
			  >
			| undefined
	: OperationSurfaceBindingUnion<TOperation, S> | undefined;

export interface NormalizedSurfaceBinding<
	S extends ExposeSurface = ExposeSurface,
	TOperation extends AnyOperation = AnyOperation,
	TBindingName extends string = string,
> extends BindingDefinition<
		BindingKey<OperationNameOf<TOperation>, TBindingName>,
		BindingRef<S, OperationNameOf<TOperation>, TBindingName>
	> {
	bindingId: BindingKey<OperationNameOf<TOperation>, TBindingName>;
	bindingName: TBindingName;
	surface: S;
	operationName: OperationNameOf<TOperation>;
	op: TOperation;
	config: NormalizedSurfaceBindingConfig<TOperation, S, TBindingName>;
}

function normalizeOperationSurfaceBindingsInternal(
	op: AnyOperation,
	surface: ExposeSurface,
): NormalizedSurfaceBinding[] {
	const bindings = op.expose[surface] as Record<string, unknown> | undefined;
	if (bindings === undefined) return [];

	return Object.entries(bindings).map(([bindingName, config]) => {
		const ref = bindingRef(surface, op.name, bindingName);
		const key = serializeBindingRef(ref);
		return {
			key,
			ref,
			bindingId: key,
			bindingName,
			surface,
			operationName: op.name,
			op,
			config: config as never,
		};
	});
}

/**
 * Normalizes the current expose model into explicit binding records.
 * Each surface can expose one or more named bindings per operation.
 * Adapters consume this normalized form instead of reaching into op.expose directly.
 */
export function normalizeOperationSurfaceBindings<
	TOperation extends AnyOperation,
	S extends ExposeSurface,
>(op: TOperation, surface: S): OperationSurfaceBindingUnion<TOperation, S>[] {
	return normalizeOperationSurfaceBindingsInternal(
		op,
		surface,
	) as unknown as OperationSurfaceBindingUnion<TOperation, S>[];
}

export function normalizeSurfaceBindings<
	TRegistry extends
		| OperationRegistry<ErasedRegistryContext, readonly AnyOperation[]>
		| OperationRegistryWithHooks<
				ErasedRegistryContext,
				readonly AnyOperation[]
		  >,
	S extends ExposeSurface,
>(
	registry: TRegistry,
	surface: S,
): RegistrySurfaceBindingUnion<TRegistry, S>[] {
	const bindings: RegistrySurfaceBindingUnion<TRegistry, S>[] = [];
	for (const [, op] of registry) {
		bindings.push(
			...(normalizeOperationSurfaceBindingsInternal(
				op as AnyOperation,
				surface,
			) as unknown as RegistrySurfaceBindingUnion<TRegistry, S>[]),
		);
	}
	return bindings;
}

export function getSurfaceBindingLookupKey<
	S extends ExposeSurface,
	TOperation extends AnyOperation,
	TBindingName extends string,
>(
	binding: NormalizedSurfaceBinding<S, TOperation, TBindingName>,
): BindingKey<OperationNameOf<TOperation>, TBindingName> {
	return binding.key;
}

export function resolveOperationSurfaceBinding<
	TOperation extends AnyOperation,
	S extends ExposeSurface,
	TBindingName extends string | undefined = undefined,
>(
	op: TOperation,
	surface: S,
	bindingName?: TBindingName,
): ResolvedOperationSurfaceBinding<TOperation, S, TBindingName> {
	const bindings = normalizeOperationSurfaceBindingsInternal(
		op,
		surface,
	) as unknown as OperationSurfaceBindingUnion<TOperation, S>[];
	if (bindings.length === 0) return undefined;

	if (bindingName !== undefined) {
		return bindings.find(
			(binding) => binding.bindingName === (bindingName as string),
		) as ResolvedOperationSurfaceBinding<TOperation, S, TBindingName>;
	}

	if (bindings.length === 1)
		return bindings[0] as ResolvedOperationSurfaceBinding<
			TOperation,
			S,
			TBindingName
		>;
	const defaultBinding = bindings.find(
		(binding) => binding.bindingName === "default",
	);
	if (defaultBinding)
		return defaultBinding as ResolvedOperationSurfaceBinding<
			TOperation,
			S,
			TBindingName
		>;

	throw new Error(
		`Operation "${op.name}" exposes multiple ${surface} bindings; specify a binding name`,
	);
}
