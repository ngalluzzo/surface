import type { ZodType, z } from "zod";
import {
	assertValidExposeBindingNames,
	assertValidOperationName,
} from "../bindings";
import { registerOperationSchema } from "../registry/schema-registry";
import type { AnyOperation, DefaultContext, Operation } from "./types";

/**
 * Defines a single operation — the unit of the registry.
 *
 * @see {@link defineRegistry} to group operations into a domain registry
 */
export function defineOperation<
	const TName extends string,
	TSchema extends ZodType,
	TOutputSchema extends ZodType,
	TError extends string,
	C extends DefaultContext = DefaultContext,
	const TExpose extends Partial<
		import("./types").SurfaceConfigMap<z.infer<TSchema>, C>
	> = Partial<import("./types").SurfaceConfigMap<z.infer<TSchema>, C>>,
	const TOutputChunkSchema extends ZodType | undefined = undefined,
>(
	op: Operation<
		TName,
		TSchema,
		TOutputSchema,
		TError,
		C,
		TExpose,
		TOutputChunkSchema
	>,
): Operation<
	TName,
	TSchema,
	TOutputSchema,
	TError,
	C,
	TExpose,
	TOutputChunkSchema
> {
	assertValidOperationName(op.name);
	assertValidExposeBindingNames(op.expose as Record<string, unknown>);
	registerOperationSchema(op as AnyOperation<DefaultContext>);
	return op;
}
