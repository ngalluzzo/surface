import type { ZodType } from "zod";
import type { HttpBindingsFromRegistry } from "../../client";
import { execute, getHooks } from "../../execution";
import type { IdempotencyStore } from "../../idempotency";
import { executeWithIdempotency } from "../../idempotency";
import type { OperationRegistryWithHooks } from "../../operation";
import {
	getSurfaceBindingLookupKey,
	normalizeSurfaceBindings,
} from "../../operation";
import type { DefaultContext, OperationRegistry } from "../../operation/types";
import {
	assertNoBindingValidationIssues,
	createDuplicateTargetBindingValidationSpec,
	registerBindingValidationSpecs,
	validateBindingSpecs,
} from "../../registry/binding-validation-core";
import { resolveBoundPayload } from "../shared/resolve-bound-payload";
import type { HttpHandler, HttpRequest } from "./types";

export type { HttpHandler, HttpRequest, HttpResponse } from "./types";

export const httpBindingValidationSpecs = [
	createDuplicateTargetBindingValidationSpec({
		surface: "http",
		targetKind: "route",
		select: (binding) => `${binding.config.method} ${binding.config.path}`,
	}),
] as const;

registerBindingValidationSpecs(httpBindingValidationSpecs);

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
	return (
		value != null &&
		typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] ===
			"function"
	);
}

/**
 * Creates a ReadableStream that yields NDJSON lines from an AsyncIterable.
 * Optionally validates each chunk with outputChunkSchema; invalid chunks cause the stream to error.
 */
function createNdjsonStream(
	iterable: AsyncIterable<unknown>,
	chunkSchema: ZodType | undefined,
	signal?: AbortSignal,
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				for await (const chunk of iterable) {
					if (signal?.aborted) break;
					const validated =
						chunkSchema != null
							? chunkSchema.safeParse(chunk)
							: { success: true as const, data: chunk };
					if (!validated.success) {
						controller.error(
							new Error(
								`Stream chunk validation failed: ${JSON.stringify(validated.error.issues)}`,
							),
						);
						return;
					}
					controller.enqueue(
						encoder.encode(`${JSON.stringify(validated.data)}\n`),
					);
				}
				controller.close();
			} catch (err) {
				controller.error(err);
			}
		},
		cancel() {
			// Consumer cancelled; iterator may be left dangling depending on impl.
		},
	});
}

const DEFAULT_STATUS: Record<string, number> = {
	"surface-guard": 401,
	validation: 400,
	"domain-guard": 422,
	handler: 422,
	timeout: 504,
	aborted: 499,
};

const DEFAULT_IDEMPOTENCY_HEADER = "idempotency-key";
const HTTP_BINDING_SOURCE_ORDER = ["body", "path", "query", "headers"] as const;

export interface BuildHttpHandlersOptions<
	_C extends DefaultContext = DefaultContext,
> {
	/** When set with idempotencyTtlMs, duplicate requests with the same key return cached response (Stripe-style). */
	idempotencyStore?: IdempotencyStore;
	idempotencyTtlMs?: number;
	/** Header name to read idempotency key from when req.idempotencyKey is not set. Default "idempotency-key". */
	idempotencyKeyHeader?: string;
}

function getIdempotencyKey(
	req: HttpRequest,
	headerName: string,
	config: { idempotencyKey?: (payload: unknown) => string },
	payload: unknown,
	op: {
		schema: {
			safeParse: (raw: unknown) => { success: boolean; data?: unknown };
		};
	},
): string | undefined {
	if (req.idempotencyKey) return req.idempotencyKey;
	const header = req.headers[headerName];
	const fromHeader =
		typeof header === "string"
			? header
			: Array.isArray(header)
				? header[0]
				: undefined;
	if (fromHeader) return fromHeader;
	if (config.idempotencyKey) {
		const parsed = op.schema.safeParse(payload);
		if (parsed.success && parsed.data !== undefined)
			return config.idempotencyKey(parsed.data);
	}
	return undefined;
}

export function buildHttpHandlers<C extends DefaultContext = DefaultContext>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	ctx: C,
	options?: BuildHttpHandlersOptions<C>,
): Map<string, HttpHandler<C>> {
	const handlers = new Map<string, HttpHandler<C>>();
	const httpBindings = normalizeSurfaceBindings(registry, "http");
	assertNoBindingValidationIssues(
		validateBindingSpecs(httpBindings, [...httpBindingValidationSpecs]),
	);
	const hooks = "hooks" in registry ? getHooks(registry) : undefined;
	const idempotencyStore = options?.idempotencyStore;
	const idempotencyTtlMs = options?.idempotencyTtlMs;
	const useIdempotency =
		idempotencyStore != null &&
		idempotencyTtlMs != null &&
		idempotencyTtlMs > 0;
	const idempotencyHeader =
		options?.idempotencyKeyHeader ?? DEFAULT_IDEMPOTENCY_HEADER;
	const exec =
		useIdempotency && idempotencyStore != null && idempotencyTtlMs != null
			? executeWithIdempotency(idempotencyStore, idempotencyTtlMs)
			: execute;

	for (const binding of httpBindings) {
		const { op, config } = binding;
		const route = `${config.method} ${config.path}`;

		handlers.set(route, async (req) => {
			const payload = resolveBoundPayload({
				bind: config.bind,
				sources: {
					body: req.body,
					path: req.params ?? {},
					query: req.query ?? {},
					headers: req.headers,
				},
				sourceOrder: HTTP_BINDING_SOURCE_ORDER,
				primarySources: ["body"],
				initialPayload: req.body,
			});
			const isStreamOp = op.outputChunkSchema != null;
			const key =
				!isStreamOp &&
				useIdempotency &&
				getIdempotencyKey(req, idempotencyHeader, config, payload, op);
			const opts =
				hooks || req.signal || key
					? {
							...(hooks && { hooks }),
							...(req.signal && { signal: req.signal }),
							...(key && { idempotencyKey: key }),
							binding,
						}
					: { binding };
			const result = await exec(op, payload, ctx, "http", config, opts);

			if (result.ok === false) {
				const { error } = result;
				const status =
					config.errorStatus?.[error.phase] ??
					DEFAULT_STATUS[error.phase] ??
					500;

				return { status, body: error };
			}

			if (op.outputChunkSchema != null && isAsyncIterable(result.value)) {
				return {
					status: 200,
					body: createNdjsonStream(
						result.value,
						op.outputChunkSchema,
						req.signal,
					),
				};
			}

			return { status: 200, body: result.value };
		});
	}

	return handlers;
}

/**
 * Builds an httpMap (method + path per binding) from a registry for use with createClient.
 * Default bindings use the operation name; additional bindings use binding-aware keys.
 */
export function buildHttpMapFromRegistry<
	TRegistry extends OperationRegistry | OperationRegistryWithHooks,
>(
	registry: TRegistry,
): {
	[K in keyof HttpBindingsFromRegistry<TRegistry>]: {
		method: string;
		path: string;
	};
} {
	const map: Record<string, { method: string; path: string }> = {};
	const bindings = buildHttpBindingsFromRegistry(registry);
	for (const key of Object.keys(bindings) as Array<
		keyof HttpBindingsFromRegistry<TRegistry> & string
	>) {
		const binding = bindings[key];
		map[key] = { method: binding.method, path: binding.path };
	}
	return map;
}

export function buildHttpBindingsFromRegistry<
	TRegistry extends OperationRegistry | OperationRegistryWithHooks,
>(registry: TRegistry): HttpBindingsFromRegistry<TRegistry> {
	const httpBindings = normalizeSurfaceBindings(registry, "http").filter(
		(binding) => binding.op.outputChunkSchema == null,
	);
	assertNoBindingValidationIssues(
		validateBindingSpecs(httpBindings, [...httpBindingValidationSpecs]),
	);
	const map: Record<
		string,
		{ key: string; ref: unknown; method: string; path: string }
	> = {};
	for (const binding of httpBindings) {
		map[getSurfaceBindingLookupKey(binding)] = {
			key: binding.key,
			ref: binding.ref,
			method: binding.config.method,
			path: binding.config.path,
		};
	}
	return map as HttpBindingsFromRegistry<TRegistry>;
}
