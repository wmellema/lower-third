import "tally/base.css";
import "../_shared/brand.css";
import "./style.scss";
import { gsap } from "gsap";
import { defineGraphic } from "tally";

interface Bug {
	label: string;
	showClock: boolean | string;
}

let clock: number | undefined;
let pulse: gsap.core.Tween | undefined;

defineGraphic<Bug>({
	fields: {
		label: { label: "Label", default: "Live" },
		showClock: { label: "Show clock", type: "boolean", default: true },
	},

	setup({ $ }) {
		const time = $(".time")!;
		const tick = () => (time.textContent = new Date().toLocaleTimeString("en-GB", { hour12: false }));
		tick();
		clock = window.setInterval(tick, 1000);
		// Split the wordmark into letters for the reveal.
		const word = $(".word")!;
		word.innerHTML = [...word.textContent!].map((c) => `<span>${c}</span>`).join("");
	},

	in({ root, $, $$ }) {
		pulse = gsap.to($(".tally-light"), { opacity: 0.35, duration: 0.9, repeat: -1, yoyo: true, ease: "sine.inOut" });
		return gsap
			.timeline()
			.from(root, { clipPath: "inset(0 0 0 100%)", duration: 0.6, ease: "expo.out" })
			.from($(".tally-light"), { scale: 0, duration: 0.4, ease: "back.out(3)" }, 0.15)
			.from($$(".word span"), { yPercent: 110, opacity: 0, stagger: 0.04, duration: 0.45, ease: "power3.out" }, 0.2)
			.from([$(".clock"), $(".label")], { opacity: 0, x: 12, stagger: 0.08, duration: 0.4 }, 0.35);
	},

	out({ root }) {
		return gsap.to(root, {
			clipPath: "inset(0 0 0 100%)",
			duration: 0.45,
			ease: "expo.in",
			onComplete: () => {
				pulse?.kill();
				gsap.set(root, { clearProps: "clipPath" });
			},
		});
	},

	actions: {
		onAir({ root }) {
			root.classList.remove("off-air");
		},
		offAir({ root }) {
			root.classList.add("off-air");
		},
		// flash("Replay"): swap the label for a few seconds, then restore it.
		flash(ctx, text = "Replay", seconds = 3) {
			const label = ctx.$("[data-field=label]")!;
			return gsap
				.timeline()
				.to(label, { yPercent: -120, duration: 0.2, ease: "power2.in" })
				.add(() => (label.textContent = String(text)))
				.fromTo(label, { yPercent: 120 }, { yPercent: 0, duration: 0.25, ease: "power2.out" })
				.to(label, { yPercent: -120, duration: 0.2, ease: "power2.in", delay: Number(seconds) })
				.add(() => ctx.render())
				.fromTo(label, { yPercent: 120 }, { yPercent: 0, duration: 0.25, ease: "power2.out" });
		},
	},
});

window.addEventListener("pagehide", () => clearInterval(clock));
