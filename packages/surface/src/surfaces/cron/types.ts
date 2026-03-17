export interface CronDefinitionOptions {
	timeout?: number;
}

export interface CronDefinitionLike {
	name: string;
	schedule: string;
	handler: () => Promise<void>;
	options?: CronDefinitionOptions;
}

export interface CronSchedulerLike {
	register(definition: CronDefinitionLike): void;
}

export { NonRetryableError } from "../job/types";
