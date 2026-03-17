import type { DefaultContext } from "../default-context";
import type { GuardOverride } from "../guards";

export interface BaseSurfaceConfig<TPayload, C extends DefaultContext> {
	guards?: GuardOverride<TPayload, C>;
	/**
	 * Timeout in milliseconds for this surface. When set, execute() enforces it
	 * and passes an AbortSignal on context so handlers can cancel long-running work.
	 * Omitted = no limit (e.g. CLI).
	 */
	timeout?: number;
}
