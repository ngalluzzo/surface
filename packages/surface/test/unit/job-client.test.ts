import { describe, expect, test } from "bun:test";
import { bindingRef } from "../../src/index.js";
import { createJobClient } from "../../src/job-client/index.js";

type TestRegistry = {
	"jobs.process": { input: { id: string }; output: unknown };
};

describe("createJobClient", () => {
	test("enqueue calls adapter with op name and payload", async () => {
		const payload = { id: "job-1" };
		let receivedName: string | null = null;
		let receivedPayload: unknown = null;
		let receivedOptions: { idempotencyKey?: string } | undefined;

		const enqueue = {
			async enqueue(
				name: string,
				p: unknown,
				opts?: { idempotencyKey?: string },
			) {
				receivedName = name;
				receivedPayload = p;
				receivedOptions = opts;
			},
		};

		const client = createJobClient<TestRegistry>(enqueue);
		await client.enqueue("jobs.process", payload);

		expect(receivedName === "jobs.process").toBe(true);
		expect(receivedPayload).toEqual(payload);
		expect(receivedOptions).toBeUndefined();
	});

	test("enqueue passes idempotency key when provided", async () => {
		let receivedOptions: { idempotencyKey?: string } | undefined;

		const enqueue = {
			async enqueue(
				_name: string,
				_p: unknown,
				opts?: { idempotencyKey?: string },
			) {
				receivedOptions = opts;
			},
		};

		const client = createJobClient<TestRegistry>(enqueue);
		await client.enqueue(
			"jobs.process",
			{ id: "x" },
			{
				idempotencyKey: "process:x",
			},
		);

		expect(receivedOptions?.idempotencyKey).toBe("process:x");
	});

	test("enqueue accepts binding refs", async () => {
		let receivedName: string | null = null;

		const enqueue = {
			async enqueue(name: string) {
				receivedName = name;
			},
		};

		const client = createJobClient<TestRegistry>(enqueue);
		await client.enqueue(bindingRef("jobs.process", "backfill"), { id: "x" });

		expect(String(receivedName)).toBe("jobs.process:backfill");
	});
});
