import {GameBalance} from "../src/game_balance";
import {
	createScoringRingDefinitions,
	ScoringRingDefinition,
	ScoringRingKind
} from "../src/scoring_ring";

describe("Scoring ring definitions", (): void => {
	it("Targetと3pt・2pt・1ptの内外境界をGameBalanceから正確に算出する", (): void => {
		const definitions: ScoringRingDefinition[] = createScoringRingDefinitions();
		const target: number = GameBalance.TargetOrbitRadiusMetres;

		expect(definitions.map((definition): number => definition.radiusMetres)).toEqual([
			target - GameBalance.OnePointOrbitErrorMetres,
			target - GameBalance.TwoPointOrbitErrorMetres,
			target - GameBalance.ThreePointOrbitErrorMetres,
			target,
			target + GameBalance.ThreePointOrbitErrorMetres,
			target + GameBalance.TwoPointOrbitErrorMetres,
			target + GameBalance.OnePointOrbitErrorMetres
		]);
		expect(definitions.map((definition): ScoringRingKind => definition.kind)).toEqual([
			ScoringRingKind.OnePointBoundary,
			ScoringRingKind.TwoPointBoundary,
			ScoringRingKind.ThreePointBoundary,
			ScoringRingKind.Target,
			ScoringRingKind.ThreePointBoundary,
			ScoringRingKind.TwoPointBoundary,
			ScoringRingKind.OnePointBoundary
		]);
	});

	it("Target・3pt・2pt・1ptを色以外のdot sizeと間隔でも区別する", (): void => {
		const definitions: ScoringRingDefinition[] = createScoringRingDefinitions();
		const byKind = (kind: ScoringRingKind): ScoringRingDefinition => definitions.filter(
			(definition: ScoringRingDefinition): boolean => definition.kind === kind
		)[0];

		expect(byKind(ScoringRingKind.Target).dotSizePixels)
			.toBeGreaterThan(byKind(ScoringRingKind.ThreePointBoundary).dotSizePixels);
		expect(byKind(ScoringRingKind.ThreePointBoundary).dotSizePixels)
			.toBeGreaterThan(byKind(ScoringRingKind.TwoPointBoundary).dotSizePixels);
		expect(byKind(ScoringRingKind.TwoPointBoundary).dotSizePixels)
			.toBeGreaterThan(byKind(ScoringRingKind.OnePointBoundary).dotSizePixels);
		expect(byKind(ScoringRingKind.OnePointBoundary).segmentStride)
			.toBeGreaterThan(byKind(ScoringRingKind.ThreePointBoundary).segmentStride);
		expect(definitions.filter((definition): boolean => definition.label === "TARGET")).toHaveLength(1);
		expect(definitions.filter((definition): boolean => definition.label === "3 PT")).toHaveLength(1);
		expect(definitions.filter((definition): boolean => definition.label === "2 PT")).toHaveLength(1);
		expect(definitions.filter((definition): boolean => definition.label === "1 PT")).toHaveLength(1);
	});
});
