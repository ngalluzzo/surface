import type { DefaultContext } from "../default-context";
import type { BaseSurfaceConfig } from "./base";

export interface CronSurfaceConfig<TPayload, C extends DefaultContext>
	extends BaseSurfaceConfig<TPayload, C> {
	/** Cron expression or scheduler-specific schedule (e.g. "0 9 * * 1"). */
	schedule: string;
	/** Called at invocation time to produce the value passed to execute(). */
	buildPayload: (ctx: C) => TPayload | Promise<TPayload>;
	/** Optional timeout in ms for the scheduler to enforce. */
	timeout?: number;
}
