import "tally/base.css";
import "../_shared/brand.css";
import "./style.scss";
import { gsap } from "gsap";
import { defineGraphic, type Context } from "tally";

interface Ticker {
	label: string;
	items: string[];
	speed: number | string;
}

let crawl: gsap.core.Tween | undefined;

// Duplicates the rendered items once and scrolls by exactly one set, so the
// loop is seamless. The clones carry data-list-item, so the next render
// clears them along with the originals.
function startCrawl({ $, $$, data }: Context<Ticker>): void {
	crawl?.kill();
	const list = $(".items")!;
	const items = $$(".items > li");
	if (!items.length) return;
	gsap.set(list, { x: 0 });
	items.forEach((item) => list.append(Object.assign(item.cloneNode(true), { ariaHidden: "true" })));
	const distance = list.scrollWidth / 2;
	crawl = gsap.to(list, {
		x: -distance,
		duration: distance / Number(data.speed),
		ease: "none",
		repeat: -1,
	});
}

defineGraphic<Ticker>({
	fields: {
		label: { label: "Label", default: "Tally" },
		items: { label: "Items", type: "list", required: true },
		speed: { label: "Speed (px/s at 1080p)", type: "number", default: 140 },
	},

	in(ctx) {
		startCrawl(ctx);
		return gsap
			.timeline()
			.from(ctx.root, { yPercent: 160, duration: 0.6, ease: "expo.out" })
			.from(ctx.$(".tag"), { xPercent: -100, duration: 0.5, ease: "expo.out" }, 0.15)
			.from(ctx.$(".crawl"), { opacity: 0, duration: 0.4 }, 0.3);
	},

	out(ctx) {
		return gsap.to(ctx.root, {
			yPercent: 160,
			duration: 0.45,
			ease: "expo.in",
			onComplete: () => {
				crawl?.kill();
				gsap.set(ctx.root, { clearProps: "transform" });
			},
		});
	},

	// New headlines while on air: fade the crawl, swap, and restart it.
	update(ctx) {
		const crawlArea = ctx.$(".crawl")!;
		return gsap
			.timeline()
			.to(crawlArea, { opacity: 0, duration: 0.3 })
			.add(() => {
				ctx.render();
				startCrawl(ctx);
			})
			.to(crawlArea, { opacity: 1, duration: 0.3 });
	},
});
