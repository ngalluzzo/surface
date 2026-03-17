import type { DefaultContext } from "../default-context";
import type { BaseSurfaceConfig } from "./base";
import type { EventPayloadBinding } from "./bind";

export interface EventSurfaceConfig<TPayload, C extends DefaultContext>
	extends BaseSurfaceConfig<TPayload, C> {
	/** Transport identifier for routing/telemetry (e.g. "sqs" | "kafka" | "eventbridge"). */
	source: string;
	/** Queue name, topic, or event pattern. */
	topic: string;
	/** Transforms the broker's raw message into the value passed to op.schema.parse(...). */
	parsePayload?: (raw: unknown) => unknown;
	bind?: EventPayloadBinding;
	/**
	 * When set, the event adapter uses this to dedupe processing:
	 * same key within TTL ⇒ return cached result instead of re-running the handler.
	 */
	idempotencyKey?: (payload: TPayload, ctx: C) => string;
}
