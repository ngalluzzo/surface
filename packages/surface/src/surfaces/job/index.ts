import { execute, getHooks } from "../../execution";
import type { OperationRegistryWithHooks } from "../../operation";
import { forSurface } from "../../operation";
import type { DefaultContext, OperationRegistry } from "../../operation/types";
import type { JobDefinitionLike, JobRunnerLike } from "./types";
import { NonRetryableError } from "./types";

export type {
	JobDefinitionLike,
	JobDefinitionOptions,
	JobRunnerLike,
} from "./types";
export { NonRetryableError } from "./types";

export function registerJobOperations<
	C extends DefaultContext = DefaultContext,
>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	runner: JobRunnerLike,
	ctx: C,
): void {
	const jobOps = forSurface(registry, "job");
	const hooks = getHooks(jobOps);

	for (const [, op] of jobOps) {
		if (op.outputChunkSchema != null) continue;
		const config = op.expose.job;
		if (!config) throw new Error(`Missing job config for ${op.name}`);

		const definition: JobDefinitionLike<unknown> = {
			name: op.name,
			schema: op.schema,
			...(config.idempotencyKey && {
				idempotencyKey: config.idempotencyKey as (
					payload: unknown,
					ctx?: unknown,
				) => string,
			}),
			handler: async (payload, _runnerCtx) => {
				const result = await execute(
					op,
					payload,
					ctx,
					"job",
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
								`Invalid job payload: ${JSON.stringify(error.issues)}`,
							);

						case "handler":
							if ("error" in error)
								throw new Error(`Handler failed: ${error.error}`);
							throw new Error("Handler output validation failed");
					}
				}
			},

			options: {
				retries: config.retries ?? 3,
				timeout: config.timeout ?? 30_000,
				backoff: config.backoff ?? "exponential",
			},
		};

		runner.register(definition);
	}
}
