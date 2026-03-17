import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
	buildWebhookHandlers,
	defineOperation,
	defineRegistry,
} from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";

describe("buildWebhookHandlers", () => {
	test("throws on duplicate webhook provider/event pairs", () => {
		const opA = defineOperation({
			name: "test.webhookA",
			schema: z.object({ id: z.string() }),
			outputSchema: z.object({ id: z.string() }),
			handler: async (payload: { id: string }) => ({
				ok: true as const,
				value: payload,
			}),
			expose: {
				webhook: {
					default: {
						provider: "pagerduty",
						event: "incident.triggered",
						parsePayload: (raw: unknown) => raw,
					},
				},
			},
		});
		const opB = defineOperation({
			name: "test.webhookB",
			schema: z.object({ id: z.string() }),
			outputSchema: z.object({ id: z.string() }),
			handler: async (payload: { id: string }) => ({
				ok: true as const,
				value: payload,
			}),
			expose: {
				webhook: {
					default: {
						provider: "pagerduty",
						event: "incident.triggered",
						parsePayload: (raw: unknown) => raw,
					},
				},
			},
		});
		const registry = defineRegistry("test", [opA, opB]);

		expect(() => buildWebhookHandlers(registry, createMockContext())).toThrow(
			'Duplicate webhook provider/event pair "pagerduty:incident.triggered"',
		);
	});

	test("bind can compose parsed payload, headers, and metadata into the operation input", async () => {
		let received:
			| {
					incidentId: string;
					signature: string;
					meta: {
						provider: string;
						eventType: string;
					};
			  }
			| undefined;
		const op = defineOperation({
			name: "test.boundWebhook",
			schema: z.object({
				incidentId: z.string(),
				signature: z.string(),
				meta: z.object({
					provider: z.string(),
					eventType: z.string(),
				}),
			}),
			outputSchema: z.null(),
			handler: async (payload) => {
				received = payload;
				return { ok: true as const, value: null };
			},
			expose: {
				webhook: {
					default: {
						provider: "pagerduty",
						event: "incident.triggered",
						parsePayload: (raw: unknown) =>
							(raw as { data: { incident: { id: string } } }).data.incident,
						bind: {
							payload: {
								id: "incidentId",
							},
							headers: {
								"x-signature": "signature",
							},
							meta: {
								provider: "meta.provider",
								eventType: "meta.eventType",
							},
						},
					},
				},
			},
		});
		const registry = defineRegistry("test", [op]);
		const handlers = buildWebhookHandlers(registry, createMockContext());
		const handler = handlers.get("POST /webhooks/pagerduty");
		if (!handler) {
			throw new Error("Expected handler for POST /webhooks/pagerduty");
		}

		const res = await handler(
			{
				provider: "pagerduty",
				eventType: "incident.triggered",
				body: { data: { incident: { id: "inc-1" } } },
				headers: { "x-signature": "sig-123" },
				rawBody: Buffer.from("{}"),
			},
			createMockContext(),
		);

		expect(res.status).toBe(200);
		expect(received).toEqual({
			incidentId: "inc-1",
			signature: "sig-123",
			meta: {
				provider: "pagerduty",
				eventType: "incident.triggered",
			},
		});
	});

	test("bind meta uses the resolved webhook binding config, not caller-supplied request fields", async () => {
		let received:
			| {
					meta: {
						provider: string;
						eventType: string;
					};
			  }
			| undefined;
		const op = defineOperation({
			name: "test.boundWebhookMetaContract",
			schema: z.object({
				meta: z.object({
					provider: z.string(),
					eventType: z.string(),
				}),
			}),
			outputSchema: z.null(),
			handler: async (payload) => {
				received = payload;
				return { ok: true as const, value: null };
			},
			expose: {
				webhook: {
					default: {
						provider: "pagerduty",
						event: "incident.triggered",
						bind: {
							meta: {
								provider: "meta.provider",
								eventType: "meta.eventType",
							},
						},
					},
				},
			},
		});
		const registry = defineRegistry("test", [op]);
		const handlers = buildWebhookHandlers(registry, createMockContext());
		const handler = handlers.get("POST /webhooks/pagerduty");
		if (!handler) {
			throw new Error("Expected handler for POST /webhooks/pagerduty");
		}

		const res = await handler(
			{
				provider: "not-pagerduty",
				eventType: "incident.triggered",
				body: {},
				headers: {},
				rawBody: Buffer.from("{}"),
			},
			createMockContext(),
		);

		expect(res.status).toBe(200);
		expect(received).toEqual({
			meta: {
				provider: "pagerduty",
				eventType: "incident.triggered",
			},
		});
	});
});
