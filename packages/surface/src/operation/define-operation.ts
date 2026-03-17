import type { ZodType, z } from "zod";
import { registerOperationSchema } from "../registry/schema-registry";
import type { AnyOperation, DefaultContext, Operation } from "./types";

/**
 * Defines a single operation — the unit of the registry.
 *
 * @see {@link defineRegistry} to group operations into a domain registry
 */
export function defineOperation<
	TSchema extends ZodType,
	TOutput,
	TError extends string,
	C extends DefaultContext = DefaultContext,
>(
	op: Operation<TSchema, z.infer<TSchema>, TOutput, TError, C>,
): Operation<TSchema, z.infer<TSchema>, TOutput, TError, C> {
	registerOperationSchema(op as AnyOperation<DefaultContext>);
	return op;
}
