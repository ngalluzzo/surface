import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript";
import { err, ok, type Result } from "../../lib/result";

// Note: Some imports are unused but kept for potential future use
// This module was created during Iteration 1 when attempting
// to use TypeScript compiler API to extract z.infer types.

const tempDir = path.join(os.tmpdir(), "schemarr-typescript-extract");

export const createProgram = (
	sourceFilePath: string,
): Result<ts.Program, Error> => {
	try {
		const program = ts.createProgram([sourceFilePath], {
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			skipLibCheck: true,
			strict: true,
			lib: ["lib.esnext.d.ts"],
			declaration: true,
			outDir: tempDir,
		});

		return ok(program);
	} catch (error) {
		return err(error instanceof Error ? error : new Error(String(error)));
	}
};

export const extractTypeDefinitions = (
	program: ts.Program,
	sourceFile: ts.SourceFile,
): string => {
	// Create temp directory
	if (!fs.existsSync(tempDir)) {
		fs.mkdirSync(tempDir, { recursive: true });
	}

	// Emit declarations
	const emitResult = program.emit();

	if (emitResult.emitSkipped || emitResult.diagnostics.length > 0) {
		throw new Error("TypeScript emit failed");
	}

	// Read the generated .d.ts file
	const sourceFileName = path.basename(sourceFile.fileName, ".ts");
	const dtsFilePath = path.join(tempDir, `${sourceFileName}.d.ts`);

	if (!fs.existsSync(dtsFilePath)) {
		throw new Error(`No .d.ts file generated at ${dtsFilePath}`);
	}

	const declarationContent = fs.readFileSync(dtsFilePath, "utf-8");

	// Parse the .d.ts content
	const declarationFile = ts.createSourceFile(
		"temp.d.ts",
		declarationContent,
		ts.ScriptTarget.Latest,
	);

	// Extract only the z.infer type aliases, not the schema consts
	const typeDefinitions: string[] = [];

	ts.forEachChild(declarationFile, (node) => {
		if (ts.isTypeAliasDeclaration(node)) {
			const typeName = node.name.text;
			const typeDef = node.type.getText(declarationFile);

			// Skip zod imports and const declarations
			// Only include z.infer types
			if (typeDef.includes("z.infer")) {
				typeDefinitions.push(`export type ${typeName} = ${typeDef};`);
			}
		}
	});

	// Cleanup
	try {
		fs.unlinkSync(dtsFilePath);
	} catch {
		// Ignore cleanup errors
	}

	return typeDefinitions.join("\n\n");
};
