import type { JobDefinitionLike, JobRunnerLike } from "../../src/index.js";

/**
 * Mock JobRunnerLike that records register() calls. Use in adapters-job tests to assert
 * registerJobOperations called runner.register with the expected definitions.
 */
export function createMockJobRunner(): {
	runner: JobRunnerLike;
	registered: JobDefinitionLike<unknown>[];
} {
	const registered: JobDefinitionLike<unknown>[] = [];
	const runner: JobRunnerLike = {
		register(def) {
			registered.push(def);
		},
	};
	return { runner, registered };
}
