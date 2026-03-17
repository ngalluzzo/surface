import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadZodFromFile } from "../loadZod";

describe("loadZodFromFile", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `schemarr-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("should reject non-.ts/.mts files", async () => {
		const schemaPath = join(tempDir, "schema.json");
		writeFileSync(schemaPath, "{}", "utf-8");

		const result = await loadZodFromFile(schemaPath);

		expect(result.kind).toBe("err");
		if (result.kind === "err") {
			expect(result.error.kind).toBe("zod_load_error");
			expect(result.error.message).toContain("must be a TypeScript file");
		}
	});

	it("should handle file load errors gracefully", async () => {
		const schemaPath = join(tempDir, "nonexistent.ts");

		const result = await loadZodFromFile(schemaPath);

		expect(result.kind).toBe("err");
		if (result.kind === "err") {
			expect(result.error.kind).toBe("zod_load_error");
			expect(result.error.message).toContain("Failed to load");
		}
	});

	it("should handle files with no exports", async () => {
		const schemaPath = join(tempDir, "schema.ts");
		const schemaContent = `
const someValue = 'not a schema';
`;
		writeFileSync(schemaPath, schemaContent, "utf-8");

		const result = await loadZodFromFile(schemaPath);

		expect(result.kind).toBe("err");
		if (result.kind === "err") {
			expect(result.error.kind).toBe("zod_load_error");
			expect(result.error.message).toContain("No exports found");
		}
	});

	it("should handle invalid TypeScript files", async () => {
		const schemaPath = join(tempDir, "schema.ts");
		const schemaContent = `
this is not valid typescript syntax
`;
		writeFileSync(schemaPath, schemaContent, "utf-8");

		const result = await loadZodFromFile(schemaPath);

		expect(result.kind).toBe("err");
		if (result.kind === "err") {
			expect(result.error.kind).toBe("zod_load_error");
			// Runtime may throw on import (e.g. "Failed to load") or load an empty/broken module
			expect(result.error.message.length).toBeGreaterThan(0);
			expect(
				result.error.message.includes("Failed to load") ||
					result.error.message.includes("No exports") ||
					result.error.message.includes("Parse") ||
					result.error.message.includes("Syntax") ||
					result.error.message.includes("invalid"),
			).toBe(true);
		}
	});
});
