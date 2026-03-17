import type { CronDefinitionLike, CronSchedulerLike } from "../../src/index.js";

/**
 * Mock CronSchedulerLike that records register() calls and can fire a
 * definition's handler. Use in adapters-cron tests.
 */
export function createMockCronScheduler(): {
	scheduler: CronSchedulerLike;
	registered: CronDefinitionLike[];
	fire: (name: string) => Promise<void>;
} {
	const registered: CronDefinitionLike[] = [];
	const scheduler: CronSchedulerLike = {
		register(def) {
			registered.push(def);
		},
	};
	async function fire(name: string) {
		const def = registered.find((d) => d.name === name);
		if (!def) throw new Error(`No cron definition found: ${name}`);
		await def.handler();
	}
	return { scheduler, registered, fire };
}
