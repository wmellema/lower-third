import { applyStyle, bind } from "./bind";
import { parsePayload } from "./parse";
import type {
	Animation,
	CommandDetail,
	Context,
	Data,
	GraphicDefinition,
	State,
	StateDetail,
} from "./types";

/**
 * The runtime behind a template. Every command goes through one serial queue,
 * so a NEXT that arrives mid-animation waits for the animation instead of
 * overlapping it.
 */
export class Graphic<D extends Data = Data> {
	readonly root: HTMLElement;
	readonly ctx: Context<D>;
	state: State = "idle";
	steps: D[] = [];
	step = 0;
	style: Record<string, string>;

	private queue: Promise<void> = Promise.resolve();

	constructor(readonly definition: GraphicDefinition<D>) {
		this.root = resolveRoot(definition.root);
		this.style = { ...definition.style };
		this.ctx = this.createContext();
		applyStyle(this.root, this.style);
		this.setState("idle");
		this.render();
		try {
			definition.setup?.(this.ctx);
		} catch (e) {
			this.fail("setup", e);
		}
	}

	get actions(): string[] {
		return Object.keys(this.definition.actions ?? {});
	}

	get data(): D {
		const defaults: Data = {};
		for (const [key, field] of Object.entries(this.definition.fields ?? {})) {
			if (field.default !== undefined) defaults[key] = field.default;
		}
		return { ...defaults, ...this.steps[this.step] } as D;
	}

	update(raw: unknown): Promise<void> {
		let parsed: ReturnType<typeof parsePayload>;
		try {
			parsed = parsePayload(raw);
		} catch (e) {
			this.fail("update", e);
			return this.queue;
		}
		return this.command({ name: "update", format: parsed.format }, async () => {
			if (parsed.style) {
				Object.assign(this.style, parsed.style);
				applyStyle(this.root, this.style);
			}
			if (!parsed.steps) return;
			const previous = this.data;
			this.steps = parsed.steps as D[];
			if (this.state === "idle") {
				this.step = 0;
				this.render();
			} else {
				this.step = Math.min(this.step, Math.max(this.steps.length - 1, 0));
				if (this.definition.update) await this.definition.update(this.ctx, previous);
				else this.render();
			}
			this.emitState();
		});
	}

	play(): Promise<void> {
		return this.command({ name: "play" }, () => this.animateIn());
	}

	next(): Promise<void> {
		return this.command({ name: "next" }, async () => {
			if (this.state === "idle") return this.animateIn();
			if (this.definition.next) {
				await this.run(this.definition.next);
				return;
			}
			const last = this.steps.length - 1;
			if (this.step >= last && !this.definition.loop) {
				this.ctx.log("next: no more steps");
				return;
			}
			await this.animateOut();
			this.step = this.step >= last ? 0 : this.step + 1;
			await this.animateIn();
		});
	}

	stop(): Promise<void> {
		return this.command({ name: "stop" }, () => this.animateOut());
	}

	remove(): Promise<void> {
		return this.command({ name: "remove" }, async () => {
			await this.animateOut();
			this.step = 0;
			this.render();
		});
	}

	/** Back to the first step; animates through out/in when on air. */
	reset(): Promise<void> {
		return this.command({ name: "reset" }, async () => {
			if (this.state === "idle") return this.ctx.goTo(0);
			await this.animateOut();
			this.step = 0;
			await this.animateIn();
		});
	}

	invoke(name: string, ...args: unknown[]): Promise<void> {
		return this.command({ name, args }, async () => {
			const action = this.definition.actions?.[name];
			if (!action) throw new Error(`Unknown action "${name}"`);
			await action(this.ctx, ...args);
		});
	}

	render(data: Data = this.data): Element[] {
		return bind(this.root, data);
	}

	private async animateIn(): Promise<void> {
		if (this.state === "on") return this.ctx.log("play: already on air");
		const missing = Object.entries(this.definition.fields ?? {})
			.filter(([key, field]) => field.required && isEmpty(this.data[key]))
			.map(([key]) => key);
		if (missing.length) throw new Error(`Missing required field(s): ${missing.join(", ")}`);
		this.render();
		this.setState("in");
		try {
			await this.run(this.definition.in);
		} finally {
			this.setState("on");
		}
	}

	private async animateOut(): Promise<void> {
		if (this.state !== "on") return this.ctx.log("stop: not on air");
		this.setState("out");
		try {
			await this.run(this.definition.out);
		} finally {
			this.setState("idle");
		}
	}

	private async run(hook: ((ctx: Context<D>) => Animation) | undefined): Promise<void> {
		await hook?.(this.ctx);
	}

	private command(detail: CommandDetail, job: () => Promise<void> | void): Promise<void> {
		this.emit("tally:command", detail);
		this.queue = this.queue.then(job).catch((e) => this.fail(detail.name, e));
		return this.queue;
	}

	private setState(state: State): void {
		this.state = state;
		this.root.setAttribute("data-tally-state", state);
		this.emitState();
	}

	private emitState(): void {
		this.root.setAttribute("data-step", String(this.step));
		this.emit<StateDetail>("tally:state", {
			state: this.state,
			step: this.step,
			steps: this.steps.length,
		});
	}

	private emit<T>(type: string, detail: T): void {
		window.dispatchEvent(new CustomEvent(type, { detail }));
	}

	private fail(name: string, error: unknown): void {
		console.error(`[tally] ${name} failed:`, error);
		this.emit("tally:error", { name, message: error instanceof Error ? error.message : String(error) });
	}

	private createContext(): Context<D> {
		const graphic = this;
		return {
			get root() {
				return graphic.root;
			},
			get data() {
				return graphic.data;
			},
			get steps() {
				return graphic.steps;
			},
			get step() {
				return graphic.step;
			},
			get style() {
				return graphic.style;
			},
			get state() {
				return graphic.state;
			},
			$: (selector) => graphic.root.querySelector(selector),
			$$: (selector) => Array.from(graphic.root.querySelectorAll(selector)),
			render: (data) => graphic.render(data),
			setData(patch) {
				graphic.steps[graphic.step] = { ...graphic.steps[graphic.step], ...patch } as D;
				return graphic.render();
			},
			goTo(step) {
				graphic.step = Math.max(0, Math.min(step, graphic.steps.length - 1));
				graphic.render();
				graphic.emitState();
			},
			log: (...args) => console.info("[tally]", ...args),
		};
	}
}

function resolveRoot(root: GraphicDefinition["root"]): HTMLElement {
	if (root instanceof HTMLElement) return root;
	const el = document.querySelector<HTMLElement>(root ?? "[data-graphic]") ?? (root ? null : document.body);
	if (!el) throw new Error(`[tally] root element "${root}" not found`);
	return el;
}

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length);
}
