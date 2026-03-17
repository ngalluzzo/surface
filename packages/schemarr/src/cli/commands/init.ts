import { writeFile } from "node:fs/promises";
import * as path from "node:path";
import inquirer from "inquirer";
import { convert, convertToTypes, convertToZod } from "../../convert";
import { postgresDialect } from "../../dialect/postgres";
import { bannerText, colors } from "../ui/banner";
import { messages } from "../ui/messages";
import { readInput } from "../utils/file";

type Answers = {
	mode: "file" | "paste";
	schemaFile?: string;
	schemaJson?: string;
	format: "sql" | "zod" | "typescript" | "ir";
	dialect: "postgres" | "mysql";
	inlineStrategy: "jsonb" | "separate_table";
	relationStrategy: "one_to_many" | "many_to_many";
	output?: string;
	pretty?: boolean;
	watch?: boolean;
};

export const initCommand = {
	description: "Interactive wizard to create a new conversion",
	handler: async () => {
		console.log(colors.bold(bannerText()));
		console.log(colors.info(messages.welcome));
		console.log("");

		const answers = await inquirer.prompt<Answers>([
			{
				type: "list",
				name: "mode",
				message: "How would you like to provide the JSON Schema?",
				choices: [
					{ name: "Load from a file", value: "file" },
					{ name: "Paste JSON directly", value: "paste" },
				],
			},
			{
				type: "input",
				name: "schemaFile",
				message: messages.schemaFile,
				when: (answers) => answers.mode === "file",
				validate: (input: string): boolean | string => {
					if (typeof input !== "string") return messages.inputRequired;
					return input.trim().length > 0 || messages.inputRequired;
				},
			},
			{
				type: "editor",
				name: "schemaJson",
				message: messages.schemaJson,
				when: (answers) => answers.mode === "paste",
				validate: (input: string): boolean | string => {
					try {
						if (typeof input !== "string") return "Invalid JSON";
						JSON.parse(input);
						return true;
					} catch {
						return "Invalid JSON";
					}
				},
			},
			{
				type: "list",
				name: "format",
				message: messages.selectFormat,
				choices: [
					{ name: "SQL DDL", value: "sql" },
					{ name: "Zod validation", value: "zod" },
					{ name: "TypeScript types", value: "typescript" },
					{ name: "Intermediate Representation (debug)", value: "ir" },
				],
			},
			{
				type: "list",
				name: "dialect",
				message: messages.selectDialect,
				choices: [
					{ name: "PostgreSQL", value: "postgres" },
					{ name: "MySQL (coming soon)", value: "mysql" },
				],
				when: (answers) => answers.format === "sql",
				default: "postgres",
			},
			{
				type: "list",
				name: "inlineStrategy",
				message: messages.selectInlineStrategy,
				choices: [
					{ name: "Store as JSONB (PostgreSQL)", value: "jsonb" },
					{ name: "Create separate table", value: "separate_table" },
				],
				default: "jsonb",
			},
			{
				type: "list",
				name: "relationStrategy",
				message: messages.selectRelationStrategy,
				choices: [
					{ name: "One-to-many (foreign key)", value: "one_to_many" },
					{ name: "Many-to-many (join table)", value: "many_to_many" },
				],
				default: "one_to_many",
			},
			{
				type: "confirm",
				name: "pretty",
				message: "Pretty print the output?",
				when: (answers) => answers.format === "ir",
				default: true,
			},
			{
				type: "confirm",
				name: "watch",
				message: "Watch the schema file for changes?",
				when: (answers) => answers.mode === "file",
				default: false,
			},
			{
				type: "input",
				name: "output",
				message: messages.outputLocation,
				default: (answers: Answers) => {
					const extMap: Record<Answers["format"], string> = {
						sql: "sql",
						zod: "ts",
						typescript: "ts",
						ir: "json",
					};
					return `output.${extMap[answers.format]}`;
				},
			},
		]);

		console.log("");
		console.log(colors.info(messages.converting));

		let schema: unknown;

		if (
			answers.mode === "file" &&
			answers.schemaFile !== undefined &&
			answers.schemaFile.length > 0
		) {
			schema = await readInput(path.resolve(answers.schemaFile));
		} else if (
			answers.mode === "paste" &&
			answers.schemaJson !== undefined &&
			answers.schemaJson.length > 0
		) {
			schema = JSON.parse(answers.schemaJson);
		}

		const commonOptions = {
			inlineObjectStrategy: answers.inlineStrategy,
			defaultArrayRefRelation: answers.relationStrategy,
		};

		let result: string;

		switch (answers.format) {
			case "sql": {
				const dialect = postgresDialect;
				const sqlResult = convert(schema, {
					dialect,
					...commonOptions,
				});
				if (sqlResult.kind === "err") {
					console.error(
						colors.error(messages.error),
						JSON.stringify(sqlResult.error),
					);
					process.exit(1);
				}
				result = sqlResult.value;
				break;
			}

			case "zod": {
				const zodResult = convertToZod(schema, commonOptions);
				if (zodResult.kind === "err") {
					console.error(
						colors.error(messages.error),
						JSON.stringify(zodResult.error),
					);
					process.exit(1);
				}
				result = zodResult.value;
				break;
			}

			case "typescript": {
				const tsResult = convertToTypes(schema, commonOptions);
				if (tsResult.kind === "err") {
					console.error(
						colors.error(messages.error),
						JSON.stringify(tsResult.error),
					);
					process.exit(1);
				}
				result = tsResult.value;
				break;
			}

			case "ir": {
				const { convertToIR } = await import("../../convert");
				const irResult = convertToIR(schema, commonOptions);
				if (irResult.kind === "err") {
					console.error(
						colors.error(messages.error),
						JSON.stringify(irResult.error),
					);
					process.exit(1);
				}
				result =
					answers.pretty === true
						? JSON.stringify(irResult.value, null, 2)
						: JSON.stringify(irResult.value);
				break;
			}

			default: {
				console.error(colors.error("Unknown format:"), answers.format);
				process.exit(1);
				return;
			}
		}

		if (answers.output !== undefined && answers.output.length > 0) {
			const outputPath = path.resolve(answers.output);
			await writeFile(outputPath, result, "utf-8");
			console.log(colors.success(messages.writingFile(answers.output)));
		} else {
			console.log("");
			console.log(colors.bold("--- OUTPUT ---"));
			console.log("");
			console.log(result);
			console.log("");
			console.log(colors.bold("--- END ---"));
		}

		console.log(colors.success(messages.success));

		if (
			answers.watch === true &&
			answers.mode === "file" &&
			answers.schemaFile !== undefined &&
			answers.schemaFile.length > 0
		) {
			const { watch } = await import("node:fs");
			const filePath = path.resolve(answers.schemaFile);
			console.log(colors.info(messages.watching(filePath)));
			console.log(colors.dim(messages.pressCtrlC));

			let isConverting = false;

			const runConvert = async () => {
				if (isConverting) return;
				isConverting = true;

				console.log(colors.info(messages.fileChanged(filePath)));
				console.log(colors.info(messages.reconvert));

				try {
					const schema = await readInput(filePath);
					let result: string;

					switch (answers.format) {
						case "sql": {
							const dialect = postgresDialect;
							const sqlResult = convert(schema, {
								dialect,
								...commonOptions,
							});
							if (sqlResult.kind === "err") {
								console.error(
									colors.error(messages.error),
									JSON.stringify(sqlResult.error),
								);
								isConverting = false;
								return;
							}
							result = sqlResult.value;
							break;
						}

						case "zod": {
							const zodResult = convertToZod(schema, commonOptions);
							if (zodResult.kind === "err") {
								console.error(
									colors.error(messages.error),
									JSON.stringify(zodResult.error),
								);
								isConverting = false;
								return;
							}
							result = zodResult.value;
							break;
						}

						case "typescript": {
							const tsResult = convertToTypes(schema, commonOptions);
							if (tsResult.kind === "err") {
								console.error(
									colors.error(messages.error),
									JSON.stringify(tsResult.error),
								);
								isConverting = false;
								return;
							}
							result = tsResult.value;
							break;
						}

						case "ir": {
							const { convertToIR } = await import("../../convert");
							const irResult = convertToIR(schema, commonOptions);
							if (irResult.kind === "err") {
								console.error(
									colors.error(messages.error),
									JSON.stringify(irResult.error),
								);
								isConverting = false;
								return;
							}
							result =
								answers.pretty === true
									? JSON.stringify(irResult.value, null, 2)
									: JSON.stringify(irResult.value);
							break;
						}

						default: {
							return;
						}
					}

					if (answers.output !== undefined && answers.output.length > 0) {
						await writeFile(path.resolve(answers.output), result, "utf-8");
						console.log(colors.success(messages.writingFile(answers.output)));
					} else {
						console.log("");
						console.log(colors.bold("--- OUTPUT ---"));
						console.log("");
						console.log(result);
						console.log("");
						console.log(colors.bold("--- END ---"));
					}

					console.log(colors.success(messages.success));
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
		}
	},
};
