import { watch } from "node:fs";
import { writeFile } from "node:fs/promises";
import * as path from "node:path";
import { Command } from "commander";
import type {
	ConvertError,
	ConvertZodError,
	LoadZodError,
} from "../../convert";
import {
	convert,
	convertToIR,
	convertToTypes,
	convertToZod,
	convertZodToIR,
	convertZodToSql,
	convertZodToTypes,
	convertZodToZod,
} from "../../convert";
import { postgresDialect } from "../../dialect/postgres";
import { bannerText, colors } from "../ui/banner";
import { messages } from "../ui/messages";
import { readInput } from "../utils/file";
import { loadZodFromFile } from "../utils/loadZod";

type Format = "sql" | "zod" | "typescript" | "ir";
type InputFormat = "json" | "zod";
type Dialect = "postgres" | "mysql";
type InlineStrategy = "jsonb" | "separate_table";
type RelationStrategy = "one_to_many" | "many_to_many";

type ConversionResult =
	| { kind: "ok"; value: string | unknown }
	| { kind: "err"; error: ConvertError | ConvertZodError | LoadZodError };

const formatError = (
	error: ConvertError | ConvertZodError | LoadZodError,
): string => {
	if (error.kind === "zod_load_error") {
		return `Zod load error: ${error.message}`;
	}

	switch (error.kind) {
		case "invalid_json":
		case "invalid_schema":
			return error.message;
		case "missing_type":
			return `Missing type at path: ${error.path}`;
		case "unresolved_ref":
			return `Unresolved reference: ${error.ref} at ${error.path}`;
		case "circular_ref":
			return `Circular references detected: ${error.refs.join(" -> ")}`;
		case "unsupported_type":
			return `Unsupported type: ${error.jsonSchemaType} at ${error.path}`;
		case "ambiguous_relation":
			return `Ambiguous relation: ${error.message} at ${error.path}`;
		case "unknown_column_type":
			return `Unknown column type: ${error.columnType}`;
		case "invalid_identifier":
			return `Invalid identifier: ${error.identifier}`;
		case "unsupported_schema_version":
			return `Unsupported schema version: ${error.version}`;
		case "unrepresentable_type":
			return `Unrepresentable Zod type: ${error.zodType}`;
	}
};

export const convertCommand = new Command("convert")
	.description("Convert a JSON Schema or Zod schema to SQL, Zod, or TypeScript")
	.argument(
		"[schema]",
		'Path to JSON Schema or Zod schema file, or "-" for stdin',
	)
	.option(
		"--input-format <format>",
		"Input format (json or zod)",
		"json" as InputFormat,
	)
	.option("-f, --format <format>", "Output format", "sql" as Format)
	.option("-d, --dialect <dialect>", "SQL dialect", "postgres" as Dialect)
	.option(
		"-i, --inline-strategy <strategy>",
		"Inline object strategy",
		"jsonb" as InlineStrategy,
	)
	.option(
		"-r, --relation-strategy <strategy>",
		"Array ref relation strategy",
		"one_to_many" as RelationStrategy,
	)
	.option("-o, --output <file>", "Output file path")
	.option("--pretty", "Pretty print output (for IR format)")
	.option("-w, --watch", "Watch file for changes and auto-convert")
	.option(
		"--export <name>",
		"Export name to use for Zod input (only for --input-format zod)",
	)
	.action(
		async (
			schema: string | undefined,
			options: {
				inputFormat: InputFormat;
				format: Format;
				dialect: Dialect;
				inlineStrategy: InlineStrategy;
				relationStrategy: RelationStrategy;
				output?: string;
				pretty?: boolean;
				watch?: boolean;
				exportName?: string;
			},
		) => {
			console.log(colors.bold(bannerText()));

			try {
				const schemaPath = schema ?? "-";
				const filePath =
					schemaPath === "-" ? undefined : path.resolve(schemaPath);

				if (options.watch === true && schemaPath !== "-") {
					watchMode(filePath ?? "", options);
				} else {
					const result = await doConvert(filePath, options);
					if (result.kind === "err") {
						console.error(
							colors.error(messages.error),
							formatError(result.error),
						);
						process.exit(1);
					}
				}
			} catch (error) {
				if (error instanceof Error) {
					console.error(colors.error(messages.error), error.message);
				}
				process.exit(1);
			}
		},
	);

const doConvert = async (
	filePath: string | undefined,
	options: {
		inputFormat: InputFormat;
		format: Format;
		dialect: Dialect;
		inlineStrategy: InlineStrategy;
		relationStrategy: RelationStrategy;
		output?: string;
		pretty?: boolean;
		exportName?: string;
	},
): Promise<ConversionResult> => {
	let input: unknown;

	// Handle Zod input format
	if (options.inputFormat === "zod" && filePath !== undefined) {
		console.log(colors.info("Loading Zod schema from file..."));

		const loadResult = await loadZodFromFile(filePath, {
			exportName: options.exportName,
		});

		if (loadResult.kind === "err") {
			return {
				kind: "err",
				error: loadResult.error,
			};
		}

		input = loadResult.value;
	} else {
		if (filePath === undefined) {
			console.log(colors.info(messages.readingStdin));
		}

		input = await readInput(filePath);
	}

	console.log(colors.info(messages.converting));

	const isZodInput = options.inputFormat === "zod";
	const commonOptions = {
		inlineObjectStrategy: options.inlineStrategy,
		defaultArrayRefRelation: options.relationStrategy,
	};

	let result: string;
	let error: ConvertError | ConvertZodError | LoadZodError | null = null;
	result = "";

	switch (options.format) {
		case "sql": {
			let sqlResult: ConversionResult;
			if (isZodInput) {
				sqlResult = await convertZodToSql(input, {
					dialect: postgresDialect,
					...commonOptions,
				});
			} else {
				sqlResult = convert(input, {
					dialect: postgresDialect,
					...commonOptions,
				});
			}

			if (sqlResult.kind === "err") {
				error = sqlResult.error;
				break;
			}
			result = sqlResult.value as string;
			break;
		}

		case "zod": {
			let zodResult: ConversionResult;
			if (isZodInput) {
				zodResult = await convertZodToZod(input, commonOptions);
			} else {
				zodResult = convertToZod(input, commonOptions);
			}

			if (zodResult.kind === "err") {
				error = zodResult.error;
				break;
			}
			result = zodResult.value as string;
			break;
		}

		case "typescript": {
			let tsResult: ConversionResult;
			if (isZodInput) {
				tsResult = await convertZodToTypes(input, commonOptions);
			} else {
				tsResult = convertToTypes(input, commonOptions);
			}

			if (tsResult.kind === "err") {
				error = tsResult.error;
				break;
			}
			result = tsResult.value as string;
			break;
		}

		case "ir": {
			let irResult: ConversionResult;
			if (isZodInput) {
				irResult = await convertZodToIR(input, commonOptions);
			} else {
				irResult = convertToIR(input, commonOptions);
			}

			if (irResult.kind === "err") {
				error = irResult.error;
				break;
			}
			result =
				options.pretty === true
					? JSON.stringify(irResult.value, null, 2)
					: JSON.stringify(irResult.value);
			break;
		}

		default: {
			return {
				kind: "err",
				error: {
					kind: "invalid_schema",
					message: `Unknown format: ${String(options.format)}`,
				},
			};
		}
	}

	if (error) {
		return { kind: "err", error };
	}

	if (options.output !== undefined && options.output.length > 0) {
		const outputPath = path.resolve(options.output);
		await writeFile(outputPath, result, "utf-8");
		console.log(colors.success(messages.writingFile(options.output)));
	} else {
		console.log("");
		console.log(colors.bold("--- OUTPUT ---"));
		console.log("");
		console.log(result);
		console.log("");
		console.log(colors.bold("--- END ---"));
	}

	console.log(colors.success(messages.success));

	return { kind: "ok", value: result };
};

const watchMode = (
	filePath: string,
	options: {
		inputFormat: InputFormat;
		format: Format;
		dialect: Dialect;
		inlineStrategy: InlineStrategy;
		relationStrategy: RelationStrategy;
		output?: string;
		pretty?: boolean;
		exportName?: string;
	},
): void => {
	console.log(colors.info(messages.watching(filePath)));
	console.log(colors.dim(messages.pressCtrlC));

	let isConverting = false;

	const runConvert = async () => {
		if (isConverting) return;
		isConverting = true;

		console.log(colors.info(messages.fileChanged(filePath)));
		console.log(colors.info(messages.reconvert));

		try {
			const result = await doConvert(filePath, options);
			if (result.kind === "err") {
				console.error(colors.error(messages.error), formatError(result.error));
			}
		} catch (error) {
			if (error instanceof Error) {
				console.error(colors.error(messages.error), error.message);
			}
		}

		isConverting = false;
	};

	watch(filePath, (eventType) => {
		if (eventType === "change") {
			void runConvert();
		}
	});
};
