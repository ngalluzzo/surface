export const normalizeTs = (ts: string): string => {
	return ts
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.join("\n");
};
