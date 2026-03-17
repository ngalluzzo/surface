import { execute, getHooks } from "../../execution";
import type { OperationRegistryWithHooks } from "../../operation";
import { forSurface } from "../../operation";
import type { DefaultContext, OperationRegistry } from "../../operation/types";
import type { CronDefinitionLike, CronSchedulerLike } from "./types";
import { NonRetryableError } from "./types";

export type {
	CronDefinitionLike,
	CronDefinitionOptions,
	CronSchedulerLike,
} from "./types";
export { NonRetryableError } from "./types";

export function registerCronOperations<
	C extends DefaultContext = DefaultContext,
>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	scheduler: CronSchedulerLike,
	ctx: C,
): void {
	const cronOps = forSurface(registry, "cron");
	const hooks = getHooks(cronOps);

	for (const [, op] of cronOps) {
		if (op.outputChunkSchema != null) continue;
		const config = op.expose.cron;
		if (!config) throw new Error(`Missing cron config for ${op.name}`);

		const definition: CronDefinitionLike = {
			name: op.name,
			schedule: config.schedule,
			...(config.timeout !== undefined && {
				options: { timeout: config.timeout },
			}),
			handler: async () => {
				const payload = await config.buildPayload(ctx);
				const result = await execute(
					op,
					payload,
					ctx,
					"cron",
					config,
					hooks ? { hooks } : undefined,
				);

				if (!result.ok) {
					const { error } = result;
					switch (error.phase) {
						case "surface-guard":
						case "domain-guard":
							throw new NonRetryableError(`Guard failed [${error.code}]`);

						case "validation":
							throw new NonRetryableError(
								`Invalid cron payload: ${JSON.stringify(error.issues)}`,
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

		scheduler.register(definition);
	}
}
