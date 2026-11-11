// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyStyle, bind, kebab, truthy } from "../../src/core/bind";

function dom(html: string): HTMLElement {
	const root = document.createElement("div");
	root.innerHTML = html;
	return root;
}

describe("bind", () => {
	it("fills fields by path and reports what changed", () => {
		const root = dom(`<h1 data-field="title">x</h1><b data-field="home.score">0</b>`);
		const changed = bind(root, { title: "Hello", home: { score: 3 } });
		expect(root.textContent).toBe("Hello3");
		expect(changed).toHaveLength(2);
		expect(bind(root, { title: "Hello", home: { score: 3 } })).toEqual([]);
	});

	it("falls back to the original markup when a field is missing", () => {
		const root = dom(`<h1 data-field="title">Placeholder</h1>`);
		bind(root, { title: "Set" });
		bind(root, {});
		expect(root.textContent).toBe("Placeholder");
	});

	it("binds attributes and CSS variables", () => {
		const root = dom(`<img data-attr-src="logo" src="default.png"><i data-var-team="color"></i>`);
		bind(root, { logo: "a.png", color: "red" });
		expect(root.querySelector("img")!.getAttribute("src")).toBe("a.png");
		expect(root.querySelector("i")!.style.getPropertyValue("--team")).toBe("red");
		bind(root, {});
		expect(root.querySelector("img")!.getAttribute("src")).toBe("default.png");
		expect(root.querySelector("i")!.style.getPropertyValue("--team")).toBe("");
	});

	it("toggles data-if, with negation", () => {
		const root = dom(`<p data-if="sub">a</p><p data-if="!sub">b</p>`);
		const [a, b] = root.querySelectorAll("p");
		bind(root, { sub: "yes" });
		expect([a.hidden, b.hidden]).toEqual([false, true]);
		bind(root, { sub: "false" });
		expect([a.hidden, b.hidden]).toEqual([true, false]);
	});

	it("repeats lists of strings and objects, scoped per item", () => {
		const root = dom(`
			<h1 data-field="title"></h1>
			<ul data-list="items"><template><li><b data-field="title"></b>:<i data-field="$number"></i></li></template></ul>
			<ol data-list="tags"><template><li data-field="."></li></template></ol>`);
		bind(root, { title: "Top", items: [{ title: "A" }, { title: "B" }], tags: ["x", "y", "z"] });
		expect(root.querySelector("h1")!.textContent).toBe("Top");
		expect(Array.from(root.querySelectorAll("ul li"), (li) => li.textContent)).toEqual(["A:1", "B:2"]);
		expect(Array.from(root.querySelectorAll("ol li"), (li) => li.textContent)).toEqual(["x", "y", "z"]);

		bind(root, { title: "Top", items: [{ title: "C" }], tags: [] });
		expect(root.querySelectorAll("ul li")).toHaveLength(1);
		expect(root.querySelectorAll("ol li")).toHaveLength(0);
	});

	it("binds nested lists without leaking scopes", () => {
		const root = dom(`<div data-list="groups"><template><section><h2 data-field="name"></h2>
			<ul data-list="people"><template><li data-field="."></li></template></ul></section></template></div>`);
		bind(root, { name: "outer", groups: [{ name: "G1", people: ["a", "b"] }, { name: "G2", people: ["c"] }] });
		expect(Array.from(root.querySelectorAll("h2"), (h) => h.textContent)).toEqual(["G1", "G2"]);
		expect(Array.from(root.querySelectorAll("li"), (li) => li.textContent)).toEqual(["a", "b", "c"]);
	});
});

describe("style", () => {
	it("exposes style keys as CSS variables and attributes on the root", () => {
		const root = document.createElement("main");
		applyStyle(root, { primaryColor: "#d60000", position: "left" });
		expect(root.style.getPropertyValue("--primary-color")).toBe("#d60000");
		expect(root.getAttribute("data-style-position")).toBe("left");
	});

	it("kebab-cases keys", () => {
		expect(kebab("primaryColor")).toBe("primary-color");
		expect(kebab("subtitle_color")).toBe("subtitle-color");
		expect(kebab("accent")).toBe("accent");
	});

	it("treats XML-ish strings sensibly", () => {
		expect([truthy("false"), truthy(""), truthy("0"), truthy([]), truthy(0), truthy("x")]).toEqual([
			false,
			false,
			true,
			false,
			false,
			true,
		]);
	});
});
