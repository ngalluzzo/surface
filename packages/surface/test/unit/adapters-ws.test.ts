import { describe, expect, test } from "bun:test";
import {
	buildWsHandlers,
	createSubscriptionHub,
	type DefaultContext,
} from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import { createMockWsConnection } from "../fixtures/mock-ws-connection.js";
import { createRegistryWithMinimalOp } from "../fixtures/operations.js";

describe("buildWsHandlers", () => {
	test("onMessage with valid op and payload runs execute and sends success response", async () => {
		const registry = createRegistryWithMinimalOp();
		const getContext = (): DefaultContext => createMockContext();
		const handlers = buildWsHandlers(registry, getContext);
		const connection = createMockWsConnection();

		await handlers.onMessage(connection, {
			op: "test.echo",
			payload: { id: "ws-1" },
			id: 1,
		});

		expect(connection.sent).toHaveLength(1);
		expect(connection.sent[0]).toEqual({
			id: 1,
			ok: true,
			value: { id: "ws-1" },
		});
	});

	test("onMessage with unknown op sends error response", async () => {
		const registry = createRegistryWithMinimalOp();
		const getContext = (): DefaultContext => createMockContext();
		const handlers = buildWsHandlers(registry, getContext);
		const connection = createMockWsConnection();

		await handlers.onMessage(connection, {
			op: "unknown.op",
			payload: {},
			id: 2,
		});

		expect(connection.sent).toHaveLength(1);
		expect(connection.sent[0]).toMatchObject({
			id: 2,
			ok: false,
			error: expect.objectContaining({
				phase: "validation",
				issues: expect.any(Array),
			}),
		});
	});

	test("onMessage with missing op sends error response", async () => {
		const registry = createRegistryWithMinimalOp();
		const getContext = (): DefaultContext => createMockContext();
		const handlers = buildWsHandlers(registry, getContext);
		const connection = createMockWsConnection();

		await handlers.onMessage(connection, { payload: {} });

		expect(connection.sent).toHaveLength(1);
		expect(connection.sent[0]).toMatchObject({
			ok: false,
			error: expect.objectContaining({ phase: "validation" }),
		});
	});

	test("onMessage with invalid payload sends validation error response", async () => {
		const registry = createRegistryWithMinimalOp();
		const getContext = (): DefaultContext => createMockContext();
		const handlers = buildWsHandlers(registry, getContext);
		const connection = createMockWsConnection();

		await handlers.onMessage(connection, {
			op: "test.echo",
			payload: { wrong: "shape" },
			id: 3,
		});

		expect(connection.sent).toHaveLength(1);
		expect(connection.sent[0]).toMatchObject({
			id: 3,
			ok: false,
			error: expect.objectContaining({ phase: "validation" }),
		});
	});

	test("onConnect and onDisconnect do not throw", () => {
		const registry = createRegistryWithMinimalOp();
		const getContext = (): DefaultContext => createMockContext();
		const handlers = buildWsHandlers(registry, getContext);
		const connection = createMockWsConnection();

		handlers.onConnect(connection);
		handlers.onDisconnect(connection);
		expect(connection.sent).toHaveLength(0);
	});
});

describe("createSubscriptionHub", () => {
	test("publish sends push message to subscribed connections", async () => {
		const hub = createSubscriptionHub();
		const conn = createMockWsConnection();
		hub.subscribe(conn, "orders");
		await hub.publish("orders", { id: "o1", total: 99 });
		expect(conn.sent).toHaveLength(1);
		expect(conn.sent[0]).toEqual({
			type: "push",
			topic: "orders",
			data: { id: "o1", total: 99 },
		});
	});

	test("unsubscribe stops receiving publish", async () => {
		const hub = createSubscriptionHub();
		const conn = createMockWsConnection();
		hub.subscribe(conn, "orders");
		hub.unsubscribe(conn, "orders");
		await hub.publish("orders", { x: 1 });
		expect(conn.sent).toHaveLength(0);
	});
});
