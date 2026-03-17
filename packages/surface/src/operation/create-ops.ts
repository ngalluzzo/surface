import type { ZodType, z } from "zod";
import type { BindingRef } from "../bindings";
import { execute } from "../execution";
import {
	composeRegistries,
	defineRegistry,
	forSurface,
	resolveOperationSurfaceBinding,
} from "../registry";
import { registerOperationSchema } from "../registry/schema-registry";
import type {
	AnyOperation,
	DefaultContext,
	ExecutionError,
	ExposeSurface,
	LifecycleHooks,
	Operation,
	OperationRegistry,
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

/**
 * Creates an ops API bound to a context type C.
 */
export function createOps<C extends DefaultContext = DefaultContext>(
	options?: CreateOpsOptions<C>,
): {
	defineOperation: <TSchema extends ZodType, TOutput, TError extends string>(
		op: Operation<TSchema, z.infer<TSchema>, TOutput, TError, C>,
	) => Operation<TSchema, z.infer<TSchema>, TOutput, TError, C>;
	defineRegistry: (
		domain: string,
		operations: AnyOperation<C>[],
	) => OperationRegistry<C>;
	composeRegistries: (
		registries: OperationRegistry<C>[],
	) => OperationRegistry<C>;
	forSurface: (
		registry: OperationRegistry<C>,
		surface: ExposeSurface,
	) => OperationRegistry<C>;
		execute: (
			op: AnyOperation<C>,
			raw: unknown,
			ctx: C,
			surface: ExposeSurface,
			bindingName?: string | BindingRef,
		) => Promise<
			{ ok: true; value: unknown } | { ok: false; error: ExecutionError }
		>;
} {
	const schemaRegistry = options?.schemaRegistry;
	const hooks = options?.hooks;

	return {
		defineOperation<TSchema extends ZodType, TOutput, TError extends string>(
			op: Operation<TSchema, z.infer<TSchema>, TOutput, TError, C>,
		): Operation<TSchema, z.infer<TSchema>, TOutput, TError, C> {
			if (schemaRegistry) {
				schemaRegistry.register(op as AnyOperation<C>);
			} else {
				registerOperationSchema(op as AnyOperation<DefaultContext>);
			}
			return op;
		},
		defineRegistry(
			domain: string,
			operations: AnyOperation<C>[],
		): OperationRegistry<C> {
			return defineRegistry<C>(domain, operations);
		},
		composeRegistries(
			registries: OperationRegistry<C>[],
		): OperationRegistry<C> {
			return composeRegistries<C>(registries);
		},
		forSurface(
			registry: OperationRegistry<C>,
			surface: ExposeSurface,
		): OperationRegistry<C> {
			return forSurface<C>(registry, surface);
		},
		execute(op, raw, ctx, surface, bindingName) {
			const resolvedBindingName =
				typeof bindingName === "string"
					? bindingName
					: bindingName?.binding;
			if (
				bindingName != null &&
				typeof bindingName !== "string" &&
				bindingName.operation !== op.name
			) {
				throw new Error(
					`Binding ref operation "${bindingName.operation}" does not match operation "${op.name}"`,
				);
			}
			const binding = resolveOperationSurfaceBinding(
				op,
				surface,
				resolvedBindingName,
			);
			if (!binding) {
				throw new Error(
					`Operation "${op.name}" is not exposed on the ${surface} surface`,
				);
			}
			return execute(
				op,
				raw,
				ctx,
				surface,
				binding.config,
				{
					...(hooks ? { hooks } : {}),
					binding,
				},
			);
		},
	};
}
