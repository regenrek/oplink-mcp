export default defineAppConfig({
	ui: {
		colors: {
			primary: "sky",
			neutral: "zinc",
		},
	},
	uiPro: {
		footer: {
			slots: {
				root: "border-t border-(--ui-border)",
				left: "text-sm text-(--ui-text-muted)",
			},
		},
	},
	seo: {
		siteName: "OPLINK Documentation",
	},
	header: {
		title: "OPLINK",
		to: "/",
		logo: {
			alt: "OPLINK Logo",
			light: "",
			dark: "",
		},
		search: true,
		colorMode: true,
		links: [
			{
				icon: "i-simple-icons-github",
				to: "https://github.com/regenrek/oplink",
				target: "_blank",
				"aria-label": "oplink on GitHub",
			},
		],
	},
	footer: {
		credits: `Copyright © ${new Date().getFullYear()} oplink | Made by`,
		colorMode: false,
		links: [
			{
				icon: "i-simple-icons-github",
				to: "https://github.com/regenrek/oplink",
				target: "_blank",
				"aria-label": "oplink on GitHub",
			},
		],
	},
	toc: {
		title: "Table of Contents",
		bottom: {
			title: "Community",
			edit: "https://github.com/regenrek/oplink/edit/main/docs",
			links: [
				{
					icon: "i-lucide-star",
					label: "Star on GitHub",
					to: "https://github.com/regenrek/oplink",
					target: "_blank",
				},
			],
		},
	},
	contentMermaid: {
    enabled: true,
    // Use a simple built‑in element as spinner to avoid missing component issues
    spinnerComponent: 'div',
    // mermaid theme handled client‑side; leave default
	},
});
