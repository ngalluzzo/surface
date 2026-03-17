import { describe, expect, test } from "bun:test";
import { bindingRef } from "../../src/index.js";
import { createEventClient } from "../../src/event-client/index.js";

type TestRegistry = {
	"events.order.created": { input: { orderId: string }; output: unknown };
};

describe("createEventClient", () => {
	test("publish calls transport with topic and payload from bindings", async () => {
		const payload = { orderId: "ord-1" };
		let receivedTopic: string | null = null;
		let receivedPayload: unknown = null;
		let receivedSource: string | undefined;

		const transport = {
			async publish(topic: string, p: unknown, opts?: { source?: string }) {
				receivedTopic = topic;
				receivedPayload = p;
				receivedSource = opts?.source;
			},
		};

		const client = createEventClient<TestRegistry>({
			transport,
			bindings: {
				"events.order.created": {
					key: "events.order.created",
					ref: bindingRef("events.order.created"),
					topic: "order.created",
					source: "api",
				},
			},
		});

		await client.publish(client.bindings["events.order.created"], payload);

		expect(receivedTopic === "order.created").toBe(true);
		expect(receivedPayload).toEqual(payload);
		expect(receivedSource).toBe("api");
	});

	test("publish omits source when not in event map", async () => {
		let receivedTopic: string | null = null;
		let receivedOptions: { source?: string } | undefined;

		const transport = {
			async publish(topic: string, _p: unknown, opts?: { source?: string }) {
				receivedTopic = topic;
				receivedOptions = opts;
			},
		};

		const client = createEventClient<TestRegistry>({
			transport,
			eventMap: {
				"events.order.created": { topic: "orders" },
			},
		});

		await client.publish(bindingRef("events.order.created"), { orderId: "x" });

		expect(receivedTopic === "orders").toBe(true);
		expect(receivedOptions).toBeUndefined();
	});
});
