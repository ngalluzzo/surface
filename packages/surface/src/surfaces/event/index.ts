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
import type { EventConsumerDefinition, EventTransportLike } from "./types";
import { NonRetryableError } from "./types";

export type { EventConsumerDefinition, EventTransportLike } from "./types";
export { NonRetryableError } from "./types";

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

		const definition: EventConsumerDefinition = {
			name: getSurfaceBindingLookupKey(binding),
			topic: config.topic,
			source: config.source,
			parsePayload: config.parsePayload,

			handler: async (raw) => {
				const parsed = parseRaw(raw, config.parsePayload);
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
						? { ...(hooks && { hooks }), ...(key && { idempotencyKey: key }) }
						: undefined;
				const result = await exec(op, parsed, ctx, "event", config, opts);

				if (!result.ok) {
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
	C extends DefaultContext = DefaultContext,
>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
): Record<string, { topic: string; source?: string }> {
	const eventBindings = normalizeSurfaceBindings(registry, "event");
	const map: Record<string, { topic: string; source?: string }> = {};
	for (const binding of eventBindings) {
		map[getSurfaceBindingLookupKey(binding)] = {
			topic: binding.config.topic,
			...(binding.config.source && { source: binding.config.source }),
		};
	}
	return map;
}
