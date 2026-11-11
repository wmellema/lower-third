import "tally/base.css";
import "../_shared/brand.css";
import "./style.scss";
import { gsap } from "gsap";
import { defineGraphic, type Context } from "tally";

interface Slide {
	series?: string;
	kicker: string;
	title: string;
	body?: string;
	code?: string;
}

// The number and counter come from the step position, not the payload.
function render(ctx: Context<Slide>): void {
	const number = String(ctx.step + 1).padStart(2, "0");
	ctx.render({ ...ctx.data, $number: number });
	ctx.$(".count")!.textContent = `${number} / ${String(ctx.steps.length).padStart(2, "0")}`;
	const progress = ctx.$(".progress")!;
	progress.replaceChildren(...ctx.steps.map(() => document.createElement("li")));
	progress.querySelectorAll("li").forEach((li, i) => li.classList.toggle("done", i <= ctx.step));
}

const parts = (ctx: Context<Slide>) => [ctx.$(".number"), ctx.$(".eyebrow"), ctx.$("h1"), ctx.$(".body"), ctx.$(".code")];

function contentIn(ctx: Context<Slide>) {
	return gsap.from(parts(ctx), { y: 40, opacity: 0, stagger: 0.07, duration: 0.6, ease: "power3.out" });
}

function contentOut(ctx: Context<Slide>) {
	return gsap.to(parts(ctx), { y: -30, opacity: 0, stagger: 0.04, duration: 0.3, ease: "power2.in" });
}

defineGraphic<Slide>({
	fields: {
		series: { label: "Series" },
		kicker: { label: "Kicker" },
		title: { label: "Title", required: true },
		body: { label: "Body" },
		code: { label: "Code" },
	},

	in(ctx) {
		render(ctx);
		return gsap
			.timeline()
			.from(ctx.$(".backdrop"), { opacity: 0, duration: 0.5 })
			.from(ctx.$(".top"), { y: -20, opacity: 0, duration: 0.4 }, 0.15)
			.from(ctx.$(".progress"), { scaleX: 0, transformOrigin: "left", duration: 0.7, ease: "expo.out" }, 0.15)
			.add(contentIn(ctx), 0.25);
	},

	out(ctx) {
		return gsap
			.timeline({ onComplete: () => gsap.set(ctx.$$(".card *"), { clearProps: "all" }) })
			.add(contentOut(ctx))
			.to([ctx.$(".top"), ctx.$(".progress")], { opacity: 0, duration: 0.3 }, 0.1)
			.to(ctx.$(".backdrop"), { opacity: 0, duration: 0.4 }, 0.25);
	},

	// NEXT swaps only the slide content; the card stays on air.
	async next(ctx) {
		if (ctx.step >= ctx.steps.length - 1) return ctx.log("title-card: last slide");
		await contentOut(ctx);
		ctx.goTo(ctx.step + 1);
		render(ctx);
		gsap.set(parts(ctx), { clearProps: "all" });
		await contentIn(ctx);
	},

	async update(ctx) {
		await contentOut(ctx);
		render(ctx);
		gsap.set(parts(ctx), { clearProps: "all" });
		await contentIn(ctx);
	},

	actions: {
		async back(ctx) {
			if (ctx.step === 0) return;
			await contentOut(ctx);
			ctx.goTo(ctx.step - 1);
			render(ctx);
			gsap.set(parts(ctx), { clearProps: "all" });
			await contentIn(ctx);
		},
	},
});
