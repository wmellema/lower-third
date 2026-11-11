import "tally/base.css";
import "../_shared/brand.css";
import "./style.scss";
import { gsap } from "gsap";
import { defineGraphic, type Context } from "tally";

interface LowerThird {
	kicker?: string;
	title: string;
	subtitle?: string;
}

type Ctx = Context<LowerThird>;

// Wraps each word of the title in a clipping span. The text content stays the
// same, so the binder leaves the spans alone until the title actually changes.
function splitWords(el: HTMLElement): HTMLElement[] {
	const words = (el.textContent ?? "").trim().split(/\s+/);
	el.replaceChildren();
	words.forEach((word, i) => {
		const outer = document.createElement("span");
		const inner = document.createElement("span");
		outer.className = "word";
		inner.textContent = word;
		outer.append(inner);
		el.append(outer);
		if (i < words.length - 1) el.append(" ");
	});
	return Array.from(el.querySelectorAll<HTMLElement>(".word > span"));
}

const textParts = (ctx: Ctx) =>
	[...ctx.$$(".word > span"), ctx.$(".kicker-text"), ctx.$(".subtitle p")].filter(Boolean) as HTMLElement[];

const blocks = (ctx: Ctx) =>
	[".bar", ".panel", ".subtitle", ".sheen", ".panel .tally-light"].map((s) => ctx.$(s)!);

defineGraphic<LowerThird>({
	fields: {
		kicker: { label: "Kicker" },
		title: { label: "Title", required: true },
		subtitle: { label: "Subtitle" },
	},
	style: { position: "left" },

	in(ctx) {
		const words = splitWords(ctx.$("h1")!);
		const wipe = { clipPath: "inset(0 100% 0 0)", duration: 0.75, ease: "expo.out" };
		return gsap
			.timeline({ onComplete: () => gsap.set([ctx.$(".panel"), ctx.$(".subtitle")], { clearProps: "clipPath" }) })
			.from(ctx.$(".bar"), { scaleY: 0, transformOrigin: "50% 100%", duration: 0.45, ease: "expo.out" })
			.from(ctx.$(".panel"), wipe, 0.2)
			.from(ctx.$(".subtitle"), wipe, 0.32)
			.from(ctx.$(".panel .tally-light"), { scale: 0, duration: 0.45, ease: "back.out(3)" }, 0.4)
			.from(ctx.$(".kicker-text"), { x: -14, opacity: 0, duration: 0.4, ease: "power2.out" }, 0.45)
			.from(words, { yPercent: 110, stagger: 0.045, duration: 0.6, ease: "power3.out" }, 0.4)
			.from(ctx.$(".subtitle p"), { yPercent: 110, duration: 0.55, ease: "power3.out" }, 0.58)
			.fromTo(
				ctx.$(".sheen"),
				{ xPercent: -120, opacity: 1 },
				{ xPercent: 320, duration: 1.1, ease: "power2.inOut" },
				0.65,
			);
	},

	out(ctx) {
		const wipe = { clipPath: "inset(0 100% 0 0)", duration: 0.45, ease: "expo.in" };
		return gsap
			.timeline({ onComplete: () => gsap.set([...blocks(ctx), ...textParts(ctx)], { clearProps: "all" }) })
			.to(textParts(ctx), { yPercent: 110, stagger: 0.02, duration: 0.3, ease: "power2.in" })
			.to(ctx.$(".panel .tally-light"), { scale: 0, duration: 0.25, ease: "power2.in" }, 0)
			.to(ctx.$(".subtitle"), wipe, 0.15)
			.to(ctx.$(".panel"), wipe, 0.22)
			.to(ctx.$(".bar"), { scaleY: 0, transformOrigin: "50% 0%", duration: 0.3, ease: "expo.in" }, 0.55);
	},

	// New text while on air rolls over in place, and the strap resizes to fit,
	// instead of taking it off air.
	async update(ctx) {
		const graphic = ctx.$(".graphic")!;
		await gsap.to(textParts(ctx), { yPercent: -110, stagger: 0.02, duration: 0.3, ease: "power2.in" });
		const from = { width: graphic.offsetWidth, height: graphic.offsetHeight };
		ctx.render();
		splitWords(ctx.$("h1")!);
		const to = { width: graphic.offsetWidth, height: graphic.offsetHeight };
		await gsap
			.timeline({ onComplete: () => gsap.set(graphic, { clearProps: "width,height" }) })
			.fromTo(graphic, from, { ...to, duration: 0.5, ease: "expo.inOut" })
			.fromTo(textParts(ctx), { yPercent: 110 }, { yPercent: 0, stagger: 0.04, duration: 0.5, ease: "power3.out" }, 0.2);
	},
});
