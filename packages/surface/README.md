# surface

Define an operation once. Expose it everywhere.

**Install:** `bun add @gooios/surface` or `npm install @gooios/surface`. For GraphQL schema generation you also need `@gooios/schemarr`.

`surface` is a TypeScript library for building backend operations that run across multiple surfaces — HTTP endpoints, CLI commands, background jobs, scheduled tasks, event consumers, webhooks, GraphQL mutations, and MCP tools — without duplicating logic, validation, or configuration.

```ts
export const registerOperation = defineOperation({
  name: "registrations.register",
  description: "Register a participant for an event",
  version: 1,

  schema: z.object({
    personId: z.string(),
    eventId: z.string(),
    eventCapacity: z.number().int().positive(),
    confirmedCount: z.number().int().min(0),
  }),

  outputSchema: z.object({
    registrationId: z.string(),
    confirmedAt: z.string().datetime(),
  }),

  guards: [
    assertEventIsScheduled,
    assertNotAlreadyRegistered,
    assertEventHasCapacity,
  ],

  handler: (payload, ctx) => register({ db: ctx.db, ...payload }),

  expose: {
    http: {
      method: "POST",
      path: "/registrations",
      guards: { prepend: [requireSession] },
    },
    cli: {
      command: "registrations register",
      guards: { omit: ["assertNotAlreadyRegistered"] },
    },
    job: {
      queue: "default",
      retries: 3,
      idempotencyKey: (p) => `register:${p.personId}:${p.eventId}`,
    },
    cron: {
      schedule: "0 9 * * 1",
      buildPayload: (ctx) => ctx.db.getPendingRegistrations(),
    },
    event: {
      source: "sqs",
      topic: "registrations.requested",
      parsePayload: (e) => e.body,
    },
    webhook: {
      provider: "stripe",
      event: "checkout.session.completed",
      guards: { prepend: [stripeSignatureGuard] },
      parsePayload: (e) => e.data.object,
    },
    graphql: { type: "mutation", field: "registerForEvent" },
    mcp: { tool: "register_for_event" },
  },
});
```

---

## Why surface?

Most backend operations need to be callable from more than one place. A registration might be triggered by an HTTP request, a Stripe webhook, a backfill job, or an internal CLI tool. Without a unified layer, you end up with the same validation, the same guard logic, and the same error handling copy-pasted across four different entrypoints.

`surface` solves this by making the operation the unit of definition. Surfaces are just transports — they receive input, call `execute()`, and map the result to their output format. Your business logic runs once, the same way, every time.

---

## Core concepts

**Operation** — a name, a Zod input schema, an output schema, domain guards, a handler, and per-surface config. The complete definition of a thing your system can do.

**Registry** — a named collection of operations for one domain. Composed into a root registry at startup.

**Surface** — a transport that receives input and invokes operations. HTTP, CLI, job runner, cron scheduler, event bus, webhook receiver, GraphQL server, MCP server.

**execute()** — the only way to run an operation. Runs four phases in order: surface guards → schema validation → domain guards → handler. Surface adapters never call guards or handlers directly.

---

## Execution model

Every operation runs through four phases:

```
1. Surface guards     — raw unknown input    — auth, rate limiting, signature validation
2. Schema validation  — Zod parse            — always runs, cannot be skipped
3. Domain guards      — validated payload    — your business rule checks
4. Handler            — validated payload    — your domain action
```

The `ExecutionError` type tells you exactly where a failure occurred:

```ts
type ExecutionError =
  | { phase: "surface-guard"; code: string; message?: string }
  | { phase: "validation"; issues: ZodIssue[] }
  | { phase: "domain-guard"; code: string; message?: string }
  | { phase: "handler"; error: string }
  | { phase: "handler"; outputValidation: true; issues: unknown[] }
  | { phase: "timeout"; timeoutMs: number }
  | { phase: "aborted" };
```

Surface adapters map this to their format. HTTP maps to status codes (including 504 for timeout, 499 for aborted). CLI maps to exit codes. Jobs map to retry vs. dead-letter. You never guess.

**Per-surface timeout** — Any surface config can set optional `timeout` (milliseconds). When set, `execute()` enforces it and returns `{ phase: "timeout", timeoutMs }` if the run exceeds the budget. When a timeout is active, `execute()` also passes an `AbortSignal` on context (`ctx.signal`) so handlers can cancel long-running work (e.g. pass `ctx.signal` to `fetch()` or DB clients). Omit `timeout` for no limit (e.g. CLI). HTTP maps timeout to **504 Gateway Timeout**.

**External AbortSignal** — Adapters can pass an optional `signal` in `execute()` options (e.g. from an HTTP request’s disconnect). When that signal aborts, `execute()` returns `{ phase: "aborted" }` and (for HTTP) the default status is **499 Client Closed Request**.

**Idempotency** — Operations can define per-surface `idempotencyKey` (e.g. job: `(payload, ctx) => string`, HTTP: `(payload) => string` for fallback when the client omits a key). `execute()` accepts optional `idempotencyKey` in options; it does not perform store lookups. Use `executeWithIdempotency(store, ttlMs)` to wrap execute: when a key is present, the store caches successful results so duplicate requests (same key within TTL) return the cached response. **Job**: the definition carries `idempotencyKey` so the runner can dedupe enqueues (e.g. use as jobId). **HTTP**: pass `idempotencyStore` and `idempotencyTtlMs` to `buildHttpHandlers`; the adapter reads the key from the `Idempotency-Key` header (or `req.idempotencyKey`) and uses the wrapper. **Event / webhook**: optional store + TTL and `idempotencyKey` on config for processing dedup.

---

## Defining an operation

```ts
import { z } from "zod/v4";
import { defineOperation } from "@gooios/surface";

export const registerOperation = defineOperation({
  name: "registrations.register",
  description: "Register a participant for an event",
  version: 1,

  schema: z.object({
    personId: z.string(),
    eventId: z.string(),
    eventCapacity: z.number().int().positive(),
    confirmedCount: z.number().int().min(0),
  }),

  outputSchema: z.object({
    registrationId: z.string(),
    confirmedAt: z.string().datetime(),
  }),

  guards: [
    assertEventIsScheduled,
    assertNotAlreadyRegistered,
    assertEventHasCapacity,
  ],

  handler: (payload, ctx) => register({ db: ctx.db, ...payload }),

  expose: {
    /* surfaces */
  },
});
```

### Guards

Top-level `guards` are domain guards — they run in phase 3 against the validated payload. Surface configs can override them per-surface:

| Override             | Effect on phase 3 (domain)     |
| -------------------- | ------------------------------ |
| None declared        | Top-level guards run           |
| `{ prepend: [g] }`   | `g` runs first, then top-level |
| `{ append: [g] }`    | Top-level runs first, then `g` |
| `{ replace: [g] }`   | `g` only, top-level skipped    |
| `{ omit: ['name'] }` | Top-level minus named guard    |

`prepend` is the standard pattern for surface-level auth — inject a session check before validation without touching domain guards. `omit` is the standard pattern for trusted surfaces (CLI, jobs) that bypass specific business rules.

You can define named guard policies for reuse and omit them by name:

```ts
import { defineGuardPolicy } from "@gooios/surface";

export const adminOnly = defineGuardPolicy("adminOnly", [
  requireSession,
  requireRole("admin"),
]);

// In an operation — use the policy like a guard:
guards: [adminOnly, assertEventHasCapacity],

// Per-surface: omit the whole policy on trusted surfaces (e.g. CLI)
expose: {
  http: { method: "POST", path: "/admin/thing" },
  cli:  { command: "admin thing", guards: { omit: ["adminOnly"] } },
}
```

### Context enrichment

Guards can return a context delta that is merged and passed to subsequent guards and the handler — so the handler gets enriched context without re-fetching:

```ts
const requireSession: SurfaceGuard = async (raw, ctx) => {
  const session = await getSession(ctx.raw?.headers?.authorization);
  if (!session) return err({ code: "UNAUTHORIZED" });
  return ok({ session }); // merged into context for domain guards and handler
};
```

Domain guards work the same: return `ok(delta)` to attach data; the runner merges it into the context before the next guard and the handler.

---

## Surfaces

### HTTP — `buildHttpHandlers`

Operations with optional **`outputChunkSchema`** are stream operations: the handler returns an `AsyncIterable`; the adapter responds with a `ReadableStream` of NDJSON (see [Streaming](#streaming)).

```ts
import { buildHttpHandlers, forSurface } from "@gooios/surface";

const httpRegistry = forSurface(registry, "http");
const handlers = buildHttpHandlers(httpRegistry, { db });
// Optional: pass idempotencyStore + idempotencyTtlMs for Stripe-style duplicate request caching

for (const [route, handler] of handlers) {
  const [method, path] = route.split(" ");
  app.on(method, path, async (c) => {
    const res = await handler(
      {
        method,
        path,
        body: await c.req.json(),
        headers: c.req.header(),
        signal: c.req.raw.signal, // client disconnect → phase "aborted", 499
      },
      { db },
    );
    return c.json(res.body, res.status);
  });
}
```

Default status code mapping (overridable per-operation):

| Phase           | Status |
| --------------- | ------ |
| `surface-guard` | 401    |
| `validation`    | 400    |
| `domain-guard`  | 422    |
| `handler`       | 422    |
| `timeout`       | 504    |
| `aborted`       | 499    |

### CLI — `runCli`

```ts
import { runCli } from "@gooios/surface";

await runCli(registry, { db }, process.argv.slice(2));
// $ my-app registrations register --personId abc --eventId xyz --eventCapacity 50 --confirmedCount 10
// $ my-app registrations register --personId abc --eventId xyz --eventCapacity 50 --confirmedCount 10 --dry-run
```

Pass `--dry-run` to run all phases up to but not including the handler. Works on any operation, on any surface, at no extra cost.

Unknown commands print auto-generated help from operation `description` fields and exit 1.

### Job — `registerJobOperations`

```ts
import { registerJobOperations } from "@gooios/surface";

const runner = createBullMqRunner({ redisUrl: env.REDIS_URL });
registerJobOperations(registry, runner, { db });
await runner.start();
```

| Phase           | Behaviour                                       |
| --------------- | ----------------------------------------------- |
| `surface-guard` | Dead-letter — non-retryable                     |
| `validation`    | Dead-letter — non-retryable                     |
| `domain-guard`  | Dead-letter — non-retryable                     |
| `handler`       | Retryable — runner retries per operation config |

If an `idempotencyKey` function is defined on the job config, the registered definition includes it; the runner (or enqueue path) can use it to deduplicate enqueues (e.g. use as jobId so duplicate enqueues with the same key are no-ops).

### Cron — `registerCronOperations`

```ts
import { registerCronOperations } from "@gooios/surface";

const scheduler = createNodeCronScheduler();
registerCronOperations(registry, scheduler, { db });
```

Operations with a `cron` surface config have no inbound payload. Instead, `buildPayload` is called at invocation time to construct the input passed to `execute()`. Domain guards and the handler run normally.

```ts
expose: {
  cron: {
    schedule: "0 9 * * 1",
    buildPayload: (ctx) => ctx.db.getPendingRegistrations(),
    timeout: 60_000,
  },
}
```

### Event — `registerEventConsumers`

React to messages from SQS, Kafka, EventBridge, or any pluggable transport. `parsePayload` transforms the raw message envelope into the operation's typed input — the same pattern as webhooks.

```ts
expose: {
  event: {
    source:       "sqs",
    topic:        "registrations.requested",
    parsePayload: (message) => JSON.parse(message.body),
  },
}
```

```ts
import { registerEventConsumers } from "@gooios/surface";

const transport = createSqsTransport({ region: "us-east-1" });
registerEventConsumers(registry, transport, { db });
```

Guard and validation failures are dead-lettered. Handler failures are retried per transport configuration.

### Webhook — `buildWebhookHandlers`

One route per provider, fan-out to operations by event type internally. Always returns HTTP 200 — non-2xx responses trigger provider retry loops.

```ts
expose: {
  webhook: {
    provider:     "stripe",
    event:        "payment_intent.succeeded",
    guards:       { prepend: [stripeSignatureGuard] },
    parsePayload: (raw) => ({
      paymentIntentId: raw.data.object.id,
      amount:          raw.data.object.amount,
    }),
  },
}
```

| Outcome            | Behaviour                                          |
| ------------------ | -------------------------------------------------- |
| Signature failure  | 200 + log — retrying a tampered payload won't help |
| Unknown event type | 200 + ignore                                       |
| Handler failure    | 200 + dead-letter                                  |

### GraphQL — `buildGraphQLSchema`

Derives a GraphQL schema from operation input and output schemas via **Zod → JSON Schema → GraphQL** (using [@gooios/schemarr](https://www.npmjs.com/package/@gooios/schemarr) for the JSON Schema → GraphQL step). Each operation becomes a mutation or query with a single `input` argument and return type inferred from `op.schema` and `op.outputSchema`.

```ts
import { buildGraphQLSchema } from "@gooios/surface";

const schema = await buildGraphQLSchema(registry, ctx);
const server = new ApolloServer({ schema });
```

Supported Zod shapes for input/output: `z.object`, `z.array`, `z.string()`, `z.number()`, `z.boolean()`, `z.enum()`, `z.optional()`, `z.nullable()`. Unsupported kinds (e.g. `z.union`, `z.lazy`) will throw at schema build time.

```ts
expose: {
  graphql: {
    type:  "mutation",
    field: "registerForEvent",
  },
}
```

### MCP — `buildMcpServer`

Exposes operations as MCP tools. Input schema, description, and handler are derived directly from the operation definition — no additional configuration required beyond opting in. Pass a server that implements `McpServerLike` (e.g. from `@modelcontextprotocol/sdk`); the adapter registers each MCP-exposed operation as a tool.

```ts
import { buildMcpServer } from "@gooios/surface";

const server = createMcpServer(); // from @modelcontextprotocol/sdk
buildMcpServer(registry, server, { db });
server.run(); // or server.listen({ port: 3001 }) per your SDK
```

```ts
expose: {
  mcp: {
    tool: "register_for_event",
    // description inherited from operation description
    // input schema derived from operation schema
  },
}
```

### WebSocket — `buildWsHandlers`

RPC over a persistent connection: client sends `{ op, payload?, id? }`, adapter runs `execute(op, payload, ctx, "ws")` and sends back `{ id?, ok, value? | error? }`. For stream operations (`outputChunkSchema`), the adapter sends multiple messages: `{ id?, ok: true, stream: true, chunk }` per chunk and `{ id?, ok: true, stream: true, done: true }` at the end (see [Streaming](#streaming)). Context is per-connection via `getContext(connection)` so handlers can access the connection and a subscription hub. You own the server; wire the returned `onConnect`, `onMessage`, and `onDisconnect` to your WebSocket server.

**Subscriptions**: Define an operation (e.g. `subscriptions.subscribe`) exposed on `ws` with schema `{ topic: string }`. In the handler, call `ctx.hub.subscribe(ctx.connection, payload.topic)`. Use `createSubscriptionHub()` for an in-memory hub; call `hub.publish(topic, data)` from anywhere to push `{ type: "push", topic, data }` to all subscribed connections. Call `hub.unsubscribe(connection)` from `onDisconnect` to clean up.

```ts
import { buildWsHandlers, createSubscriptionHub } from "@gooios/surface";

const hub = createSubscriptionHub();
const handlers = buildWsHandlers(registry, (connection) => ({
  ...baseCtx,
  connection,
  hub,
}));

// Wire to your WebSocket server:
server.on("connection", (socket) => {
  const connection = { send: (data) => socket.send(JSON.stringify(data)) };
  handlers.onConnect(connection);
  socket.on("message", (raw) =>
    handlers.onMessage(connection, JSON.parse(raw)),
  );
  socket.on("close", () => {
    handlers.onDisconnect(connection);
    hub.unsubscribe(connection);
  });
});
```

```ts
expose: {
  ws: {
  }
}
// or ws: { messageKey: "operation" } to use a different message key
```

---

## Typed clients

The operation is the contract in both directions. Surfaces receive input and call `execute()`; **typed clients** let you invoke operations from callers with the same payload types and error model — no codegen, no manual HTTP status mapping.

You define a **registry type** (or import it from a shared package) mapping operation names to input/output. The package exposes generic client factories; once you provide that type, calls are fully typed.

### Registry type

Define an object type that lists each operation and its input/output (e.g. from your Zod schemas):

```ts
import type { RegistryContract } from "@gooios/surface/client";

type AppRegistry = {
  "registrations.register": {
    input: {
      personId: string;
      eventId: string;
      eventCapacity: number;
      confirmedCount: number;
    };
    output: { registrationId: string; confirmedAt: string };
  };
  "registrations.get": {
    input: { registrationId: string };
    output: { personId: string; eventId: string; confirmedAt: string };
  };
};
```

Use this type with all clients below. The server builds runtime maps (method+path, topic, etc.) from the same registry; the client stays in sync via types.

### HTTP client — `@gooios/surface/client`

Framework-agnostic fetch-based client. Returns `Promise<Result<TOutput, ExecutionError>>` — the same shape the server sends in the response body.

```ts
import { buildHttpMapFromRegistry } from "@gooios/surface";
import { createClient } from "@gooios/surface/client";
import type { HttpMap } from "@gooios/surface/client";
import type { AppRegistry } from "./registry";

// Build httpMap from the server registry (or maintain manually)
const httpMap = buildHttpMapFromRegistry(registry) as HttpMap<AppRegistry>;

const client = createClient<AppRegistry>({
  baseUrl: "https://api.example.com",
  headers: () => ({ Authorization: `Bearer ${getToken()}` }),
  httpMap,
});

// Fully typed — input and return type inferred from AppRegistry
const result = await client["registrations.register"]({
  personId: "p1",
  eventId: "e1",
  eventCapacity: 50,
  confirmedCount: 10,
});

if (result.ok) {
  console.log(result.value.registrationId);
} else {
  console.log(result.error.phase, result.error);
}
```

Use in server-side callers, CLI scripts, tests, or any non-React context. No React or TanStack Query required.

### Job client — `@gooios/surface/job-client`

Type-safe enqueue. Payload is typed per operation; wrong shape is a compile error instead of a runtime failure in the worker.

```ts
import { createJobClient } from "@gooios/surface/job-client";
import type { AppRegistry } from "./registry";

const enqueue = {
  async enqueue(
    name: string,
    payload: unknown,
    options?: { idempotencyKey?: string },
  ) {
    await queue.add(name, payload, { jobId: options?.idempotencyKey });
  },
};

const jobs = createJobClient<AppRegistry>(enqueue);

await jobs.enqueue("registrations.register", {
  personId: "p1",
  eventId: "e1",
  eventCapacity: 50,
  confirmedCount: 10,
});

// Optional idempotency key (runner uses it when the op's job config defines idempotencyKey)
await jobs.enqueue("registrations.register", payload, {
  idempotencyKey: "register:p1:e1",
});
```

Queue, retries, and timeout come from the operation’s job config on the worker; the client only sends name, payload, and optional key.

### Event client — `@gooios/surface/event-client`

Type-safe publish. Topic and source come from the event map (built from the operation’s event config), not from the call site.

```ts
import { createEventClient, buildEventMapFromRegistry } from "@gooios/surface";
import type { AppRegistry } from "./registry";

const eventMap = buildEventMapFromRegistry(registry);

const events = createEventClient<AppRegistry>({
  transport: sqsTransport, // { publish(topic, payload, options?) }
  eventMap,
});

await events.publish("registrations.requested", {
  personId: "p1",
  eventId: "e1",
  eventCapacity: 50,
  confirmedCount: 10,
});
```

Fire-and-forget; no return value.

### React Query — `@gooios/surface/client/react`

Thin wrapper over the HTTP client. Use `useOperationQuery` for read-like operations and `useOperationMutation` for write-like; type inference and error handling stay in the base client.

Requires `react` and `@tanstack/react-query` as peer dependencies.

```ts
import { createClient } from "@gooios/surface/client";
import { useOperationQuery, useOperationMutation } from "@gooios/surface/client/react";
import type { AppRegistry } from "./registry";

const client = createClient<AppRegistry>({ baseUrl: "/api", httpMap });

// Read-like (e.g. GET)
function RegistrationDetails({ id }: { id: string }) {
  const { data } = useOperationQuery(client, "registrations.get", { registrationId: id });
  if (!data?.ok) return <div>Error: {data?.error?.phase}</div>;
  return <div>{data.value.confirmedAt}</div>;
}

// Write-like (e.g. POST)
function RegisterForm() {
  const mutation = useOperationMutation(client, "registrations.register");
  const handleSubmit = () => {
    mutation.mutate({
      personId: "p1",
      eventId: "e1",
      eventCapacity: 50,
      confirmedCount: 10,
    });
  };
  // mutation.data is Result<TOutput, ExecutionError>
}
```

---

## Observability

Wire in tracing, logging, or metrics once — it applies to every operation on every surface:

```ts
import { composeRegistries } from "@gooios/surface";

const registry = composeRegistries([...], {
  hooks: {
    onPhaseStart: ({ operation, phase, surface }) => span.start(operation.name, phase),
    onPhaseEnd:   ({ operation, phase, surface, durationMs }) => span.end({ durationMs }),
    onError:      ({ operation, phase, surface, error }) => logger.error({ operation: operation.name, phase, surface, ...error }),
  },
});
```

All errors include `{ operation, phase, surface }` automatically — no per-adapter instrumentation needed. Hook errors are not propagated so instrumentation failures do not affect operation results.

You can also pass `hooks` into `createOps({ hooks })`; the returned `ops.execute()` will use them for every call.

---

## Response schema

Every operation **must** declare an `outputSchema` (Zod) for the handler success value. `execute()` validates the handler result against it; if the shape is wrong, it returns a typed error (`phase: "handler"`, `outputValidation: true`, `issues`). That catches bugs where an action returns an unexpected shape. The same schemas are included in `exportSchemas()` so you get OpenAPI response bodies and client SDK generation.

---

## Streaming

Operations can optionally stream output by declaring **`outputChunkSchema`** (Zod). When present:

- The operation is a **stream operation**: the handler returns `Promise<Result<AsyncIterable<Chunk>, TError>>` where `Chunk = z.infer<typeof outputChunkSchema>`.
- The pipeline does not validate the handler return with `outputSchema`; it checks that the value is an async iterable and passes it through.
- **HTTP**: the response `body` is a `ReadableStream` of NDJSON (one JSON line per chunk). Use `Content-Type: application/x-ndjson` when wiring the response. Idempotency is not applied to stream operations.
- **WebSocket**: the adapter sends multiple messages — one per chunk as `{ id?, ok: true, stream: true, chunk }` and a final `{ id?, ok: true, stream: true, done: true }`.
- **Other surfaces** (CLI, job, cron, event, webhook, GraphQL, MCP): stream operations are skipped at build time (not registered). Use HTTP or WS to expose streaming.

Chunk validation happens at the surface when encoding: each chunk is validated with `outputChunkSchema` before being written. Invalid chunks cause the HTTP stream to error or the WS adapter to send an error response.

**Example**

```ts
const chunkSchema = z.object({ index: z.number(), value: z.string() });

const streamOp = defineOperation({
  name: "search.stream",
  schema: z.object({ q: z.string() }),
  outputSchema: z.never(),
  outputChunkSchema: chunkSchema,
  handler: async (payload) => {
    async function* run() {
      for (let i = 0; i < 10; i++) {
        yield { index: i, value: await fetchResult(payload.q, i) };
      }
    }
    return { ok: true, value: run() };
  },
  expose: { http: { method: "POST", path: "/search/stream" }, ws: {} },
});
```

Stream handlers should respect `ctx.signal` (and any `signal` in execute options) so that client disconnect or timeout aborts iteration. The timeout applies to the handler returning the iterable, not to consuming the stream.

---

## Versioning

Operations may set `version` (e.g. `version: 1`) on the definition. It is stored in schema metadata and included in exports for API versioning and codegen. Optional but recommended for future-proofing.

---

## Schema export

Every operation schema is registered automatically when `defineOperation` is called. The catalogue includes **input and output** schemas (and optional `version` in metadata). Export as OpenAPI 3.0 or JSON Schema:

```ts
import { exportSchemas } from "@gooios/surface";

const catalogue = exportSchemas("openapi-3.0"); // input + output schemas, version in metadata
await fs.writeFile("openapi.json", JSON.stringify(catalogue, null, 2));
```

---

## Testing

`testOperation(op, raw, ctx, options?)` runs an operation in tests without a surface: it skips surface guards, runs schema validation and domain guards + handler with the context you pass. Same return type as `execute()` (errors are validation, domain-guard, or handler only).

```ts
import { testOperation } from "@gooios/surface";
import { registerOperation } from "./register.operation";

it("rejects when event is at capacity", async () => {
  const result = await testOperation(
    registerOperation,
    {
      personId: "p1",
      eventId: "e1",
      eventCapacity: 10,
      confirmedCount: 10,
    },
    { db: testDb },
  );

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.phase).toBe("domain-guard");
  if (!result.ok && result.error.phase === "domain-guard") {
    expect(result.error.code).toBe("EVENT_AT_CAPACITY");
  }
});

it("succeeds with valid payload and injectable context", async () => {
  const result = await testOperation(
    registerOperation,
    { personId: "p1", eventId: "e1", eventCapacity: 10, confirmedCount: 5 },
    { db: testDb },
  );

  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value.registrationId).toBeDefined();
});
```

---

## File structure

```
packages/surface/
  src/
    types.ts         Operation, Guard, GuardPolicy, surface configs, registry types
    define.ts        defineOperation, defineGuardPolicy, defineRegistry, composeRegistries, forSurface
    execute.ts       execute(), testOperation()
    schemas.ts       Schema registry, exportSchemas()
    adapters/
      http.ts        buildHttpHandlers(), buildHttpMapFromRegistry()
      cli.ts         runCli()
      job.ts         registerJobOperations()
      cron.ts        registerCronOperations()
      event.ts       registerEventConsumers(), buildEventMapFromRegistry()
      webhook.ts     buildWebhookHandlers()
      graphql.ts     buildGraphQLSchema()
      mcp.ts         buildMcpServer()
    client/          Typed HTTP client (entrypoint: @gooios/surface/client)
      index.ts       createClient(), types, Result, ExecutionError
      react.ts       useOperationQuery, useOperationMutation (@gooios/surface/client/react)
    job-client/      Typed job enqueue (entrypoint: @gooios/surface/job-client)
    event-client/    Typed event publish (entrypoint: @gooios/surface/event-client)
  index.ts           Barrel
```

---

## Rules

- Operations wrap domain actions — no business logic inside `handler`
- `execute()` is the only entry point — surface adapters never call guards or handlers directly
- `handler` always returns `Result<T, E>` — never throws
- Operation names are globally unique — `composeRegistries` throws on duplicates at startup
- Surface adapters own the mapping from `ExecutionError` to their output format
- Auth lives in surface guards — domain guards are business rules only

---

## What surface does not own

- **Business logic** — lives in your domain actions and guards, unchanged
- **Auth implementation** — `requireSession` and similar guards are provided by your auth layer and passed in at the call site
- **Transport implementations** — BullMQ, node-cron, SQS, Kafka adapters are peer dependencies or separate packages; `surface` defines the interfaces
- **Framework adapters** — Hono, Express, Fastify wiring is your responsibility; `surface` returns handler maps you wire in yourself
