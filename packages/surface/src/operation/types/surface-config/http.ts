import type { DefaultContext } from "../default-context";
import type { BaseSurfaceConfig } from "./base";
import type { HttpPayloadBinding } from "./bind";

export interface HttpSurfaceConfig<TPayload, C extends DefaultContext>
	extends BaseSurfaceConfig<TPayload, C> {
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	path: string;
	bind?: HttpPayloadBinding;
	errorStatus?: Partial<Record<string, number>>;
	/**
	 * Fallback when the client does not send an Idempotency-Key header.
	 * When present, adapter can derive key from parsed body for response caching.
	 */
	idempotencyKey?: (payload: TPayload) => string;
}
