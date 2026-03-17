import { execute, getHooks } from "../../execution";
import type { IdempotencyStore } from "../../idempotency";
import { executeWithIdempotency } from "../../idempotency";
import type { OperationRegistryWithHooks } from "../../operation";
import { forSurface } from "../../operation";
import type { DefaultContext, OperationRegistry } from "../../operation/types";
import { parseRaw } from "../shared/parse-raw";
import type { WebhookHandler } from "./types";

export type { WebhookHandler, WebhookRequest, WebhookResponse } from "./types";

export interface BuildWebhookHandlersOptions<
	_C extends DefaultContext = DefaultContext,
> {
	idempotencyStore?: IdempotencyStore;
	idempotencyTtlMs?: number;
}

export function buildWebhookHandlers<C extends DefaultContext = DefaultContext>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	ctx: C,
	options?: BuildWebhookHandlersOptions<C>,
): Map<string, WebhookHandler<C>> {
	const handlers = new Map<string, WebhookHandler<C>>();
	const webhookOps = forSurface(registry, "webhook");
	const hooks = getHooks(webhookOps);
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

	const byProvider = new Map<string, typeof webhookOps>();
	for (const [name, op] of webhookOps) {
		if (op.outputChunkSchema != null) continue;
		const provider = op.expose.webhook?.provider;
		if (!provider) throw new Error(`Missing provider for ${op.name}`);
		if (!byProvider.has(provider)) byProvider.set(provider, new Map());
		byProvider.get(provider)?.set(name, op);
	}

	for (const [provider, ops] of byProvider) {
		const route = `POST /webhooks/${provider}`;

		handlers.set(route, async (req) => {
			const byEvent = new Map(
				[...ops.values()].map((op) => [op.expose.webhook?.event, op]),
			);

			const op = byEvent.get(req.eventType);

			if (!op) {
				return { status: 200, body: { received: true, ignored: true } };
			}

			const config = op.expose.webhook;
			if (!config)
				return { status: 200, body: { received: true, ignored: true } };
			const parsed = parseRaw(req.body, config.parsePayload);

			const key =
				useIdempotency &&
				config.idempotencyKey &&
				(() => {
					const p = op.schema.safeParse(parsed);
					return p.success && p.data !== undefined
						? config.idempotencyKey?.(p.data)
						: undefined;
				})();
			const opts =
				hooks || key
					? { ...(hooks && { hooks }), ...(key && { idempotencyKey: key }) }
					: undefined;
			const result = await exec(op, parsed, ctx, "webhook", opts);

			if (!result.ok) {
				console.error(`[webhook] operation ${op.name} failed:`, result.error);
				return { status: 200, body: { received: true, operation: op.name } };
			}

			return { status: 200, body: { received: true, operation: op.name } };
		});
	}

	return handlers;
}
