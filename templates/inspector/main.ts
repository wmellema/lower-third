import "tally/base.css";
import "../_shared/brand.css";
import "./style.scss";
import { gsap } from "gsap";
import { defineGraphic, type CommandDetail, type Context, type StateDetail } from "tally";

interface Inspector {
	title?: string;
	note?: string;
	[key: string]: unknown;
}

interface LogEntry {
	time: string;
	name: string;
	detail: string;
}

const log: LogEntry[] = [];
let format = "none";

function preview(value: unknown): string {
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return text.length > 42 ? `${text.slice(0, 41)}…` : text;
}

// Derived values ($-prefixed) are rendered alongside the payload.
function draw(ctx: Context<Inspector>): void {
	ctx.$$("[data-node]").forEach((li) => li.classList.toggle("active", li.dataset.node === ctx.state));
	ctx.render({
		...ctx.data,
		$format: format,
		$step: ctx.steps.length > 1 ? `step ${ctx.step + 1} of ${ctx.steps.length}` : "",
		$entries: Object.entries(ctx.steps[ctx.step] ?? {}).map(([key, value]) => ({ key, value: preview(value) })),
		$log: log,
	});
}

defineGraphic<Inspector>({
	fields: {
		title: { label: "Title" },
		note: { label: "Footnote" },
	},

	setup(ctx) {
		window.addEventListener("tally:command", (e) => {
			const { name, args, format: f } = (e as CustomEvent<CommandDetail>).detail;
			if (f) format = f;
			const detail = f ? f.toUpperCase() : args?.length ? `(${args.map((a) => JSON.stringify(a)).join(", ")})` : "";
			log.unshift({ time: new Date().toLocaleTimeString("en-GB", { hour12: false }), name, detail });
			log.length = Math.min(log.length, 7);
			draw(ctx);
			const latest = ctx.$(".log li");
			if (latest) gsap.from(latest, { x: -16, opacity: 0, duration: 0.35, ease: "power2.out" });
		});
		window.addEventListener("tally:state", (e) => {
			draw(ctx);
			const node = ctx.$(`[data-node="${(e as CustomEvent<StateDetail>).detail.state}"]`);
			if (node) gsap.fromTo(node, { scale: 0.92 }, { scale: 1, duration: 0.4, ease: "back.out(3)" });
		});
	},

	in({ root, $$ }) {
		return gsap
			.timeline()
			.from(root, { xPercent: 110, duration: 0.7, ease: "expo.out" })
			.from($$(".inspector > *"), { x: 30, opacity: 0, stagger: 0.05, duration: 0.4 }, 0.2);
	},

	out({ root }) {
		return gsap.to(root, {
			xPercent: 110,
			duration: 0.6,
			ease: "expo.in",
			onComplete: () => gsap.set(root, { clearProps: "transform" }),
		});
	},

	actions: {
		ping({ $ }) {
			return gsap.fromTo($(".head .tally-light"), { scale: 2.4 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" });
		},
	},
});
