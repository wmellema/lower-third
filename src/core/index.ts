import { Graphic } from "./graphic";
import type { Data, GraphicDefinition } from "./types";

export { Graphic } from "./graphic";
export { bind, kebab, truthy } from "./bind";
export { parsePayload, getPath, setPath } from "./parse";
export type * from "./types";

const COMMANDS = ["update", "play", "next", "stop", "remove", "reset", "invoke"] as const;

declare global {
	interface Window {
		tally?: Graphic;
	}
}

/**
 * Turns the page into a CasparCG template. CasparCG calls the global
 * functions update/play/next/stop/remove, and `CG INVOKE <name>` calls
 * `<name>()`, so every action is exposed on `window` as well.
 */
export function defineGraphic<D extends Data = Data>(definition: GraphicDefinition<D>): Graphic<D> {
	if (window.tally) console.warn("[tally] defineGraphic() called twice; the last call wins");
	const graphic = new Graphic(definition);
	const globals = window as unknown as Record<string, unknown>;

	globals.update = (raw: unknown) => graphic.update(raw);
	globals.play = () => graphic.play();
	globals.next = () => graphic.next();
	globals.stop = () => graphic.stop();
	globals.remove = () => graphic.remove();
	globals.reset = () => graphic.reset();
	globals.invoke = (name: string, ...args: unknown[]) => graphic.invoke(name, ...args);

	for (const name of graphic.actions) {
		if ((COMMANDS as readonly string[]).includes(name)) {
			console.warn(`[tally] action "${name}" clashes with a built-in command; call it via invoke("${name}")`);
			continue;
		}
		if (name in window) console.warn(`[tally] action "${name}" shadows window.${name}`);
		globals[name] = (...args: unknown[]) => graphic.invoke(name, ...args);
	}

	window.tally = graphic as unknown as Graphic;
	return graphic;
}
