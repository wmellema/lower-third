import "tally/base.css";
import "../_shared/brand.css";
import "./style.scss";
import { gsap } from "gsap";
import { defineGraphic, truthy, type Context } from "tally";

interface Countdown {
	title: string;
	subtitle?: string;
	seconds: number | string;
	autoStart: boolean | string;
}

const timer = { total: 30_000, remaining: 30_000, running: false, last: 0 };

function format(ms: number): string {
	const s = Math.ceil(ms / 1000);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function draw({ root, $ }: Context<Countdown>): void {
	$(".time")!.textContent = format(timer.remaining);
	$(".arc")!.style.strokeDashoffset = String(100 * (1 - timer.remaining / timer.total));
	const live = timer.remaining <= 0;
	if (live !== root.classList.contains("live")) {
		root.classList.toggle("live", live);
		$(".status-text")!.textContent = live ? "On air" : "Going live in";
		if (live) gsap.fromTo(root, { scale: 1.04 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" });
	}
}

function reset(ctx: Context<Countdown>): void {
	timer.total = timer.remaining = Math.max(1, Number(ctx.data.seconds)) * 1000;
	draw(ctx);
}

defineGraphic<Countdown>({
	fields: {
		title: { label: "Title", default: "Tally demo stream" },
		subtitle: { label: "Subtitle" },
		seconds: { label: "Seconds", type: "number", default: 30 },
		autoStart: { label: "Start on play", type: "boolean", default: true },
	},

	setup(ctx) {
		reset(ctx);
		// gsap's ticker keeps the countdown in step with the animation clock.
		gsap.ticker.add((_time, delta) => {
			if (!timer.running) return;
			timer.remaining = Math.max(0, timer.remaining - delta);
			if (timer.remaining === 0) timer.running = false;
			draw(ctx);
		});
	},

	in(ctx) {
		reset(ctx);
		timer.running = truthy(ctx.data.autoStart);
		return gsap
			.timeline()
			.from(ctx.root, { y: 60, opacity: 0, duration: 0.6, ease: "expo.out" })
			.from(ctx.$(".arc"), { strokeDashoffset: 100, duration: 0.8, ease: "power2.out" }, 0.1)
			.from(ctx.$$(".copy > *"), { x: 20, opacity: 0, stagger: 0.07, duration: 0.45 }, 0.2);
	},

	out(ctx) {
		return gsap.to(ctx.root, {
			y: 60,
			opacity: 0,
			duration: 0.4,
			ease: "expo.in",
			onComplete: () => {
				timer.running = false;
				gsap.set(ctx.root, { clearProps: "transform,opacity" });
			},
		});
	},

	update(ctx, previous) {
		ctx.render();
		if (Number(previous.seconds) !== Number(ctx.data.seconds)) reset(ctx);
	},

	actions: {
		start() {
			if (timer.remaining > 0) timer.running = true;
		},
		pause() {
			timer.running = false;
		},
		add(ctx, seconds = 30) {
			timer.remaining += Number(seconds) * 1000;
			timer.total = Math.max(timer.total, timer.remaining);
			draw(ctx);
		},
		restart(ctx) {
			reset(ctx);
			timer.running = true;
		},
	},
});
