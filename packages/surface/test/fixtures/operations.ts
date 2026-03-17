import { z } from "zod";
import type {
	AnyOperation,
	DefaultContext,
	SurfaceGuard,
} from "../../src/index.js";
import {
	defineGuardPolicy,
	defineOperation,
	defineRegistry,
} from "../../src/index.js";
import { assertAlwaysFail, assertAlwaysPass, attachSession } from "./guards.js";

const echoSchema = z.object({ id: z.string() });
type EchoPayload = z.infer<typeof echoSchema>;

/**
 * Minimal operation for execute/adapter tests: no guards, success handler.
 * Not registered via defineOperation so it does not pollute atlasRegistry.
 */
export function createMinimalOp() {
	return {
		name: "test.echo",
		schema: echoSchema,
		outputSchema: echoSchema,
		handler: async (payload: EchoPayload) => ({
			ok: true as const,
			value: payload,
		}),
		expose: {
			http: { default: { method: "POST", path: "/test/echo" } },
			cli: { default: { command: "test echo", description: "Echo test" } },
			job: { default: { queue: "default", retries: 1 } },
			event: {
				default: {
					source: "test",
					topic: "test.echo",
					parsePayload: (raw: unknown) => raw,
				},
			},
			cron: {
				default: {
					schedule: "0 9 * * 1",
					buildPayload: () => ({ id: "cron-default" }),
				},
			},
			mcp: { default: { tool: "test_echo" } },
			ws: { default: {} },
			graphql: { default: { type: "mutation", field: "echo" } },
		},
	} satisfies AnyOperation<DefaultContext>;
}

/**
 * Operation with domain guard that fails. Used to test phase 3 (domain-guard) error.
 */
export function createOpWithFailingDomainGuard() {
	return {
		name: "test.echoGuarded",
		schema: echoSchema,
		outputSchema: echoSchema,
		guards: [assertAlwaysFail],
		handler: async (payload: EchoPayload) => ({
			ok: true as const,
			value: payload,
		}),
		expose: {
			http: { default: { method: "POST", path: "/test/echoGuarded" } },
		},
	} satisfies AnyOperation<DefaultContext>;
}

/**
 * Operation with surface guard (prepend). Used to test phase 1 and override behavior.
 */
export function createOpWithSurfaceGuard(
	surfaceGuard: SurfaceGuard<DefaultContext>,
) {
	return {
		name: "test.echoSurfaceGuarded",
		schema: echoSchema,
		outputSchema: echoSchema,
		handler: async (payload: EchoPayload) => ({
			ok: true as const,
			value: payload,
		}),
		expose: {
			http: {
				default: {
					method: "POST",
					path: "/test/echoSurfaceGuarded",
					guards: { prepend: [surfaceGuard] },
				},
			},
		},
	} satisfies AnyOperation<DefaultContext>;
}

/**
 * Operation with two domain guards; used to test omit (skip one by name).
 */
export const opWithTwoGuards = defineOperation({
	name: "test.twoGuards",
	version: 1,
	schema: echoSchema,
	outputSchema: echoSchema,
	guards: [assertAlwaysPass, assertAlwaysFail],
	handler: async (payload: EchoPayload) => ({ ok: true, value: payload }),
	expose: {
		http: {
			default: {
				method: "POST",
				path: "/test/twoGuards",
				guards: { omit: ["assertAlwaysFail"] },
			},
		},
	},
});

/**
 * Operation that fails in handler. Used to test phase 4 (handler) error.
 */
export const opWithFailingHandler = defineOperation({
	name: "test.failingHandler",
	schema: echoSchema,
	outputSchema: echoSchema,
	handler: async () => ({ ok: false, error: "handler_error" }),
	expose: { http: { default: { method: "POST", path: "/test/failing" } } },
});

/** Returns a value that fails output schema validation; used for handler output validation tests. */
function invalidOutputForValidationTest(): EchoPayload {
	// Intentionally wrong shape to trigger output validation error
	return { wrong: "shape" } as unknown as EchoPayload;
}

/**
 * Operation whose handler returns a value that fails output validation.
 * Used to test phase 4 (handler) output validation error.
 */
export const opWithOutputValidationFailure = defineOperation({
	name: "test.outputValidationFailure",
	schema: echoSchema,
	outputSchema: echoSchema,
	handler: async () => ({
		ok: true,
		value: invalidOutputForValidationTest(),
	}),
	expose: {
		http: {
			default: { method: "POST", path: "/test/outputValidationFailure" },
		},
	},
});

/** Guard policy used to test omit by policy name. */
export const policyTwoGuards = defineGuardPolicy("testPolicyTwoGuards", [
	assertAlwaysPass,
	assertAlwaysFail,
]);

/**
 * Operation with a guard policy; HTTP surface omits the policy so handler runs.
 */
export const opWithPolicyOmittedOnHttp = defineOperation({
	name: "test.policyOmitted",
	schema: echoSchema,
	outputSchema: echoSchema,
	guards: [policyTwoGuards],
	handler: async (payload: EchoPayload) => ({ ok: true, value: payload }),
	expose: {
		http: {
			default: {
				method: "POST",
				path: "/test/policyOmitted",
				guards: { omit: ["testPolicyTwoGuards"] },
			},
		},
	},
});

/**
 * Operation with a guard policy; no omit, so the policy runs and assertAlwaysFail fails.
 */
export const opWithPolicyNotOmitted = defineOperation({
	name: "test.policyNotOmitted",
	schema: echoSchema,
	outputSchema: echoSchema,
	guards: [policyTwoGuards],
	handler: async (payload: EchoPayload) => ({ ok: true, value: payload }),
	expose: {
		http: { default: { method: "POST", path: "/test/policyNotOmitted" } },
	},
});

const outputWithSession = echoSchema.extend({ session: z.string() });

/**
 * Operation with a guard that enriches context; handler receives and returns session.
 */
export const opWithContextEnrichment = defineOperation({
	name: "test.contextEnrichment",
	schema: echoSchema,
	outputSchema: outputWithSession,
	guards: [attachSession],
	handler: async (
		payload: EchoPayload,
		ctx: DefaultContext & { session?: string },
	) => ({
		ok: true as const,
		value: { ...payload, session: ctx.session ?? "" },
	}),
	expose: {
		http: { default: { method: "POST", path: "/test/contextEnrichment" } },
	},
});

/**
 * Registry containing one HTTP-exposed op (minimal). For adapter tests that need
 * a registry without going through defineOperation for the op (so we pass a raw op
 * in a Map).
 */
export function createRegistryWithMinimalOp() {
	const op = createMinimalOp();
	return defineRegistry("test", [op]);
}

/**
 * Registry with ops that were defined via defineOperation (for forSurface / adapter tests).
 */
export function createDefinedRegistry() {
	return defineRegistry("test", [
		opWithTwoGuards,
		opWithFailingHandler,
		opWithOutputValidationFailure,
	]);
}
