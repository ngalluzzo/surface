import type { ZodType, z } from "zod";
import type {
	BindingKey,
	BindingNameFromBindingKey,
	BindingRef,
	OperationNameFromBindingKey,
} from "../../bindings";
import type { Result } from "../../execution/result";
import type { DefaultContext } from "./default-context";
import type { LifecycleHooks } from "./execution-types";
import type { GuardOrPolicy } from "./guards";
import type { ExposeSurface, SurfaceConfigMap } from "./surface-config";

type UnionToIntersection<T> = (
	T extends unknown
		? (arg: T) => void
		: never
) extends (arg: infer TResult) => void
	? TResult
	: never;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type OperationSuccessValue<
	TOutputSchema extends ZodType,
	TOutputChunkSchema extends ZodType | undefined,
> = [TOutputChunkSchema] extends [ZodType]
	? AsyncIterable<z.infer<TOutputChunkSchema>>
	: z.infer<TOutputSchema>;

// biome-ignore lint/suspicious/noExplicitAny: AnyOperation intentionally erases schema variance at the registry/runtime boundary.
type ErasedZodType = ZodType<any>;
// biome-ignore lint/suspicious/noExplicitAny: AnyOperation intentionally erases expose variance at the registry/runtime boundary.
type ErasedExpose = any;
// biome-ignore lint/suspicious/noExplicitAny: erased operation boundaries intentionally erase payload/output/context variance.
type ErasedGuard = GuardOrPolicy<any, any>;
// biome-ignore lint/suspicious/noExplicitAny: erased operation boundaries intentionally erase payload/output/context variance.
type ErasedHandler = (payload: any, ctx: any) => Promise<Result<any, string>>;

export interface Operation<
	TName extends string = string,
	TInputSchema extends ZodType = ZodType,
	TOutputSchema extends ZodType = ZodType,
	TError extends string = string,
	C extends DefaultContext = DefaultContext,
	TExpose extends Partial<SurfaceConfigMap<z.infer<TInputSchema>, C>> = Partial<
		SurfaceConfigMap<z.infer<TInputSchema>, C>
	>,
	TOutputChunkSchema extends ZodType | undefined = undefined,
> {
	name: TName;
	description?: string;
	version?: number;
	schema: TInputSchema;
	outputSchema: TOutputSchema;
	/**
	 * When set, the operation is a stream operation: handler returns
	 * Result<AsyncIterable<Chunk>, TError> and surfaces that support streaming
	 * (HTTP, WS) expose the stream; others skip or reject.
	 */
	outputChunkSchema?: TOutputChunkSchema;
	guards?: Array<GuardOrPolicy<z.infer<TInputSchema>, C>>;
	handler: (
		payload: z.infer<TInputSchema>,
		ctx: C,
	) => Promise<
		Result<OperationSuccessValue<TOutputSchema, TOutputChunkSchema>, TError>
	>;
	expose: TExpose;
}

export type AnyOperation<_C extends DefaultContext = DefaultContext> = Omit<
	Operation<
		string,
		ErasedZodType,
		ErasedZodType,
		string,
		DefaultContext,
		ErasedExpose,
		ErasedZodType | undefined
	>,
	"guards" | "handler" | "expose"
> & {
	guards?: Array<ErasedGuard>;
	handler: ErasedHandler;
	expose: ErasedExpose;
};

export type AnyTypedOperation<_C extends DefaultContext = DefaultContext> =
	AnyOperation;

export type InputOf<TOperation> =
	TOperation extends Operation<
		string,
		infer TInputSchema,
		ZodType,
		string,
		infer _C,
		infer _TExpose
	>
		? z.infer<TInputSchema>
		: never;

export type OutputOf<TOperation> =
	TOperation extends Operation<
		string,
		ZodType,
		infer TOutputSchema,
		string,
		infer _C,
		infer _TExpose,
		infer TOutputChunkSchema
	>
		? OperationSuccessValue<
				Extract<TOutputSchema, ZodType>,
				Extract<TOutputChunkSchema, ZodType | undefined>
			>
		: never;

export type OutputChunkSchemaOf<TOperation> =
	TOperation extends Operation<
		string,
		ZodType,
		ZodType,
		string,
		infer _C,
		infer _TExpose,
		infer TOutputChunkSchema
	>
		? TOutputChunkSchema
		: never;

export type IsStreamingOperation<TOperation> = [
	Extract<OutputChunkSchemaOf<TOperation>, ZodType | undefined>,
] extends [ZodType]
	? true
	: false;

export type ErrorOf<TOperation> =
	TOperation extends Operation<
		string,
		ZodType,
		ZodType,
		infer TError,
		infer _C,
		infer _TExpose,
		infer _TOutputChunkSchema
	>
		? TError
		: never;

export type ContextOf<TOperation> =
	TOperation extends Operation<
		string,
		ZodType,
		ZodType,
		string,
		infer C,
		infer _TExpose,
		infer _TOutputChunkSchema
	>
		? C
		: never;

export type OperationNameOf<TOperation> =
	TOperation extends Operation<
		infer TName,
		ZodType,
		ZodType,
		string,
		infer _C,
		infer _TExpose,
		infer _TOutputChunkSchema
	>
		? TName
		: never;

export type ExposeOf<TOperation> =
	TOperation extends Operation<
		string,
		ZodType,
		ZodType,
		string,
		infer _C,
		infer TExpose,
		infer _TOutputChunkSchema
	>
		? TExpose
		: never;

export type ExposedSurfacesOf<TOperation> = Extract<
	keyof ExposeOf<TOperation>,
	ExposeSurface
>;

export type BindingNamesOf<
	TOperation,
	TSurface extends ExposedSurfacesOf<TOperation>,
> = Extract<keyof Exclude<ExposeOf<TOperation>[TSurface], undefined>, string>;

export type SurfaceConfigOf<
	TOperation,
	TSurface extends ExposedSurfacesOf<TOperation>,
	TBinding extends BindingNamesOf<TOperation, TSurface>,
> = Exclude<ExposeOf<TOperation>[TSurface], undefined>[TBinding];

export type BindingKeyOfOperation<
	TOperation,
	TSurface extends ExposedSurfacesOf<TOperation>,
> =
	BindingNamesOf<TOperation, TSurface> extends infer TBinding
		? TBinding extends string
			? BindingKey<OperationNameOf<TOperation>, TBinding>
			: never
		: never;

export type RegistryOperationMap<
	TOperations extends readonly AnyOperation[] = readonly AnyOperation[],
> = Map<OperationNameOf<TOperations[number]>, TOperations[number]>;

export interface RegistryDefinition<
	TOperations extends readonly AnyOperation[] = readonly AnyOperation[],
> extends Iterable<
		[OperationNameOf<TOperations[number]>, TOperations[number]]
	> {
	domain: string;
	operations: TOperations;
	map: RegistryOperationMap<TOperations>;
	readonly size: number;
	get<TName extends OperationNameOf<TOperations[number]>>(
		name: TName,
	): Extract<TOperations[number], { name: TName }> | undefined;
	has(name: string): name is OperationNameOf<TOperations[number]>;
}

export interface RootRegistryDefinition<
	TOperations extends readonly AnyOperation[] = readonly AnyOperation[],
> extends RegistryDefinition<TOperations> {
	hooks?: LifecycleHooks;
}

export type OperationRegistry<
	_C extends DefaultContext = DefaultContext,
	TOperations extends readonly AnyOperation[] = readonly AnyOperation[],
> = RegistryDefinition<TOperations>;

export type OperationRegistryWithHooks<
	_C extends DefaultContext = DefaultContext,
	TOperations extends readonly AnyOperation[] = readonly AnyOperation[],
> = RootRegistryDefinition<TOperations>;

export type AnyRegistry<C extends DefaultContext = DefaultContext> =
	| OperationRegistry<C, readonly AnyOperation[]>
	| OperationRegistryWithHooks<C, readonly AnyOperation[]>;

export type OperationsOf<TRegistry> =
	TRegistry extends RegistryDefinition<infer TOperations>
		? TOperations
		: TRegistry extends RootRegistryDefinition<infer TOperations>
			? TOperations
			: never;

export type NonStreamingOperationsOf<TRegistry> =
	OperationsOf<TRegistry>[number] extends infer TOperation
		? TOperation extends AnyOperation
			? IsStreamingOperation<TOperation> extends true
				? never
				: TOperation
			: never
		: never;

export type OperationByName<
	TRegistry,
	TName extends OperationNameOf<OperationsOf<TRegistry>[number]>,
> = Extract<OperationsOf<TRegistry>[number], { name: TName }>;

export type RegistryContractOf<TRegistry> = {
	[K in OperationNameOf<OperationsOf<TRegistry>[number]>]: {
		input: InputOf<OperationByName<TRegistry, K>>;
		output: OutputOf<OperationByName<TRegistry, K>>;
	};
};

type SurfaceBindingRecordEntry<
	TRegistry,
	TSurface extends ExposeSurface,
	TBindingKey extends string,
> = {
	key: TBindingKey;
	ref: BindingRef<
		TSurface,
		OperationNameFromBindingKey<TBindingKey>,
		BindingNameFromBindingKey<TBindingKey>
	>;
	input: InputOf<
		OperationByName<
			TRegistry,
			Extract<
				OperationNameFromBindingKey<TBindingKey>,
				OperationNameOf<OperationsOf<TRegistry>[number]>
			>
		>
	>;
	output: OutputOf<
		OperationByName<
			TRegistry,
			Extract<
				OperationNameFromBindingKey<TBindingKey>,
				OperationNameOf<OperationsOf<TRegistry>[number]>
			>
		>
	>;
};

export type SurfaceBindingKeysOf<
	TRegistry,
	TSurface extends ExposeSurface,
> = OperationsOf<TRegistry>[number] extends infer TOperation
	? TOperation extends AnyOperation
		? TSurface extends ExposedSurfacesOf<TOperation>
			? BindingKeyOfOperation<TOperation, TSurface>
			: never
		: never
	: never;

export type NonStreamingSurfaceBindingKeysOf<
	TRegistry,
	TSurface extends ExposeSurface,
> =
	NonStreamingOperationsOf<TRegistry> extends infer TOperation
		? TOperation extends AnyOperation
			? TSurface extends ExposedSurfacesOf<TOperation>
				? BindingKeyOfOperation<TOperation, TSurface>
				: never
			: never
		: never;

export type SurfaceBindingsOf<
	TRegistry,
	TSurface extends ExposeSurface,
> = Simplify<
	UnionToIntersection<
		SurfaceBindingKeysOf<TRegistry, TSurface> extends infer TBindingKey
			? TBindingKey extends string
				? {
						[K in TBindingKey]: SurfaceBindingRecordEntry<
							TRegistry,
							TSurface,
							K
						>;
					}
				: never
			: never
	>
>;

export interface OperationMeta<TOperation extends AnyOperation = AnyOperation> {
	description?: string;
	surfaces: ExposedSurfacesOf<TOperation>[];
}
