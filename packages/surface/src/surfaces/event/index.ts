import type { EventBindingsFromRegistry } from "../../event-client";
import { execute, getHooks } from "../../execution";
import type { IdempotencyStore } from "../../idempotency";
import { executeWithIdempotency } from "../../idempotency";
import type { OperationRegistryWithHooks } from "../../operation";
import {
	getSurfaceBindingLookupKey,
	normalizeSurfaceBindings,
} from "../../operation";
import type { DefaultContext, OperationRegistry } from "../../operation/types";
import { parseRaw } from "../shared/parse-raw";
import { resolveBoundPayload } from "../shared/resolve-bound-payload";
import type { EventConsumerDefinition, EventTransportLike } from "./types";
import { NonRetryableError } from "./types";

export type { EventConsumerDefinition, EventTransportLike } from "./types";
export { NonRetryableError } from "./types";

const EVENT_BINDING_SOURCE_ORDER = ["payload", "raw", "meta"] as const;

export interface RegisterEventConsumersOptions<
	_C extends DefaultContext = DefaultContext,
> {
	idempotencyStore?: IdempotencyStore;
	idempotencyTtlMs?: number;
}

export function registerEventConsumers<
	C extends DefaultContext = DefaultContext,
>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	transport: EventTransportLike,
	ctx: C,
	options?: RegisterEventConsumersOptions<C>,
): void {
	const eventBindings = normalizeSurfaceBindings(registry, "event");
	const hooks = "hooks" in registry ? getHooks(registry) : undefined;
	const idempotencyStore = options?.idempotencyStore;
	const idempotencyTtlMs = options?.idempotencyTtlMs;
	const useIdempotency =
		idempotencyStore != null &&
		idempotencyTtlMs != null &&
		idempotencyTtlMs > 0;
	const exec =
		useIdempotency && idempotencyStore != null && idempotencyTtlMs != null
			? executeWithIdempotency(idempotencyStore, idempotencyTtlMs)
			: execute;

	for (const binding of eventBindings) {
		const { op, config } = binding;
		if (op.outputChunkSchema != null) continue;
		const parsePayload = (raw: unknown) => parseRaw(raw, config.parsePayload);
		const resolvePayload = (raw: unknown) => {
			const initialPayload = parsePayload(raw);
			return resolveBoundPayload({
				bind: config.bind,
				sources: {
					payload: initialPayload,
					raw,
					meta: {
						source: config.source,
						topic: config.topic,
					},
				},
				sourceOrder: EVENT_BINDING_SOURCE_ORDER,
				primarySources: ["payload", "raw"],
				initialPayload,
			});
		};

		const definition: EventConsumerDefinition = {
			name: getSurfaceBindingLookupKey(binding),
			topic: config.topic,
			source: config.source,
			parsePayload,

			handler: async (raw) => {
				const parsed = resolvePayload(raw);
				const key =
					useIdempotency &&
					config.idempotencyKey &&
					(() => {
						const p = op.schema.safeParse(parsed);
						return p.success && p.data !== undefined
							? config.idempotencyKey?.(p.data, ctx)
							: undefined;
					})();
				const opts =
					hooks || key
						? {
								...(hooks && { hooks }),
								...(key && { idempotencyKey: key }),
								binding,
							}
						: { binding };
				const result = await exec(op, parsed, ctx, "event", config, opts);

				if (result.ok === false) {
					const { error } = result;
					switch (error.phase) {
						case "surface-guard":
						case "domain-guard":
							throw new NonRetryableError(`Guard failed [${error.code}]`);

						case "validation":
							throw new NonRetryableError(
								`Invalid event payload: ${JSON.stringify(error.issues)}`,
							);

						case "handler":
							if ("error" in error) {
								throw new Error(`Handler failed: ${error.error}`);
							}
							throw new Error("Handler output validation failed");
					}
				}
			},
		};

		transport.register(definition);
	}
}

/**
 * Builds an eventMap (topic + optional source per binding) from a registry for use with createEventClient.
 * Default bindings use the operation name; additional bindings use binding-aware keys.
 */
export function buildEventMapFromRegistry<
	TRegistry extends OperationRegistry | OperationRegistryWithHooks,
>(
	registry: TRegistry,
): {
	[K in keyof EventBindingsFromRegistry<TRegistry>]: {
		topic: string;
		source?: string;
	};
} {
	const map: Record<string, { topic: string; source?: string }> = {};
	const bindings = buildEventBindingsFromRegistry(registry);
	for (const key of Object.keys(bindings) as Array<
		keyof EventBindingsFromRegistry<TRegistry> & string
	>) {
		const binding = bindings[key];
		map[key] = {
			topic: binding.topic,
			...(binding.source && { source: binding.source }),
		};
	}
	return map;
}

export function buildEventBindingsFromRegistry<
	TRegistry extends OperationRegistry | OperationRegistryWithHooks,
>(registry: TRegistry): EventBindingsFromRegistry<TRegistry> {
	const eventBindings = normalizeSurfaceBindings(registry, "event").filter(
		(binding) => binding.op.outputChunkSchema == null,
	);
	const map: Record<
		string,
		{
			key: string;
			ref: unknown;
			topic: string;
			source?: string;
		}
	> = {};
	for (const binding of eventBindings) {
		map[getSurfaceBindingLookupKey(binding)] = {
			key: binding.key,
			ref: binding.ref,
			topic: binding.config.topic,
			...(binding.config.source && { source: binding.config.source }),
		};
	}
	return map as EventBindingsFromRegistry<TRegistry>;
}
