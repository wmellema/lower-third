import "tally/base.css";
import "../_shared/brand.css";
import "./style.scss";
import { gsap } from "gsap";
import { defineGraphic, type Context } from "tally";

interface Team {
	name: string;
	score: number | string;
	color?: string;
}

interface Scoreboard {
	home: Team;
	away: Team;
	period?: string;
	clock?: string;
}

type Side = "home" | "away";

// Rolls changed score digits in, whether they changed through UPDATE or an action.
function animateScores(ctx: Context<Scoreboard>, changed: Element[]): gsap.core.Timeline {
	const tl = gsap.timeline();
	for (const side of ["home", "away"] as Side[]) {
		const el = ctx.$(`[data-field="${side}.score"]`)!;
		if (!changed.includes(el)) continue;
		tl.fromTo(el, { yPercent: -100 }, { yPercent: 0, duration: 0.45, ease: "back.out(2)" }, 0);
		tl.fromTo(
			ctx.$(`.${side} .score`),
			{ backgroundColor: "rgb(255 255 255 / 0.5)" },
			{ backgroundColor: "rgb(255 255 255 / 0.06)", duration: 0.9 },
			0,
		);
	}
	return tl;
}

function banner(ctx: Context<Scoreboard>, text: string): gsap.core.Timeline {
	const el = ctx.$(".banner")!;
	el.querySelector("span")!.textContent = text;
	return gsap
		.timeline()
		.fromTo(el, { autoAlpha: 0, y: -16 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" })
		.to(el, { autoAlpha: 0, y: -16, duration: 0.3, delay: 2 });
}

defineGraphic<Scoreboard>({
	fields: {
		home: { label: "Home team", type: "object", default: { name: "Home", score: 0 } },
		away: { label: "Away team", type: "object", default: { name: "Away", score: 0 } },
		period: { label: "Period" },
		clock: { label: "Clock" },
	},

	in({ $, $$ }) {
		return gsap
			.timeline()
			.from($(".board"), { clipPath: "inset(0 100% 0 0)", duration: 0.6, ease: "expo.out" })
			.from($$(".team > *"), { opacity: 0, y: 10, stagger: 0.04, duration: 0.35 }, 0.2)
			.from($(".meta"), { yPercent: -100, opacity: 0, duration: 0.35, ease: "power2.out" }, 0.4);
	},

	out({ $ }) {
		return gsap
			.timeline({ onComplete: () => gsap.set([$(".board"), $(".meta")], { clearProps: "all" }) })
			.to($(".meta"), { yPercent: -100, opacity: 0, duration: 0.25 })
			.to($(".board"), { clipPath: "inset(0 100% 0 0)", duration: 0.45, ease: "expo.in" }, 0.1);
	},

	update(ctx) {
		return animateScores(ctx, ctx.render());
	},

	actions: {
		// score("home") or score("away", -1)
		score(ctx, side: Side = "home", delta = 1) {
			const team = ctx.data[side];
			const score = Math.max(0, Number(team.score) + Number(delta));
			const changed = ctx.setData({ [side]: { ...team, score } } as Partial<Scoreboard>);
			if (ctx.state !== "on") return;
			const tl = animateScores(ctx, changed);
			if (Number(delta) > 0) tl.add(banner(ctx, `+${delta} ${team.name}`), 0.1);
			return tl;
		},
		resetScores(ctx) {
			const { home, away } = ctx.data;
			const changed = ctx.setData({ home: { ...home, score: 0 }, away: { ...away, score: 0 } });
			if (ctx.state === "on") return animateScores(ctx, changed);
		},
	},
});
