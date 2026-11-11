import { getPath, isObject } from "./parse";

const ITEM = "data-list-item";

// The markup a template ships with acts as the fallback for missing data.
const originalText = new WeakMap<Element, string>();
const originalAttrs = new WeakMap<Element, Map<string, string | null>>();

/**
 * Writes data into the DOM under `root`:
 *   data-field="home.score"   text content
 *   data-attr-src="logo"      any attribute (here: src)
 *   data-var-team="home.color" a CSS custom property on the element (here: --team)
 *   data-if="subtitle"        hidden unless truthy; "!subtitle" negates
 *   data-list="items"         repeats the element's <template> per item;
 *                             inside, "." is the item and "$index"/"$number" its position
 * Returns the elements whose content changed, so templates can animate them.
 */
export function bind(root: Element, data: unknown): Element[] {
	const changed: Element[] = [];
	for (const el of scoped(root, "[data-list]")) bindList(el as HTMLElement, data, changed);
	for (const el of scoped(root, "[data-field]")) {
		setText(el, lookup(data, (el as HTMLElement).dataset.field!), changed);
	}
	for (const el of scoped(root, "*")) {
		for (const { name, value } of Array.from(el.attributes)) {
			if (name.startsWith("data-attr-")) setAttr(el, name.slice(10), lookup(data, value), changed);
			if (name.startsWith("data-var-")) setVar(el as HTMLElement, name.slice(9), lookup(data, value));
		}
	}
	for (const el of scoped(root, "[data-if]")) {
		const expr = (el as HTMLElement).dataset.if!;
		const negate = expr.startsWith("!");
		const show = truthy(lookup(data, negate ? expr.slice(1) : expr)) !== negate;
		(el as HTMLElement).hidden = !show;
	}
	return changed;
}

// Elements that belong to this scope: not inside a list item rendered by a nested list.
function scoped(root: Element, selector: string): Element[] {
	const found = Array.from(root.querySelectorAll(selector)).filter((el) => {
		if (el.hasAttribute(ITEM)) return false;
		const item = el.parentElement?.closest(`[${ITEM}]`);
		return !item || item === root || !root.contains(item);
	});
	return root.matches(selector) ? [root, ...found] : found;
}

function bindList(el: HTMLElement, data: unknown, changed: Element[]): void {
	const template = el.querySelector(":scope > template") as HTMLTemplateElement | null;
	if (!template) {
		console.warn("[tally] data-list needs a <template> child", el);
		return;
	}
	const value = lookup(data, el.dataset.list!);
	const items = Array.isArray(value) ? value : [];
	el.querySelectorAll(`:scope > [${ITEM}]`).forEach((node) => node.remove());
	items.forEach((item, index) => {
		const node = template.content.firstElementChild?.cloneNode(true) as Element | undefined;
		if (!node) return;
		node.setAttribute(ITEM, String(index));
		const scope = isObject(item) ? { ...item, $value: item } : { $value: item };
		bind(node, { ...scope, $index: index, $number: index + 1 });
		el.appendChild(node);
		changed.push(node);
	});
}

function lookup(data: unknown, path: string): unknown {
	if (path === ".") return (data as { $value?: unknown })?.$value ?? data;
	return getPath(data, path);
}

function setText(el: Element, value: unknown, changed: Element[]): void {
	if (!originalText.has(el)) originalText.set(el, el.textContent ?? "");
	const text = value === undefined || value === null ? originalText.get(el)! : String(value);
	if (el.textContent === text) return;
	el.textContent = text;
	changed.push(el);
}

function setAttr(el: Element, name: string, value: unknown, changed: Element[]): void {
	let originals = originalAttrs.get(el);
	if (!originals) originalAttrs.set(el, (originals = new Map()));
	if (!originals.has(name)) originals.set(name, el.getAttribute(name));
	const next = value === undefined || value === null ? originals.get(name)! : String(value);
	if (el.getAttribute(name) === next) return;
	if (next === null) el.removeAttribute(name);
	else el.setAttribute(name, next);
	changed.push(el);
}

function setVar(el: HTMLElement, name: string, value: unknown): void {
	if (value === undefined || value === null || value === "") el.style.removeProperty(`--${name}`);
	else el.style.setProperty(`--${name}`, String(value));
}

export function truthy(value: unknown): boolean {
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === "string") return value !== "" && value.toLowerCase() !== "false";
	return Boolean(value);
}

export function applyStyle(root: HTMLElement, style: Record<string, string>): void {
	for (const [key, value] of Object.entries(style)) {
		const name = kebab(key);
		root.style.setProperty(`--${name}`, value);
		root.setAttribute(`data-style-${name}`, value);
	}
}

export function kebab(key: string): string {
	return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
}
