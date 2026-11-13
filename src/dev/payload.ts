import { isObject } from "../core/parse";

/**
 * JSON -> the XML the official CasparCG Client sends. Nested keys and array
 * indexes become dotted ids ("home.score", "data.0.title"), which the core
 * parser turns back into the same structure.
 */
export function toXml(value: unknown): string {
	const entries: [string, unknown][] = [];
	flatten(value, "", entries);
	const components = entries
		.map(([id, v]) => `<componentData id="${escape(id)}"><data id="text" value="${escape(String(v))}"/></componentData>`)
		.join("");
	return `<templateData>${components}</templateData>`;
}

function flatten(value: unknown, prefix: string, out: [string, unknown][]): void {
	if (Array.isArray(value) || isObject(value)) {
		const pairs = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
		for (const [key, v] of pairs) flatten(v, prefix ? `${prefix}.${key}` : key, out);
		return;
	}
	if (prefix) out.push([prefix, value ?? ""]);
}

// Newlines and tabs are escaped too: XML would otherwise fold them into spaces.
function escape(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\n/g, "&#10;")
		.replace(/\r/g, "&#13;")
		.replace(/\t/g, "&#9;");
}

/** The AMCP line that loads and plays this template with this data. */
export function toAmcp(template: string, data: string, channel = "1-20", layer = 1): string {
	const quoted = data.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	return `CG ${channel} ADD ${layer} "${template}" 1 "${quoted}"`;
}
