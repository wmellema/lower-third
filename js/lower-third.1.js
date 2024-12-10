"use strict";

// lower-third.1.js

_widget.setTemplateData(
	'{"style":{"primaryColor":"#d60000","textColor":"black", "subtitlecolor": "white", "position": "left"},"data":[{"title":"Title One","subtitle":"Subtitle One"},{"title":"The quick brown fox jumps over the lazy dog","subtitle":"The quick brown fox jumps over the lazy dog"}]}',
	"Load"
);
const _graphic = (function () {
	// Configurable things
	const graphics_container_class = ".graphic";
	const container_class = ".lt-style-one";

	// Configurable functions below. Should incorporate the following functions:
	// - positionGraphics
	// - animateIn -> Return promise
	// - animateOut -> Return promise

	function positionGraphics() {
		const container = document.querySelector(container_class);
		if (Object.keys(style).includes("position")) {
			console.log("Switching positions");
			switch (style.position) {
				case "left":
					container.style.marginRight = "auto";
					break;
				case "center":
					container.style.margin = "4vh auto";
					break;
				default:
					container.style.marginLeft = "auto";
					break;
			}
		} else {
			container.style.marginLeft = "auto";
		}
	}
	// Triggers the In animation. Uses promises to schedule animations
	// after eachother
	// @returns {Promise} A Promise object containing the animation
	function animateIn() {
		return new Promise((resolve, reject) => {
			// Collect graphic elelents and information
			const graphic = document.querySelector(".lt-style-one .graphic");
			const [pathLeft, pathRight] = graphic.querySelectorAll("svg path");
			const title = graphic.querySelector("h1");
			const subtitleCon = graphic.querySelector(".subtitle");
			const subtitle = subtitleCon.querySelector("p");

			const graphicWidth = getComputedStyle(graphic, "width")[0];
			const graphicHeight = getComputedStyle(graphic, "height")[0];

			const pathWidth = graphicWidth * 2;
			const tl = new gsap.timeline({
				duration: 1,
				ease: "power1.out",
				onComplete: resolve,
			});
			// Animate!
			tl.set([pathLeft, pathRight], {
				strokeDashoffset: pathWidth,
				strokeDasharray: pathWidth,
			})
				.set(title, { y: graphicHeight })
				.set(subtitleCon, { y: "10vh" })
				.set(subtitle, { y: "20vh" })
				// Reveal the graphic
				.set(graphic, { opacity: 1 })
				// Animation Begins
				.to([pathLeft, pathRight], {
					strokeDashoffset: 0,
					duration: 1.5, // Overides the default duration
				})
				.to(title, { y: 0 }, "-=1")
				.to(subtitleCon, { y: 0 }, "-=.9")
				.to(subtitle, { y: 0 }, "-=1");
		});
	}
	// Triggers the Out animation. Uses promises to schedule animations
	// after eachother
	// @returns {Promise} A Promise object containing the animation
	function animateOut() {
		return new Promise((resolve, reject) => {
			// Collect graphics elements and data
			const graphic = document.querySelector(".lt-style-one .graphic");
			const [pathLeft, pathRight] = graphic.querySelectorAll("svg path");
			const title = graphic.querySelector("h1");
			const subtitleCon = graphic.querySelector(".subtitle");
			const subtitle = subtitleCon.querySelector("p");

			const graphicWidth = getComputedStyle(graphic, "width")[0];
			const graphicHeight = getComputedStyle(graphic, "height")[0];

			// *2 due to paths being split
			const pathLength = graphicWidth * 2;

			const tl = new gsap.timeline({
				duration: 1,
				ease: "power1.in",
				onComplete: resolve,
			});
			tl.to(title, { y: graphicHeight })
				.to(subtitleCon, { y: "10vh" }, "-=.75")
				.to(subtitle, { y: "20vh" }, "-=.55")
				.to(
					[pathLeft, pathRight],
					{
						strokeDashoffset: pathLength,
						ease: "power1.inOut",
						duration: 1,
					},
					"-=1"
				)
				.to(graphic, { opacity: 0 }, "-=.25");
		});
	}

	// --------------------------------------------
	// Generic stuff. Please do not alter these
	// --------------------------------------------
	// State tracking stuff
	let state = 0;
	let activeStep = 0;
	let currentStep = 0;
	let data = [];
	let style;
	let animationQueue = [];
	const animationThreshold = 3;
	// Run at DOM load in order to set custom functions
	(function () {
		window["update"] = (raw) => update(raw);
		window["play"] = play;
		window["next"] = next;
		window["stop"] = stop;
		window["remove"] = remove;
		window["reset"] = reset;
	})();
	// Generic data apply function
	// Has to have a valid ID
	function applyData() {
		try {
			const graphic = document.querySelector(graphics_container_class);
			if (graphic === null) {
				throw new Error(
					"Failed to get graphic element! Please set graphics_container_class correctly"
				);
			}
			for (const [key, value] of Object.entries(data[activeStep])) {
				graphic.querySelector("#" + key).textContent = value;
			}
		} catch (e) {
			handleError(e);
		}
	}
	// Apply style using data- attributes. Example: Use data-style-test="color"
	// to set the color css attribute to the test value
	function applyStyle() {
		// Key = custom property name
		// Value = css property name to be set
		for (const [key, value] of Object.entries(style)) {
			// Get all elements that have the custom data-style-* attribute
			const objs = document.querySelectorAll(
				`[data-style-${key.toLowerCase()}]`
			);
			objs.forEach((obj) => {
				try {
					// Set style according to css property contained in custom attribute
					obj.style.setProperty(
						obj.getAttribute(`data-style-${key.toLowerCase()}`),
						value
					);
					// Sanity check. Colours could be parsed differently, so throw a warning in stead of error
					// TODO: Implement better handling of colours (#ffffff will be read as rgb(255,255,255))
					if (
						obj.style.getPropertyValue(
							obj.getAttribute(`data-style-${key.toLowerCase()}`)
						) !== value
					) {
						console.warn(
							"Error on setting",
							obj.getAttribute(`data-style-${key.toLowerCase()}`),
							"to",
							key,
							". Check if the content is a valid style property (css, not js)"
						);
						console.warn(value);
					}
				} catch (e) {
					handleError(e);
				}
			});
		}

		positionGraphics();
	}
	// Handle update events
	// @param {JSON} raw | The raw update data comming from CasparCG. This should include a `data` or `style` object
	function update(raw) {
		let parsed;
		// Try and parse incoming string as JSON
		try {
			parsed = JSON.parse(raw);
			if (!Object.keys(parsed).length)
				throw new Error("Empty objects are invalid");
			if (!parsed.style) {
				if (!parsed.data) throw new Error("Invalid data object");
			}
		} catch (e) {
			// Parse Failed
			handleError(e);
			return;
		}
		Array.isArray(parsed.data) // Save the text data
			? (data = data.concat(parsed.data))
			: data.push(parsed.data);

		style = parsed.style; // Save the style data

		// Only apply data and style when graphic is not on screen
		if (state === 0) {
			try {
				applyData();
				applyStyle();
				state = 1;
			} catch (error) {
				handleError(error);
				return;
			}
		}
	}
	function play() {
		// Only animate in when data and style has been set (prevent placeholder data)
		if (state === 1) {
			animateIn();
			state = 2;
		}
	}
	function next() {
		if (state === 1) {
			// Graphic can be played
			play();
		} else if (state === 2) {
			// Graphic can be advanced
			if (data.length > currentStep + 1) {
				// There is another title to show
				currentStep++;
				const animation = () =>
					animateOut()
						.then(() => {
							activeStep++;
							applyData();
							return;
						})
						.then(animateIn);
				addPlayOutCommand(animation);
			} else {
				handleError("Graphic is out of data to display");
			}
		} else {
			handleError("Graphic cannot be advanced while in state " + state);
		}
	}
	function stop() {
		// Only animate when graphics are visible on screen
		if (state === 2) {
			animateOut();
			state = 1;
		}
	}
	async function remove() {
		if (state === 2) await animateOut(); // Wait here until animateOut resolves
	}
	function handleError(e) {
		console.error(e);
	}
	function handleWarning(w) {
		console.log(w);
	}
	// Gets the CSS values used by the browser
	// @param {DOM Node} elem - The element whos styles you want
	// @param {string | string[]} styles - The CSS properties needed
	// @returns {any[]} An array of strings and/or numbers
	function getComputedStyle(elem, styles) {
		// Get the element's computed styles
		const computedStyles = window.getComputedStyle(elem);
		// Create an array to hold the requested results
		const values = [];
		if (Array.isArray(styles)) {
			// Loop over each style requested and all the value to the result
			styles.forEach((s) =>
				values.push(computedStyles.getPropertyValue(s))
			);
		} else {
			values.push(computedStyles.getPropertyValue(styles));
		}
		return values.map((v) => {
			// Clean up pixel values
			if (v.includes("px")) v = Number(v.substring(0, v.length - 2));
			return v;
		});
	}
	// Handle queueing of animations
	function executePlayOutCommand() {
		// Run the first Promise
		animationQueue[0]()
			.then(() => {
				animationQueue.splice(0, 1);
				// If there are more, run them
				if (animationQueue.length) executePlayOutCommand();
			})
			.catch((e) => HandleError(e));
	}

	function addPlayOutCommand(prom) {
		if (animationQueue.length < animationThreshold)
			animationQueue.push(prom);
		// Warn user about threshold
		if (animationQueue.length === animationThreshold)
			handleWarning("Animation threshold met");
		// If there is only one comamnd, run it
		if (animationQueue.length === 1) executePlayOutCommand();
	}
	function reset() {
		if (currentStep === 0) {
			// Graphic needs to be loaded
			handleError("The graphic is already on its first item.");
			return;
		}
		let animation;
		if (state === 1) {
			// Graphic is not visible
			currentStep = 0;
			animation = () =>
				new Promise((resolve, reject) => {
					activeStep = 0;
					applyData();
					resolve();
				});
		} else if (state === 2) {
			// Graphic is visible
			currentStep = -1;
			animation = () =>
				new Promise((resolve, reject) => {
					activeStep = -1;
					resolve();
				}).then(next);
		} else {
			handleError("Cannot reset a graphic that has not been loaded.");
			return;
		}
		addPlayOutCommand(animation);
	}
	return {};
})();
