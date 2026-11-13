// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parsePayload } from "../../src/core/parse";
import { toXml } from "../../src/dev/payload";

describe("parsePayload", () => {
	it("treats a plain object as one step", () => {
		expect(parsePayload('{"title":"Hi"}')).toEqual({ format: "json", steps: [{ title: "Hi" }] });
	});

	it("treats an array as steps", () => {
		expect(parsePayload('[{"a":1},{"a":2}]').steps).toEqual([{ a: 1 }, { a: 2 }]);
	});

	it("reads the data/style envelope", () => {
		const parsed = parsePayload('{"style":{"primaryColor":"#f00","size":2},"data":[{"t":1}]}');
		expect(parsed.style).toEqual({ primaryColor: "#f00", size: "2" });
		expect(parsed.steps).toEqual([{ t: 1 }]);
	});

	it("allows a style-only update", () => {
		expect(parsePayload('{"style":{"accent":"blue"}}')).toEqual({ format: "json", style: { accent: "blue" } });
	});

	it("keeps a non-object style as a field", () => {
		expect(parsePayload('{"style":"bold"}').steps).toEqual([{ style: "bold" }]);
	});

	it("ignores empty input", () => {
		expect(parsePayload("")).toEqual({ format: "empty" });
		expect(parsePayload("   ")).toEqual({ format: "empty" });
		expect(parsePayload(undefined)).toEqual({ format: "empty" });
	});

	it("rejects invalid input", () => {
		expect(() => parsePayload("{nope")).toThrow();
		expect(() => parsePayload('"text"')).toThrow(/object or an array/);
		expect(() => parsePayload("[1]")).toThrow(/step must be an object/);
		expect(() => parsePayload("<templateData>")).toThrow(/Invalid XML/);
	});

	it("reads CasparCG Client XML", () => {
		const xml = `<templateData>
			<componentData id="f0"><data id="text" value="Jane Doe"/></componentData>
			<componentData id="f1"><data id="text" value="Director &amp; host"/></componentData>
		</templateData>`;
		expect(parsePayload(xml)).toEqual({ format: "xml", steps: [{ f0: "Jane Doe", f1: "Director & host" }] });
	});

	it("nests dotted XML ids and builds arrays from indexes", () => {
		const xml = `<templateData>
			<componentData id="home.score"><data id="text" value="3"/></componentData>
			<componentData id="items.0"><data id="text" value="a"/></componentData>
			<componentData id="items.1"><data id="text" value="b"/></componentData>
			<componentData id="style.accent"><data id="text" value="red"/></componentData>
		</templateData>`;
		expect(parsePayload(xml)).toEqual({
			format: "xml",
			steps: [{ home: { score: "3" }, items: ["a", "b"] }],
			style: { accent: "red" },
		});
	});

	it("maps several <data> children to properties", () => {
		const xml = `<templateData><componentData id="logo"><data id="src" value="a.png"/><data id="alt" value="A"/></componentData></templateData>`;
		expect(parsePayload(xml).steps).toEqual([{ logo: { src: "a.png", alt: "A" } }]);
	});

	it("reads a top-level list of steps", () => {
		const xml = `<templateData>
			<componentData id="0.title"><data id="text" value="One"/></componentData>
			<componentData id="1.title"><data id="text" value="Two"/></componentData>
		</templateData>`;
		expect(parsePayload(xml).steps).toEqual([{ title: "One" }, { title: "Two" }]);
	});

	it("round-trips through the harness XML encoder", () => {
		const payload = { style: { accent: "#fff" }, data: [{ title: 'Say "hi"', tags: ["x", "y"] }, { title: "<b>\n\tline" }] };
		const parsed = parsePayload(toXml(payload));
		expect(parsed.style).toEqual({ accent: "#fff" });
		expect(parsed.steps).toEqual(payload.data);
		expect(parsePayload(toXml(payload.data)).steps).toEqual(payload.data);
	});
});
