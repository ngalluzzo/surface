import { describe, expect, test } from "bun:test";
import {
	buildWebhookHandlers,
	defineOperation,
	type DefaultContext,
	type OperationRegistry,
} from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import { z } from "zod";

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
		const registry = new Map([
			[opA.name, opA],
			[opB.name, opB],
		]) as OperationRegistry<DefaultContext>;

		expect(() =>
			buildWebhookHandlers(registry, createMockContext()),
		).toThrow(
			'Duplicate webhook provider/event pair "pagerduty:incident.triggered"',
		);
	});
});
