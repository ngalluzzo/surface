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
});
