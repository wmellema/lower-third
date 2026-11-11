import "../../templates/_shared/brand.css";
import "./harness.css";
import { toAmcp, toXml } from "./payload";

interface Preview {
	title: string;
	description?: string;
	samples?: { label: string; data: unknown }[];
	actions?: { label: string; call: string }[];
}

type TemplateWindow = Window & {
	tally?: { actions: string[]; state: string; step: number; steps: unknown[] };
};

// The globals a template exposes for CasparCG: update, play, next, stop, remove, actions.
const command = (win: TemplateWindow, name: string) =>
	(win as unknown as Record<string, unknown>)[name] as ((...args: unknown[]) => unknown) | undefined;

const previews = import.meta.glob<Preview>("/templates/*/preview.json", { eager: true, import: "default" });
const templates = Object.entries(previews)
	.map(([path, preview]) => ({ name: path.split("/")[2], ...preview }))
	.sort((a, b) => a.title.localeCompare(b.title));

const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const frame = $<HTMLIFrameElement>("frame");
const stage = $("stage");
const payload = $<HTMLTextAreaElement>("payload");
const log = $<HTMLOListElement>("log");

let current = templates[0];
let loaded: Promise<TemplateWindow> = Promise.resolve(window as unknown as TemplateWindow);

// --- Template list -------------------------------------------------------

const nav = $("templates");
for (const t of templates) {
	const link = document.createElement("a");
	link.href = `#${t.name}`;
	link.dataset.name = t.name;
	link.innerHTML = `<strong></strong><span class="muted"></span>`;
	link.querySelector("strong")!.textContent = t.title;
	link.querySelector("span")!.textContent = t.name;
	nav.append(link);
}

function select(name: string): void {
	current = templates.find((t) => t.name === name) ?? templates[0];
	nav.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.name === current.name));
	$("title").textContent = current.title;
	$("description").textContent = current.description ?? "";
	$<HTMLAnchorElement>("open").href = src();

	const samples = $("samples");
	samples.replaceChildren();
	(current.samples ?? []).forEach((sample, i) => {
		const chip = chipButton(sample.label, () => setPayload(sample.data, chip));
		samples.append(chip);
		if (i === 0) setPayload(sample.data, chip);
	});
	if (!current.samples?.length) setPayload({});

	reload();
}

window.addEventListener("hashchange", () => select(location.hash.slice(1)));

// --- Frame ---------------------------------------------------------------

const src = () => `/templates/${current.name}/index.html`;

function reload(): Promise<TemplateWindow> {
	setState("idle", 0, 0);
	loaded = new Promise((resolve) => {
		frame.addEventListener(
			"load",
			() => {
				const win = frame.contentWindow as TemplateWindow;
				hook(win);
				renderActions(win);
				resolve(win);
			},
			{ once: true },
		);
	});
	frame.src = `${src()}?t=${Date.now()}`;
	return loaded;
}

function hook(win: TemplateWindow): void {
	win.addEventListener("tally:state", (e) => {
		const { state, step, steps } = (e as CustomEvent).detail;
		setState(state, step, steps);
	});
	win.addEventListener("tally:error", (e) => write("error", `${(e as CustomEvent).detail.name}: ${(e as CustomEvent).detail.message}`));
	const console = (win as unknown as { console: Console }).console;
	const error = console.error.bind(console);
	console.error = (...args: unknown[]) => {
		error(...args);
		if (!String(args[0]).startsWith("[tally]")) write("error", args.map(String).join(" "));
	};
	win.addEventListener("error", (e) => write("error", e.message));
	if (!win.tally) write("error", "This page did not call defineGraphic()");
}

function fit(): void {
	const scale = stage.clientWidth / 1920;
	frame.style.transform = `scale(${scale})`;
	stage.style.height = `${1080 * scale}px`;
}
new ResizeObserver(fit).observe(stage);

// --- Commands, sent the way CasparCG sends them ----------------------------

async function send(cmd: string): Promise<void> {
	if (cmd === "add") {
		const data = encoded();
		if (data === null) return;
		write("cmd", "ADD (reload, update, play)");
		const win = await reload();
		command(win, "update")?.(data);
		command(win, "play")?.();
		return;
	}
	const fn = command(await loaded, cmd);
	if (!fn) return write("error", `Template has no ${cmd}()`);
	if (cmd === "update") {
		const data = encoded();
		if (data === null) return;
		write("cmd", `UPDATE (${format()})`);
		fn(data);
		return;
	}
	write("cmd", cmd.toUpperCase());
	fn();
}

// CG INVOKE appends "()" unless the label already ends in ")".
async function invoke(label: string): Promise<void> {
	const call = label.trim().endsWith(")") ? label.trim() : `${label.trim()}()`;
	write("cmd", `INVOKE ${call}`);
	const win = await loaded;
	try {
		(win as unknown as { eval(code: string): unknown }).eval(call);
	} catch (e) {
		write("error", String(e));
	}
}

document.querySelectorAll<HTMLButtonElement>("[data-cmd]").forEach((b) =>
	b.addEventListener("click", () => send(b.dataset.cmd!)),
);

const keys: Record<string, string> = { a: "add", p: "play", n: "next", s: "stop", r: "remove", u: "update" };
document.addEventListener("keydown", (e) => {
	if (e.metaKey || e.ctrlKey || e.altKey) return;
	if ((e.target as HTMLElement).closest("input, textarea, select")) return;
	const cmd = keys[e.key.toLowerCase()];
	if (cmd) {
		e.preventDefault();
		send(cmd);
	}
});

// --- Payload editor --------------------------------------------------------

const format = () => (document.querySelector<HTMLInputElement>("[name=format]:checked")!.value as "json" | "xml");

function setPayload(data: unknown, chip?: HTMLElement): void {
	payload.value = JSON.stringify(data, null, 2);
	$("samples").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === chip));
	refreshAmcp();
}

function parsed(): unknown {
	try {
		const value = JSON.parse(payload.value || "{}");
		$("payload-error").textContent = "";
		return value;
	} catch (e) {
		$("payload-error").textContent = (e as Error).message;
		return undefined;
	}
}

// The string handed to update(): JSON text, or the CasparCG Client XML form.
function encoded(): string | null {
	const value = parsed();
	if (value === undefined) {
		write("error", "Fix the JSON before sending");
		return null;
	}
	return format() === "xml" ? toXml(value) : JSON.stringify(value);
}

function refreshAmcp(): void {
	const data = parsed();
	$("amcp").textContent =
		data === undefined ? "Invalid JSON" : toAmcp(current.name, format() === "xml" ? toXml(data) : JSON.stringify(data));
}

payload.addEventListener("input", refreshAmcp);
document.querySelectorAll("[name=format]").forEach((r) => r.addEventListener("change", refreshAmcp));
$("copy-amcp").addEventListener("click", () => navigator.clipboard.writeText($("amcp").textContent ?? ""));

// --- Actions -------------------------------------------------------------------

function renderActions(win: TemplateWindow): void {
	const actions = $("actions");
	actions.replaceChildren();
	const listed = current.actions ?? (win.tally?.actions ?? []).map((name) => ({ label: name, call: name }));
	for (const action of listed) actions.append(chipButton(action.label, () => invoke(action.call)));
	if (!listed.length) actions.innerHTML = `<span class="muted">This template has no actions.</span>`;
}

$("invoke-form").addEventListener("submit", (e) => {
	e.preventDefault();
	const input = $<HTMLInputElement>("invoke");
	if (input.value.trim()) invoke(input.value);
});

// --- Stage options, status, log -----------------------------------------------

$<HTMLSelectElement>("background").addEventListener("change", (e) => {
	stage.dataset.bg = (e.target as HTMLSelectElement).value;
});
$<HTMLInputElement>("safe").addEventListener("change", (e) => {
	stage.classList.toggle("no-safe", !(e.target as HTMLInputElement).checked);
});
$("reload").addEventListener("click", () => {
	write("info", "Reloaded");
	reload();
});
$("clear-log").addEventListener("click", () => log.replaceChildren());

function setState(state: string, step: number, steps: number): void {
	const pill = $("state");
	pill.textContent = state;
	pill.dataset.state = state;
	$("step").textContent = steps > 1 ? `step ${step + 1} / ${steps}` : "";
}

function write(kind: "cmd" | "error" | "info", text: string): void {
	const item = document.createElement("li");
	item.className = kind;
	const time = new Date().toLocaleTimeString([], { hour12: false });
	item.innerHTML = `<time></time><span></span>`;
	item.querySelector("time")!.textContent = time;
	item.querySelector("span")!.textContent = text;
	log.prepend(item);
	while (log.children.length > 200) log.lastElementChild!.remove();
}

function chipButton(label: string, onClick: () => void): HTMLButtonElement {
	const b = document.createElement("button");
	b.type = "button";
	b.textContent = label;
	b.addEventListener("click", onClick);
	return b;
}

select(location.hash.slice(1));
