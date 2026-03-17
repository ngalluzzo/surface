import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { createProgram, extractTypeDefinitions } from "../extractTypes";

describe("TypeScript type extraction", () => {
	const tempDir = path.join(process.cwd(), "tmp");

	const setupTempFile = (content: string): string => {
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}
		const filePath = path.join(tempDir, `test-${Date.now()}.ts`);
		fs.writeFileSync(filePath, content, "utf-8");
		return filePath;
	};

	const cleanupTempFile = (filePath: string): void => {
		try {
			fs.unlinkSync(filePath);
		} catch {
			// Ignore cleanup errors
		}
	};

	test("extracts type definitions from zod code", () => {
		const zodCode = `
      import { z } from "zod";
      export const userSchema = z.object({
        id: z.uuid(),
        email: z.string(),
      });
      export type User = z.infer<typeof userSchema>;
    `;

		const filePath = setupTempFile(zodCode);

		try {
			const programResult = createProgram(filePath);
			expect(programResult.kind).toBe("ok");

			if (programResult.kind === "ok") {
				const sourceFile = programResult.value.getSourceFile(filePath);
				expect(sourceFile).toBeDefined();

				if (sourceFile) {
					const result = extractTypeDefinitions(
						programResult.value,
						sourceFile,
					);

					// TypeScript doesn't expand z.infer, so we get the raw type
					expect(result).toContain(
						"export type User = z.infer<typeof userSchema>;",
					);
				}
			}
		} finally {
			cleanupTempFile(filePath);
		}
	});

	test("handles multiple type definitions", () => {
		const zodCode = `
      import { z } from "zod";
      export const statusSchema = z.enum(['open', 'closed']);
      export type Status = z.infer<typeof statusSchema>;
      export const postSchema = z.object({ title: z.string() });
      export type Post = z.infer<typeof postSchema>;
    `;

		const filePath = setupTempFile(zodCode);

		try {
			const programResult = createProgram(filePath);
			expect(programResult.kind).toBe("ok");

			if (programResult.kind === "ok") {
				const sourceFile = programResult.value.getSourceFile(filePath);
				expect(sourceFile).toBeDefined();

				if (sourceFile) {
					const result = extractTypeDefinitions(
						programResult.value,
						sourceFile,
					);

					expect(result).toContain(
						"export type Status = z.infer<typeof statusSchema>;",
					);
					expect(result).toContain(
						"export type Post = z.infer<typeof postSchema>;",
					);
				}
			}
		} finally {
			cleanupTempFile(filePath);
		}
	});
});
