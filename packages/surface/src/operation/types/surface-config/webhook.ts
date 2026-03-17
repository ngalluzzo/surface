import type { DefaultContext } from "../default-context";
import type { BaseSurfaceConfig } from "./base";

export interface WebhookSurfaceConfig<TPayload, C extends DefaultContext>
	extends BaseSurfaceConfig<TPayload, C> {
	provider: string;
	event: string;
	/** Optional: transform raw body (or full request) into the value passed to execute(); defaults to identity. */
	parsePayload?: (raw: unknown) => unknown;
	/**
	 * When set with a store, duplicate deliveries (same key within TTL) return cached result
	 * without re-running the handler. E.g. use provider event id or derive from payload.
	 */
	idempotencyKey?: (payload: TPayload) => string;
}
