import { describe, expect, test } from "bun:test";
import { withAbortRace } from "../../src/execution/with-abort-race.js";

describe("withAbortRace", () => {
	test("no timeout and no signal returns runPromise result", async () => {
		const runPromise = Promise.resolve({
			ok: true as const,
			value: 42,
		});
		const result = await withAbortRace(runPromise, null, undefined, 0);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(42);
	});

	test("timeout wins when run exceeds timeout", async () => {
		const runPromise = new Promise<{ ok: true; value: number }>((r) =>
			setTimeout(() => r({ ok: true, value: 1 }), 200),
		);
		const controller = new AbortController();
		const result = await withAbortRace(runPromise, controller, undefined, 50);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.phase).toBe("timeout");
			if (result.error.phase === "timeout")
				expect(result.error.timeoutMs).toBe(50);
		}
	});

	test("run wins when it completes before timeout", async () => {
		const runPromise = Promise.resolve({
			ok: true as const,
			value: "done",
		});
		const controller = new AbortController();
		const result = await withAbortRace(runPromise, controller, undefined, 500);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe("done");
	});

	test("external abort wins", async () => {
		const runPromise = new Promise<{ ok: true; value: number }>((r) =>
			setTimeout(() => r({ ok: true, value: 1 }), 200),
		);
		const controller = new AbortController();
		const _externalSignal = new AbortController().signal;
		const abortController = new AbortController();
		abortController.abort();
		const result = await withAbortRace(
			runPromise,
			controller,
			abortController.signal,
			0,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.phase).toBe("aborted");
	});

	test("external signal that aborts during run returns aborted", async () => {
		const externalAc = new AbortController();
		const runPromise = new Promise<{ ok: true; value: number }>((r) =>
			setTimeout(() => r({ ok: true, value: 1 }), 200),
		);
		const resultPromise = withAbortRace(runPromise, null, externalAc.signal, 0);
		externalAc.abort();
		const result = await resultPromise;
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.phase).toBe("aborted");
	});
});
