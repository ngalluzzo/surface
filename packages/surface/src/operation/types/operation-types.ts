import type { ZodType, z } from "zod";
import type { Result } from "../../execution/result";
import type { DefaultContext } from "./default-context";
import type { GuardOrPolicy } from "./guards";
import type { Surface, SurfaceConfigMap } from "./surface-config";

export interface OperationMeta<_TPayload> {
	description?: string;
	surfaces: Surface[];
}

export interface Operation<
	TSchema extends ZodType,
	TPayload extends z.infer<TSchema>,
	TOutput,
	TError extends string,
	C extends DefaultContext,
> {
	name: string;
	description?: string;
	version?: number;
	schema: TSchema;
	outputSchema: ZodType;
	/**
	 * When set, the operation is a stream operation: handler returns
	 * Result<AsyncIterable<Chunk>, TError> and surfaces that support streaming
	 * (HTTP, WS) expose the stream; others skip or reject.
	 */
	outputChunkSchema?: ZodType;
	guards?: Array<GuardOrPolicy<TPayload, C>>;
	handler: (payload: TPayload, ctx: C) => Promise<Result<TOutput, TError>>;
	expose: Partial<SurfaceConfigMap<TPayload, C>>;
}

export type AnyOperation<C extends DefaultContext = DefaultContext> = Operation<
	ZodType,
	z.infer<ZodType>,
	unknown,
	string,
	C
>;

export type OperationRegistry<C extends DefaultContext> = Map<
	string,
	AnyOperation<C>
>;
