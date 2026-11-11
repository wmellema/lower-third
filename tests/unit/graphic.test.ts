// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineGraphic, Graphic, type GraphicDefinition } from "../../src/core/index";

// An animation the test finishes by hand, to observe what happens mid-animation.
function gate() {
	let open!: () => void;
	const promise = new Promise<void>((resolve) => (open = resolve));
	return { promise, open };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function make(def: Partial<GraphicDefinition> = {}) {
	document.body.innerHTML = `<main data-graphic><h1 data-field="title">Placeholder</h1></main>`;
	const calls: string[] = [];
	const graphic = new Graphic({
		in: () => void calls.push("in"),
		out: () => void calls.push("out"),
		...def,
	});
	return { graphic, calls, title: () => document.querySelector("h1")!.textContent };
}

describe("Graphic", () => {
	let errors: string[];
	const onError = (e: Event) => errors.push((e as CustomEvent).detail.message);

	beforeEach(() => {
		errors = [];
		window.addEventListener("tally:error", onError);
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "info").mockImplementation(() => {});
	});
	afterEach(() => {
		window.removeEventListener("tally:error", onError);
		vi.restoreAllMocks();
		delete window.tally;
	});

	it("runs the CasparCG lifecycle", async () => {
		const { graphic, calls, title } = make();
		expect(graphic.root.dataset.tallyState).toBe("idle");
		await graphic.update('{"title":"Hello"}');
		expect(title()).toBe("Hello");
		await graphic.play();
		expect(graphic.state).toBe("on");
		await graphic.stop();
		expect(graphic.state).toBe("idle");
		expect(calls).toEqual(["in", "out"]);
	});

	it("queues commands behind a running animation", async () => {
		const animation = gate();
		const { graphic, calls } = make({ in: () => animation.promise });
		graphic.update('[{"title":"One"},{"title":"Two"}]');
		graphic.play();
		const next = graphic.next();
		await flush();
		expect(graphic.state).toBe("in");
		expect(graphic.step).toBe(0);
		animation.open();
		await next;
		expect(graphic.step).toBe(1);
		expect(calls).toEqual(["out"]);
	});

	it("steps through data with next and stops at the end", async () => {
		const { graphic, title } = make();
		await graphic.update('[{"title":"One"},{"title":"Two"}]');
		await graphic.next(); // plays when idle
		expect(title()).toBe("One");
		await graphic.next();
		expect(title()).toBe("Two");
		await graphic.next();
		expect(title()).toBe("Two");
		await graphic.reset();
		expect([graphic.state, title()]).toEqual(["on", "One"]);
	});

	it("loops when asked to", async () => {
		const { graphic, title } = make({ loop: true });
		await graphic.update('[{"title":"One"},{"title":"Two"}]');
		await graphic.play();
		await graphic.next();
		await graphic.next();
		expect(title()).toBe("One");
	});

	it("uses the update hook on air and replaces data", async () => {
		const seen: unknown[] = [];
		const { graphic, title } = make({
			update: (ctx, previous) => {
				seen.push(previous.title);
				ctx.render();
			},
		});
		await graphic.update('{"title":"One"}');
		await graphic.play();
		await graphic.update('{"title":"Two"}');
		expect(seen).toEqual(["One"]);
		expect(title()).toBe("Two");
		await graphic.update("{}");
		expect(title()).toBe("Two");
	});

	it("refuses to play without required fields and reports why", async () => {
		const { graphic } = make({ fields: { title: { required: true } } });
		await graphic.play();
		expect(graphic.state).toBe("idle");
		expect(errors).toEqual(["Missing required field(s): title"]);
	});

	it("merges field defaults under the data", async () => {
		const { graphic } = make({ fields: { title: { default: "Default" }, size: { default: 2 } } });
		expect(graphic.data).toEqual({ title: "Default", size: 2 });
		await graphic.update('{"title":"Set"}');
		expect(graphic.data).toEqual({ title: "Set", size: 2 });
	});

	it("keeps going after a bad payload or a failing hook", async () => {
		const { graphic } = make({
			in: () => {
				throw new Error("boom");
			},
		});
		await graphic.update("{bad json");
		await graphic.play();
		expect(errors[0]).toMatch(/JSON/);
		expect(errors[1]).toBe("boom");
		expect(graphic.state).toBe("on");
		await graphic.stop();
		expect(graphic.state).toBe("idle");
	});

	it("ignores stop when nothing is on air", async () => {
		const { graphic, calls } = make();
		await graphic.stop();
		await graphic.remove();
		expect(calls).toEqual([]);
		expect(errors).toEqual([]);
	});

	it("applies style payloads as CSS variables", async () => {
		const { graphic } = make({ style: { accent: "red" } });
		expect(graphic.root.style.getPropertyValue("--accent")).toBe("red");
		await graphic.update('{"style":{"accent":"blue"}}');
		expect(graphic.root.style.getPropertyValue("--accent")).toBe("blue");
	});
});

describe("defineGraphic", () => {
	afterEach(() => delete window.tally);

	it("exposes the CasparCG globals and actions", async () => {
		document.body.innerHTML = `<main data-graphic><b data-field="n">0</b></main>`;
		const globals = window as unknown as Record<string, (...args: unknown[]) => Promise<void>>;
		defineGraphic({
			actions: {
				add: (ctx, by = 1) => void ctx.setData({ n: Number(ctx.data.n ?? 0) + Number(by) }),
			},
		});
		for (const name of ["update", "play", "next", "stop", "remove", "invoke", "add"]) {
			expect(typeof globals[name]).toBe("function");
		}
		await globals.update('{"n":1}');
		await globals.add(2);
		await globals.invoke("add");
		expect(document.querySelector("b")!.textContent).toBe("4");
		expect(window.tally!.actions).toEqual(["add"]);
	});
});
