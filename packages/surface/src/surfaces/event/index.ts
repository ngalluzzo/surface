import { execute, getHooks } from "../../execution";
import type { IdempotencyStore } from "../../idempotency";
import { executeWithIdempotency } from "../../idempotency";
import type { OperationRegistryWithHooks } from "../../operation";
import { forSurface } from "../../operation";
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
	const eventOps = forSurface(registry, "event");
	const hooks = getHooks(eventOps);
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

	for (const [, op] of eventOps) {
		if (op.outputChunkSchema != null) continue;
		const config = op.expose.event;
		if (!config) throw new Error(`Missing event config for ${op.name}`);

		const definition: EventConsumerDefinition = {
			name: op.name,
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
 * Builds an eventMap (topic + optional source per operation) from a registry for use with createEventClient.
 * Only includes operations exposed on the event surface.
 */
export function buildEventMapFromRegistry<
	C extends DefaultContext = DefaultContext,
>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
): Record<string, { topic: string; source?: string }> {
	const eventOps = forSurface(registry, "event");
	const map: Record<string, { topic: string; source?: string }> = {};
	for (const [, op] of eventOps) {
		const config = op.expose.event;
		if (!config) continue;
		map[op.name] = {
			topic: config.topic,
			...(config.source && { source: config.source }),
		};
	}
	return map;
}
