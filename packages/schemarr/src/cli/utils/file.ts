import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";

export const readJsonFile = async (path: string): Promise<unknown> => {
	try {
		const content = await readFile(path, "utf-8");
		return JSON.parse(content);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to read file: ${error.message}`);
		}
		throw error;
	}
};

export const readFromStdin = (): Promise<unknown> =>
	new Promise((resolve, reject) => {
		const lines: string[] = [];
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: false,
		});

		rl.on("line", (line) => {
			lines.push(line);
		});

		rl.on("close", () => {
			try {
				const content = lines.join("\n");
				const parsed: unknown = JSON.parse(content);
				resolve(parsed);
			} catch (error) {
				if (error instanceof Error) {
					reject(error);
				} else {
					reject(new Error(String(error)));
				}
			}
		});

		rl.on("error", (err: Error) => {
			reject(err);
		});
	});

export const readInput = async (path?: string): Promise<unknown> => {
	if (path !== undefined && path.length > 0 && path !== "-") {
		return await readJsonFile(path);
	}
	return await readFromStdin();
};
