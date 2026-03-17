import { describe, expect, test } from "bun:test";
import {
	createClient,
	createClientFromHttpMap,
} from "../../src/client/index.js";
import { eventBindingRef, httpBindingRef } from "../../src/index.js";

const bindings = {
	"op.get": {
		key: "op.get",
		ref: httpBindingRef("op.get"),
		method: "GET",
		path: "/op/get",
	},
	"op.create": {
		key: "op.create",
		ref: httpBindingRef("op.create"),
		method: "POST",
		path: "/op/create",
	},
} as const;

describe("createClient", () => {
	test("returns one function per binding key", () => {
		const client = createClient({
			baseUrl: "https://api.example.com",
			bindings,
		});
		expect(typeof client["op.get"]).toBe("function");
		expect(typeof client["op.create"]).toBe("function");
		expect(client.bindings["op.get"].ref).toEqual(httpBindingRef("op.get"));
	});

	test("GET request omits body and returns parsed result", async () => {
		const body = { id: "1", name: "Alice" };
		const mockFetch = async (url: string, init?: RequestInit) => {
			expect(url).toContain("/op/get");
			expect(init?.method).toBe("GET");
			expect(init?.body).toBeUndefined();
			return new Response(JSON.stringify({ ok: true, value: body }), {
				status: 200,
			});
		};
		globalThis.fetch = mockFetch as typeof fetch;

		const client = createClient({
			baseUrl: "https://api.example.com",
			bindings,
		});

		const result = await client["op.get"]({ id: "1" });
		expect(result.ok).toBe(true);
		if (result.ok === false) return;
		expect(result.value).toEqual(body);
	});

	test("POST request sends body and returns parsed result", async () => {
		const sent = { name: "Bob" };
		const responseValue = { id: "2" };
		const mockFetch = async (_url: string, init?: RequestInit) => {
			expect(init?.method).toBe("POST");
			expect(JSON.parse((init?.body as string) ?? "{}")).toEqual(sent);
			return new Response(JSON.stringify({ ok: true, value: responseValue }), {
				status: 200,
			});
		};
		globalThis.fetch = mockFetch as typeof fetch;

		const client = createClient({
			baseUrl: "https://api.example.com",
			bindings,
		});

		const result = await client["op.create"](sent);
		expect(result.ok).toBe(true);
		if (result.ok === false) return;
		expect(result.value).toEqual(responseValue);
	});

	test("non-2xx response returns error result", async () => {
		const errBody = { phase: "validation" as const, issues: ["invalid"] };
		const mockFetch = async () =>
			new Response(JSON.stringify({ ok: false, error: errBody }), {
				status: 400,
			});
		globalThis.fetch = Object.assign(mockFetch, {
			preconnect: (_url: string | URL) => {},
		}) as typeof fetch;

		const client = createClientFromHttpMap({
			baseUrl: "https://api.example.com",
			httpMap: {
				"op.get": { method: "GET", path: "/op/get" },
				"op.create": { method: "POST", path: "/op/create" },
			},
		});

		const getOp = client["op.get"];
		if (!getOp) throw new Error("Expected op.get client binding");
		const result = await getOp({ id: "x" });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toEqual(errBody);
	});

	test("calls headers() when provided", async () => {
		let called = false;
		const mockFetch = async (_url: string, init?: RequestInit) => {
			expect(init?.headers).toBeDefined();
			const h = init?.headers;
			const auth =
				typeof (h as Headers).get === "function"
					? ((h as Headers).get("authorization") ??
						(h as Headers).get("Authorization"))
					: ((h as Record<string, string>).Authorization ??
						(h as Record<string, string>).authorization);
			expect(auth).toBe("Bearer token");
			called = true;
			return new Response(JSON.stringify({ ok: true, value: {} }), {
				status: 200,
			});
		};
		globalThis.fetch = mockFetch as typeof fetch;

		const client = createClient({
			baseUrl: "https://api.example.com",
			headers: () => ({ Authorization: "Bearer token" }),
			bindings,
		});

		await client["op.get"]({ id: "1" });
		expect(called).toBe(true);
	});

	test("invoke accepts binding definitions and binding refs", async () => {
		const mockFetch = async (_url: string, _init?: RequestInit) =>
			new Response(JSON.stringify({ ok: true, value: { id: "3" } }), {
				status: 200,
			});
		globalThis.fetch = mockFetch as typeof fetch;

		const client = createClient({
			baseUrl: "https://api.example.com",
			bindings,
		});

		const resultFromDefinition = await client.invoke(
			client.bindings["op.create"],
			{ name: "Carol" },
		);
		expect(resultFromDefinition.ok).toBe(true);

		const resultFromRef = await client.invoke(httpBindingRef("op.create"), {
			name: "Carol",
		});
		expect(resultFromRef.ok).toBe(true);
	});

	test("throws when a binding key collides with the client API", () => {
		expect(() =>
			createClient({
				baseUrl: "https://api.example.com",
				bindings: {
					invoke: {
						key: "invoke",
						ref: httpBindingRef("invoke"),
						method: "POST",
						path: "/invoke",
					},
				},
			}),
		).toThrow(/HTTP binding key "invoke" is reserved by the client API/);
	});

	test("rejects non-http binding refs", async () => {
		const client = createClient({
			baseUrl: "https://api.example.com",
			bindings,
		});

		await expect(
			client.invokeUnknown(eventBindingRef("op.create"), { name: "Carol" }),
		).rejects.toThrow(/HTTP client received event binding ref; expected http/);
	});
});
