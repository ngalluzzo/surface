import { execute, getHooks } from "../../execution";
import type { OperationRegistryWithHooks } from "../../operation";
import {
	getSurfaceBindingLookupKey,
	normalizeSurfaceBindings,
} from "../../operation";
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
	const cronBindings = normalizeSurfaceBindings(registry, "cron");
	const hooks = "hooks" in registry ? getHooks(registry) : undefined;

	for (const binding of cronBindings) {
		const { op, config } = binding;
		if (op.outputChunkSchema != null) continue;

		const definition: CronDefinitionLike = {
			name: getSurfaceBindingLookupKey(binding),
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
					{
						...(hooks ? { hooks } : {}),
						binding,
					},
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
