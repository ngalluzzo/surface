import type { ZodType } from "zod";
import type { BindingRef } from "../bindings";
import {
	assertValidExposeBindingNames,
	assertValidOperationName,
} from "../bindings";
import { execute } from "../execution";
import {
	composeRegistries as composeTypedRegistries,
	defineRegistry as defineTypedRegistry,
	forSurface as filterRegistryForSurface,
	resolveOperationSurfaceBinding,
} from "../registry";
import { registerOperationSchema } from "../registry/schema-registry";
import type {
	AnyOperation,
	AnyTypedOperation,
	BindingNamesOf,
	ContextOf,
	DefaultContext,
	ExecutionError,
	ExposedSurfacesOf,
	LifecycleHooks,
	Operation,
	OperationRegistry,
	OperationRegistryWithHooks,
	OutputOf,
} from "./types";

export interface CreateOpsOptions<C extends DefaultContext = DefaultContext> {
	/**
	 * When provided, the returned defineOperation will register each operation's
	 * schema here instead of the default registry. Use with createSchemaRegistry().
	 */
	schemaRegistry?: { register(op: AnyOperation<C>): void };
	/**
	 * Lifecycle hooks for observability (tracing, logging, metrics).
	 * Applied to every ops.execute() call from the returned API.
	 */
	hooks?: LifecycleHooks;
}

type IsUnion<T, TAll = T> = T extends T
	? [TAll] extends [T]
		? false
		: true
	: never;

type IsBindingOptionalForSurface<
	TOperation extends AnyTypedOperation,
	TSurface extends ExposedSurfacesOf<TOperation>,
> =
	"default" extends BindingNamesOf<TOperation, TSurface>
		? true
		: IsUnion<BindingNamesOf<TOperation, TSurface>> extends true
			? false
			: true;

type ExecuteOperationRequestForSurface<
	TOperation extends AnyTypedOperation,
	TSurface extends ExposedSurfacesOf<TOperation>,
> =
	IsBindingOptionalForSurface<TOperation, TSurface> extends true
		? {
				surface: TSurface;
				binding?: BindingNamesOf<TOperation, TSurface> & string;
			}
		: {
				surface: TSurface;
				binding: BindingNamesOf<TOperation, TSurface> & string;
			};

export type ExecuteOperationRequest<TOperation extends AnyTypedOperation> = {
	[TSurface in ExposedSurfacesOf<TOperation>]: ExecuteOperationRequestForSurface<
		TOperation,
		TSurface
	>;
}[ExposedSurfacesOf<TOperation>];

export interface ExecuteUnknownOperationRequest {
	surface: string;
	binding?: string | BindingRef;
}

/**
 * Creates an ops API bound to a context type C.
 */
export function createOps<C extends DefaultContext = DefaultContext>(
	options?: CreateOpsOptions<C>,
) {
	const schemaRegistry = options?.schemaRegistry;
	const hooks = options?.hooks;

	return {
		defineOperation<
			const TName extends string,
			TInputSchema extends ZodType,
			TOutputSchema extends ZodType,
			TError extends string,
			const TExpose extends Partial<
				import("./types").SurfaceConfigMap<
					import("zod").z.infer<TInputSchema>,
					C
				>
			>,
			const TOutputChunkSchema extends ZodType | undefined = undefined,
		>(
			op: Operation<
				TName,
				TInputSchema,
				TOutputSchema,
				TError,
				C,
				TExpose,
				TOutputChunkSchema
			>,
		) {
			assertValidOperationName(op.name);
			assertValidExposeBindingNames(op.expose as Record<string, unknown>);
			if (schemaRegistry) {
				schemaRegistry.register(op as AnyOperation<C>);
			} else {
				registerOperationSchema(op as AnyOperation<DefaultContext>);
			}
			return op;
		},
		defineRegistry<const TOperations extends readonly AnyOperation<C>[]>(
			domain: string,
			operations: TOperations,
		) {
			return defineTypedRegistry(domain, operations);
		},
		composeRegistries<
			const TRegistries extends readonly OperationRegistry<
				C,
				readonly AnyOperation<C>[]
			>[],
		>(registries: TRegistries) {
			return composeTypedRegistries(registries, {
				...(hooks ? { hooks } : {}),
			});
		},
		forSurface<
			TRegistry extends
				| OperationRegistry<C, readonly AnyOperation<C>[]>
				| OperationRegistryWithHooks<C, readonly AnyOperation<C>[]>,
			TSurface extends ExposedSurfacesOf<TRegistry["operations"][number]>,
		>(registry: TRegistry, surface: TSurface) {
			return filterRegistryForSurface(registry, surface);
		},
		async execute<TOperation extends AnyTypedOperation<C>>(
			op: TOperation,
			raw: unknown,
			ctx: ContextOf<TOperation>,
			request: ExecuteOperationRequest<TOperation>,
		): Promise<
			| { ok: true; value: OutputOf<TOperation> }
			| { ok: false; error: ExecutionError }
		> {
			const binding = resolveOperationSurfaceBinding(
				op as AnyOperation,
				request.surface,
				request.binding,
			);
			if (!binding) {
				throw new Error(
					`Operation "${op.name}" is not exposed on the ${request.surface} surface`,
				);
			}
			return execute(
				op as AnyOperation,
				raw,
				ctx,
				request.surface,
				binding.config,
				{
					...(hooks ? { hooks } : {}),
					binding,
				},
			) as Promise<
				| { ok: true; value: OutputOf<TOperation> }
				| { ok: false; error: ExecutionError }
			>;
		},
		async executeUnknown(
			op: AnyOperation<C>,
			raw: unknown,
			ctx: C,
			request: ExecuteUnknownOperationRequest,
		): Promise<
			{ ok: true; value: unknown } | { ok: false; error: ExecutionError }
		> {
			const resolvedBindingName =
				typeof request.binding === "string"
					? request.binding
					: request.binding?.binding;
			if (
				request.binding != null &&
				typeof request.binding !== "string" &&
				request.binding.operation !== op.name
			) {
				throw new Error(
					`Binding ref operation "${request.binding.operation}" does not match operation "${op.name}"`,
				);
			}
			if (
				request.binding != null &&
				typeof request.binding !== "string" &&
				request.binding.surface !== request.surface
			) {
				throw new Error(
					`Binding ref surface "${request.binding.surface}" does not match requested surface "${request.surface}"`,
				);
			}
			const binding = resolveOperationSurfaceBinding(
				op as AnyOperation,
				request.surface as ExposedSurfacesOf<typeof op>,
				resolvedBindingName as BindingNamesOf<
					typeof op,
					ExposedSurfacesOf<typeof op>
				> &
					string,
			);
			if (!binding) {
				throw new Error(
					`Operation "${op.name}" is not exposed on the ${request.surface} surface`,
				);
			}
			return execute(
				op as AnyOperation,
				raw,
				ctx,
				binding.surface,
				binding.config,
				{
					...(hooks ? { hooks } : {}),
					binding,
				},
			);
		},
	};
}
