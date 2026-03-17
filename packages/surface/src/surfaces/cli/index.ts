import { parseArgs } from "node:util";
import { z } from "zod/v4";
import { execute, getHooks } from "../../execution";
import type { OperationRegistryWithHooks } from "../../operation";
import { forSurface } from "../../operation";
import type { DefaultContext, OperationRegistry } from "../../operation/types";
import type { SchemaRegistryZodRegistry } from "../../registry/schema-registry";
import { defaultRegistry } from "../../registry/schema-registry";
import type { RunCliOptions } from "./types";

export type { RunCliOptions } from "./types";

export async function runCli<C extends DefaultContext = DefaultContext>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	ctx: C,
	argv: string[],
	options?: RunCliOptions,
): Promise<void> {
	const cliOps = forSurface(registry, "cli");
	const cliOpsNonStream = new Map(
		[...cliOps].filter(([, o]) => o.outputChunkSchema == null),
	);
	const hooks = getHooks(cliOps);
	const [command, ...rest] = argv;

	const op = [...cliOpsNonStream.values()].find(
		(o) => o.expose.cli?.command === command,
	);

	if (!op) {
		console.error(`Unknown command: ${command}\n`);
		printHelp(cliOpsNonStream);
		process.exit(1);
	}

	const config = op.expose.cli;
	if (!config) throw new Error(`Missing cli config for ${op.name}`);
	const registryForSchema =
		options?.schemaRegistry?.registry ?? defaultRegistry;

	const dryRun = rest.includes("--dry-run");
	const restWithoutDryRun = dryRun
		? rest.filter((arg) => arg !== "--dry-run")
		: rest;
	const raw = parseArgvToObject(
		restWithoutDryRun,
		op.schema,
		registryForSchema,
	);

	const executeOptions =
		hooks || dryRun
			? { ...(hooks ? { hooks } : {}), ...(dryRun ? { dryRun: true } : {}) }
			: undefined;
	const result = await execute(op, raw, ctx, "cli", config, executeOptions);

	if (!result.ok) {
		const { error } = result;
		switch (error.phase) {
			case "surface-guard":
			case "domain-guard":
				console.error(
					`Error [${error.code}]${error.message ? `: ${error.message}` : ""}`,
				);
				break;
			case "validation": {
				console.error("Invalid input:");
				const issues = error.issues as Array<{
					path?: (string | number)[];
					message: string;
				}>;
				for (const issue of issues) {
					console.error(
						`  ${issue.path?.join(".") ?? "input"}: ${issue.message}`,
					);
				}
				break;
			}
			case "handler":
				if ("outputValidation" in error && error.outputValidation) {
					console.error("Output validation failed");
					const issues = error.issues as Array<{
						path?: (string | number)[];
						message: string;
					}>;
					for (const issue of issues) {
						console.error(
							`  ${issue.path?.join(".") ?? "output"}: ${issue.message}`,
						);
					}
				} else if ("error" in error) {
					console.error(`Failed: ${error.error}`);
				}
				break;
		}
		process.exit(1);
	}

	if (dryRun) {
		console.log("Dry run: validation and guards passed, handler skipped.");
		process.exit(0);
	}

	switch (config.output ?? "json") {
		case "json":
			console.log(JSON.stringify(result.value, null, 2));
			break;
		case "table":
			console.table(result.value);
			break;
		case "plain":
			console.log(result.value);
			break;
	}

	process.exit(0);
}

const printHelp = <C extends DefaultContext>(
	ops: OperationRegistry<C>,
): void => {
	console.log("Available commands:\n");
	for (const [, op] of ops) {
		const cfg = op.expose.cli;
		if (!cfg) continue;
		const { command, description } = cfg;
		console.log(`  ${command.padEnd(40)} ${description ?? ""}`);
	}
};

interface JSONSchemaWithProperties {
	properties?: Record<string, { type?: string }>;
}

const parseArgvToObject = (
	argv: string[],
	schema: z.ZodType,
	metadataRegistry: SchemaRegistryZodRegistry = defaultRegistry,
): Record<string, unknown> => {
	const jsonSchema = z.toJSONSchema(schema, {
		metadata: metadataRegistry,
	} as Parameters<typeof z.toJSONSchema>[1]) as JSONSchemaWithProperties;
	const props = jsonSchema.properties ?? {};
	const keys = Object.keys(props);

	const { values } = parseArgs({
		args: argv,
		options: Object.fromEntries(keys.map((k) => [k, { type: "string" }])),
	});

	return Object.fromEntries(
		Object.entries(values).map(([k, v]) => {
			const type = props[k]?.type;
			if (type === "number" && typeof v === "string") return [k, Number(v)];
			if (type === "boolean" && typeof v === "string") return [k, v === "true"];
			return [k, v];
		}),
	);
};
