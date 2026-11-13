export type State = "idle" | "in" | "on" | "out";

export type Data = Record<string, any>;

// Anything a hook may return. GSAP timelines are thenables, so they can be
// returned directly and the runtime waits for them to finish.
export type Animation = void | { then(onFulfilled: (value: any) => unknown): unknown };

export interface FieldSpec {
	label?: string;
	type?: "text" | "number" | "boolean" | "color" | "image" | "list" | "object";
	default?: unknown;
	required?: boolean;
}

export interface Context<D extends Data = Data> {
	readonly root: HTMLElement;
	/** The current step's data, merged over field defaults. */
	readonly data: D;
	readonly steps: readonly D[];
	readonly step: number;
	readonly style: Readonly<Record<string, string>>;
	readonly state: State;
	$<E extends Element = HTMLElement>(selector: string): E | null;
	$$<E extends Element = HTMLElement>(selector: string): E[];
	/** Writes data into the DOM bindings. Returns the elements whose content changed. */
	render(data?: Data): Element[];
	/** Merges a patch into the current step's data and renders it. */
	setData(patch: Partial<D>): Element[];
	/** Jumps to a step without animating and renders it. */
	goTo(step: number): void;
	log(...args: unknown[]): void;
}

export interface GraphicDefinition<D extends Data = Data> {
	/** Element (or selector) that holds the graphic. Defaults to `[data-graphic]`, then `<body>`. */
	root?: string | HTMLElement;
	fields?: Record<string, FieldSpec>;
	/** Default style values, exposed as CSS custom properties on the root. */
	style?: Record<string, string>;
	/** Wrap around to the first step when `next()` runs past the last one. */
	loop?: boolean;
	setup?(ctx: Context<D>): void;
	in?(ctx: Context<D>): Animation;
	out?(ctx: Context<D>): Animation;
	/** Replaces the default step advance (out, next step, in). */
	next?(ctx: Context<D>): Animation;
	/** Runs when data arrives while on air. Defaults to `ctx.render()`. */
	update?(ctx: Context<D>, previous: D): Animation;
	/** Functions callable through `CG INVOKE`, exposed on `window` by name. */
	actions?: Record<string, (ctx: Context<D>, ...args: any[]) => Animation>;
}

export interface CommandDetail {
	name: string;
	args?: unknown[];
	format?: string;
}

export interface StateDetail {
	state: State;
	step: number;
	steps: number;
}
