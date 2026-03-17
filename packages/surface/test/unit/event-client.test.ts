import { describe, expect, test } from "bun:test";
import {
	createEventClient,
	createEventClientFromMap,
} from "../../src/event-client/index.js";
import { eventBindingRef, httpBindingRef } from "../../src/index.js";

const bindings = {
	"events.order.created": {
		key: "events.order.created",
		ref: eventBindingRef("events.order.created"),
		topic: "order.created",
		source: "api",
	},
} as const;

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

		const client = createEventClient({
			transport,
			bindings,
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

		const client = createEventClientFromMap({
			transport,
			eventMap: {
				"events.order.created": { topic: "orders" },
			},
		});

		await client.publish(eventBindingRef("events.order.created"), {
			orderId: "x",
		});

		expect(receivedTopic === "orders").toBe(true);
		expect(receivedOptions).toBeUndefined();
	});

	test("rejects non-event binding refs", async () => {
		const transport = {
			async publish() {},
		};

		const client = createEventClient({
			transport,
			bindings,
		});

		await expect(
			client.publishUnknown(httpBindingRef("events.order.created"), {
				orderId: "x",
			}),
		).rejects.toThrow(/Event client received http binding ref; expected event/);
	});
});
