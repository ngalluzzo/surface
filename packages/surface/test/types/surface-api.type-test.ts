import { expectTypeOf } from "expect-type";
import { z } from "zod";
import type { BindingNamesOf, BindingRef, ExecutionError, Result } from "../..";
import {
	buildEventBindingsFromRegistry,
	buildHttpBindingsFromRegistry,
	buildJobBindingsFromRegistry,
	createClient,
	createEventClient,
	createJobClient,
	createOps,
	defineOperation,
	defineRegistry,
	eventBindingRef,
	forSurface,
	httpBindingRef,
	jobBindingRef,
	normalizeOperationSurfaceBindings,
	resolveOperationSurfaceBinding,
} from "../..";

const defaultContext = {};

const createUser = defineOperation({
	name: "users.create",
	schema: z.object({ id: z.string() }),
	outputSchema: z.object({ id: z.string(), created: z.literal(true) }),
	handler: async (payload) => ({
		ok: true as const,
		value: { id: payload.id, created: true as const },
	}),
	expose: {
		http: {
			default: { method: "POST" as const, path: "/users" },
			admin: { method: "POST" as const, path: "/admin/users" },
		},
		event: {
			default: {
				source: "app",
				topic: "users.created",
				parsePayload: (raw: unknown) => raw,
			},
		},
	},
});

const enqueueUser = defineOperation({
	name: "users.enqueue",
	schema: z.object({ id: z.string() }),
	outputSchema: z.null(),
	handler: async () => ({ ok: true as const, value: null }),
	expose: {
		job: {
			default: { queue: "users" },
		},
	},
});

const auditUser = defineOperation({
	name: "users.audit",
	schema: z.object({ id: z.string() }),
	outputSchema: z.object({ audited: z.literal(true) }),
	handler: async () => ({
		ok: true as const,
		value: { audited: true as const },
	}),
	expose: {
		http: {
			admin: { method: "POST" as const, path: "/admin/users/audit" },
			internal: { method: "POST" as const, path: "/internal/users/audit" },
		},
	},
});

const streamHttp = defineOperation({
	name: "users.streamHttp",
	schema: z.object({ id: z.string() }),
	outputSchema: z.never(),
	outputChunkSchema: z.object({ value: z.string() }),
	handler: async () => ({
		ok: true as const,
		value: {
			async *[Symbol.asyncIterator]() {
				yield { value: "chunk" as const };
			},
		},
	}),
	expose: {
		http: {
			default: { method: "GET" as const, path: "/users/stream" },
		},
	},
});

const streamEvent = defineOperation({
	name: "users.streamEvent",
	schema: z.object({ id: z.string() }),
	outputSchema: z.never(),
	outputChunkSchema: z.object({ value: z.string() }),
	handler: async () => ({
		ok: true as const,
		value: {
			async *[Symbol.asyncIterator]() {
				yield { value: "chunk" as const };
			},
		},
	}),
	expose: {
		event: {
			default: {
				source: "app",
				topic: "users.stream",
				parsePayload: (raw: unknown) => raw,
			},
		},
	},
});

const streamJob = defineOperation({
	name: "users.streamJob",
	schema: z.object({ id: z.string() }),
	outputSchema: z.never(),
	outputChunkSchema: z.object({ value: z.string() }),
	handler: async () => ({
		ok: true as const,
		value: {
			async *[Symbol.asyncIterator]() {
				yield { value: "chunk" as const };
			},
		},
	}),
	expose: {
		job: {
			default: { queue: "users" },
		},
	},
});

expectTypeOf(createUser.name).toEqualTypeOf<"users.create">();
expectTypeOf<BindingNamesOf<typeof createUser, "http">>().toEqualTypeOf<
	"default" | "admin"
>();

const userRegistry = defineRegistry("users", [
	createUser,
	enqueueUser,
] as const);
expectTypeOf(userRegistry.operations).toEqualTypeOf<
	readonly [typeof createUser, typeof enqueueUser]
>();
expectTypeOf(userRegistry.get("users.create")).toEqualTypeOf<
	typeof createUser | undefined
>();
const httpOnlyRegistry = forSurface(userRegistry, "http");
expectTypeOf(httpOnlyRegistry.operations).toEqualTypeOf<
	readonly (typeof createUser)[]
>();

const httpBindings = buildHttpBindingsFromRegistry(userRegistry);
expectTypeOf(httpBindings["users.create"].ref).toEqualTypeOf<
	BindingRef<"http", "users.create", "default">
>();
expectTypeOf(httpBindings["users.create:admin"].ref).toEqualTypeOf<
	BindingRef<"http", "users.create", "admin">
>();
const streamHttpRegistry = defineRegistry("stream-http", [streamHttp] as const);
const streamHttpBindings = buildHttpBindingsFromRegistry(streamHttpRegistry);
expectTypeOf<keyof typeof streamHttpBindings>().toEqualTypeOf<never>();
const normalizedHttpBindings = normalizeOperationSurfaceBindings(
	createUser,
	"http",
);
expectTypeOf(
	normalizedHttpBindings[number].config.path,
).toEqualTypeOf<string>();
const adminBinding = resolveOperationSurfaceBinding(
	createUser,
	"http",
	"admin",
);
expectTypeOf(adminBinding).toEqualTypeOf<
	| {
			key: "users.create:admin";
			ref: BindingRef<"http", "users.create", "admin">;
			bindingId: "users.create:admin";
			bindingName: "admin";
			surface: "http";
			operationName: "users.create";
			op: typeof createUser;
			config: { method: "POST"; path: string };
	  }
	| undefined
>();

const httpClient = createClient({
	baseUrl: "https://example.com",
	bindings: httpBindings,
});
expectTypeOf(httpClient["users.create"]).returns.toEqualTypeOf<
	Promise<Result<{ id: string; created: true }, ExecutionError>>
>();

const eventClient = createEventClient({
	transport: {
		async publish() {},
	},
	bindings: buildEventBindingsFromRegistry(userRegistry),
});
expectTypeOf(eventClient.publish).returns.toEqualTypeOf<Promise<void>>();
const streamEventRegistry = defineRegistry("stream-event", [
	streamEvent,
] as const);
const streamEventBindings = buildEventBindingsFromRegistry(streamEventRegistry);
expectTypeOf<keyof typeof streamEventBindings>().toEqualTypeOf<never>();

const jobClient = createJobClient({
	enqueue: {
		async enqueue() {},
	},
	bindings: buildJobBindingsFromRegistry(userRegistry),
});
expectTypeOf(jobClient.enqueue).returns.toEqualTypeOf<Promise<void>>();
const streamJobRegistry = defineRegistry("stream-job", [streamJob] as const);
const streamJobBindings = buildJobBindingsFromRegistry(streamJobRegistry);
expectTypeOf<keyof typeof streamJobBindings>().toEqualTypeOf<never>();

const ops = createOps<typeof defaultContext>();
const opsRegistry = ops.defineRegistry("users", [
	createUser,
	enqueueUser,
] as const);
expectTypeOf(opsRegistry.operations).toEqualTypeOf<
	readonly [typeof createUser, typeof enqueueUser]
>();
expectTypeOf(
	ops.execute(createUser, { id: "123" }, defaultContext, {
		surface: "http",
		binding: "admin",
	}),
).toEqualTypeOf<
	Promise<
		| { ok: true; value: { id: string; created: true } }
		| { ok: false; error: ExecutionError }
	>
>();
expectTypeOf(
	ops.execute(auditUser, { id: "123" }, defaultContext, {
		surface: "http",
		binding: "admin",
	}),
).toEqualTypeOf<
	Promise<
		| { ok: true; value: { audited: true } }
		| { ok: false; error: ExecutionError }
	>
>();

// @ts-expect-error output schema and handler value must agree
defineOperation({
	name: "users.invalid",
	schema: z.object({ id: z.string() }),
	outputSchema: z.object({ id: z.string() }),
	handler: async () => ({
		ok: true as const,
		value: { wrong: true },
	}),
	expose: {
		http: {
			default: { method: "POST" as const, path: "/users/invalid" },
		},
	},
});

// @ts-expect-error createUser is not exposed on cli
ops.execute(createUser, { id: "123" }, defaultContext, {
	surface: "cli",
});

// @ts-expect-error createUser has no "missing" http binding
ops.execute(createUser, { id: "123" }, defaultContext, {
	surface: "http",
	binding: "missing",
});

// @ts-expect-error auditUser has multiple http bindings and no default
ops.execute(auditUser, { id: "123" }, defaultContext, {
	surface: "http",
});

// @ts-expect-error http binding refs are not valid event client refs
eventClient.publish(httpBindingRef("users.create"), { id: "123" });

// @ts-expect-error http binding refs are not valid job client refs
jobClient.enqueue(httpBindingRef("users.create"), { id: "123" });

expectTypeOf(eventBindingRef("users.create")).toEqualTypeOf<
	BindingRef<"event", "users.create", "default">
>();
expectTypeOf(jobBindingRef("users.enqueue")).toEqualTypeOf<
	BindingRef<"job", "users.enqueue", "default">
>();
