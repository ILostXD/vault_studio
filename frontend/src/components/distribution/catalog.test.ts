import { describe, expect, it } from "vitest";
import { fallbackGenres, fallbackLanguages } from "./catalog";

describe("distribution fallback catalog", () => {
	it("keeps the observed Too Lost genres available before connection", () => {
		expect(fallbackGenres.length).toBeGreaterThan(250);
		expect(fallbackGenres).toContain("Alternative/Experimental");
		expect(fallbackGenres).toContain("Techno (Raw / Deep / Hypnotic)");
	});

	it("includes the full lyrics-language fallback and no-lyrics option", () => {
		expect(fallbackLanguages.length).toBeGreaterThan(180);
		expect(fallbackLanguages[0]).toEqual({ code: "zxx", name: "No lyrics" });
		expect(fallbackLanguages).toContainEqual({ code: "zu", name: "Zulu" });
	});
});
