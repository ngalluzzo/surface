import { execute, getHooks } from "../../execution";
import type { IdempotencyStore } from "../../idempotency";
import { executeWithIdempotency } from "../../idempotency";
import type { OperationRegistryWithHooks } from "../../operation";
import { normalizeSurfaceBindings } from "../../operation";
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
	const webhookBindings = normalizeSurfaceBindings(registry, "webhook");
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

	const byProvider = new Map<string, typeof webhookBindings>();
	for (const binding of webhookBindings) {
		if (binding.op.outputChunkSchema != null) continue;
		const provider = binding.config.provider;
		if (!byProvider.has(provider)) byProvider.set(provider, []);
		byProvider.get(provider)?.push(binding);
	}

	for (const [provider, bindings] of byProvider) {
		const route = `POST /webhooks/${provider}`;

		handlers.set(route, async (req) => {
			const byEvent = new Map(
				bindings.map((binding) => [binding.config.event, binding]),
			);

			const binding = byEvent.get(req.eventType);

			if (!binding) {
				return { status: 200, body: { received: true, ignored: true } };
			}

			const { op, config } = binding;
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
			const result = await exec(
				op,
				parsed,
				ctx,
				"webhook",
				config,
				opts,
			);

			if (!result.ok) {
				console.error(`[webhook] operation ${op.name} failed:`, result.error);
				return { status: 200, body: { received: true, operation: op.name } };
			}

			return { status: 200, body: { received: true, operation: op.name } };
		});
	}

	return handlers;
}
