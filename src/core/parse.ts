import type { Data } from "./types";

export type Format = "json" | "xml" | "object" | "empty";

export interface Parsed {
	format: Format;
	steps?: Data[];
	style?: Record<string, string>;
}

/**
 * Normalises whatever CasparCG hands to `update()` into steps and style.
 *
 * Accepted shapes (JSON or CasparCG Client XML):
 *   {"title": "…"}                         one step
 *   [{"title": "…"}, {"title": "…"}]       several steps
 *   {"data": {…} | […], "style": {…}}      explicit envelope
 * A top-level `style` object is always treated as style, never as a field.
 */
export function parsePayload(raw: unknown): Parsed {
	if (raw === null || raw === undefined) return { format: "empty" };
	if (typeof raw !== "string") return normalize(raw, "object");
	const text = raw.trim();
	if (!text) return { format: "empty" };
	if (text.startsWith("<")) return normalize(parseXml(text), "xml");
	return normalize(JSON.parse(text), "json");
}

function normalize(value: unknown, format: Format): Parsed {
	if (Array.isArray(value)) return { format, steps: value.map(asStep) };
	if (!isObject(value)) throw new Error("Template data must be an object or an array");

	const { style, ...rest } = value;
	const result: Parsed = { format };
	if (isObject(style)) {
		result.style = Object.fromEntries(Object.entries(style).map(([k, v]) => [k, String(v)]));
	} else if (style !== undefined) {
		rest.style = style;
	}

	if ("data" in rest) {
		const data = rest.data;
		result.steps = Array.isArray(data) ? data.map(asStep) : [asStep(data)];
	} else if (Object.keys(rest).length) {
		result.steps = [rest];
	}
	return result;
}

function asStep(value: unknown): Data {
	if (isObject(value)) return value;
	throw new Error("Each step must be an object");
}

export function isObject(value: unknown): value is Data {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

// <templateData><componentData id="f0"><data id="text" value="…"/></componentData></templateData>
// A component with a single `text` value becomes a string; otherwise each <data>
// becomes a property. Dotted ids ("home.score", "items.0.title") nest, and ids
// that start with an index ("0.title", "1.title") make a list of steps.
function parseXml(text: string): Data | Data[] {
	const doc = new DOMParser().parseFromString(text, "application/xml");
	if (doc.getElementsByTagName("parsererror").length) throw new Error("Invalid XML template data");

	const out: Data = {};
	for (const component of Array.from(doc.getElementsByTagName("componentData"))) {
		const id = component.getAttribute("id");
		if (!id) continue;
		const values = Array.from(component.children).filter((c) => c.localName === "data");
		if (values.length === 1 && values[0].getAttribute("id") === "text") {
			setPath(out, id, values[0].getAttribute("value") ?? "");
			continue;
		}
		for (const value of values) {
			setPath(out, `${id}.${value.getAttribute("id")}`, value.getAttribute("value") ?? "");
		}
	}
	const keys = Object.keys(out);
	return keys.length && keys.every((k) => /^\d+$/.test(k)) ? keys.map((k) => out[k]) : out;
}

export function setPath(target: Data, path: string, value: unknown): void {
	const keys = path.split(".");
	let node: Data = target;
	keys.slice(0, -1).forEach((key, i) => {
		if (!isObject(node[key]) && !Array.isArray(node[key])) {
			node[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
		}
		node = node[key];
	});
	node[keys[keys.length - 1]] = value;
}

export function getPath(source: unknown, path: string): unknown {
	let node = source;
	for (const key of path.split(".")) {
		if (node === null || node === undefined) return undefined;
		node = (node as Data)[key];
	}
	return node;
}
