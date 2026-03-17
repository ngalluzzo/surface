import type { ZodType } from "zod";
import { execute, getHooks } from "../../execution";
import type { IdempotencyStore } from "../../idempotency";
import { executeWithIdempotency } from "../../idempotency";
import type { OperationRegistryWithHooks } from "../../operation";
import {
	getSurfaceBindingLookupKey,
	normalizeSurfaceBindings,
} from "../../operation";
import type { DefaultContext, OperationRegistry } from "../../operation/types";
import type { HttpHandler, HttpRequest } from "./types";

export type { HttpHandler, HttpRequest, HttpResponse } from "./types";

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
		const parsed = op.schema.safeParse(req.body);
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
			const isStreamOp = op.outputChunkSchema != null;
			const key =
				!isStreamOp &&
				useIdempotency &&
				getIdempotencyKey(req, idempotencyHeader, config, op);
			const opts =
				hooks || req.signal || key
					? {
							...(hooks && { hooks }),
							...(req.signal && { signal: req.signal }),
							...(key && { idempotencyKey: key }),
						}
					: undefined;
			const result = await exec(op, req.body, ctx, "http", config, opts);

			if (!result.ok) {
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
	C extends DefaultContext = DefaultContext,
>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
): Record<string, { method: string; path: string }> {
	const httpBindings = normalizeSurfaceBindings(registry, "http");
	const map: Record<string, { method: string; path: string }> = {};
	for (const binding of httpBindings) {
		map[getSurfaceBindingLookupKey(binding)] = {
			method: binding.config.method,
			path: binding.config.path,
		};
	}
	return map;
}
