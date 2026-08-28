import {Acceleration, Pos, Velocity} from "../src/motion";
import {OrbitEvaluation, OrbitScoreEvaluator} from "../src/orbit_score";
import {PhysicalConstant} from "../src/physical_constant";
import {Planet} from "../src/planet";
import {Setting} from "../src/setting";

/** 軌道評価テスト用の天体を生成します。 */
function createPlanet(x: number, y: number, velocityX: number = 0, velocityY: number = 0): Planet {
	return new Planet(1, 1, new Pos(x, y), new Velocity(velocityX, velocityY), new Acceleration(0, 0));
}

describe("軌道得点評価", (): void => {
	it("距離誤差と相対動径速度から実効軌道誤差を計算する", (): void => {
		const evaluator: OrbitScoreEvaluator = new OrbitScoreEvaluator(100, 10, 20, 50, 100);
		const centralBody: Planet = createPlanet(50, -20, 4, -3);
		const stone: Planet = createPlanet(150, -20, 6, 7);

		const evaluation: OrbitEvaluation = evaluator.evaluate(stone, centralBody);

		expect(evaluation.radiusMetres).toBe(100);
		expect(evaluation.radialDistanceErrorMetres).toBe(0);
		expect(evaluation.radialVelocityMetresPerSecond).toBe(2);
		expect(evaluation.radialVelocityPenaltyMetres).toBe(20);
		expect(evaluation.effectiveOrbitErrorMetres).toBe(20);
		expect(evaluation.points).toBe(3);
	});

	it("実効軌道誤差は位置誤差と動径速度の距離換算ペナルティの和になる", (): void => {
		const evaluator: OrbitScoreEvaluator = new OrbitScoreEvaluator(100, 10, 20, 50, 100);
		const centralBody: Planet = createPlanet(0, 0, 1, 0);
		const stone: Planet = createPlanet(130, 0, 4, 0);

		const evaluation: OrbitEvaluation = evaluator.evaluate(stone, centralBody);

		expect(evaluation.radialDistanceErrorMetres).toBe(30);
		expect(evaluation.radialVelocityMetresPerSecond).toBe(3);
		expect(evaluation.radialVelocityPenaltyMetres).toBe(30);
		expect(evaluation.effectiveOrbitErrorMetres).toBe(
			evaluation.radialDistanceErrorMetres + evaluation.radialVelocityPenaltyMetres
		);
	});

	it("位置と速度へ共通の並進を加えても評価が変わらない", (): void => {
		const evaluator: OrbitScoreEvaluator = new OrbitScoreEvaluator();
		const centralBody: Planet = createPlanet(10, 20, 30, 40);
		const stone: Planet = createPlanet(10 + 2 * PhysicalConstant.AstroUnit, 20, 30, 140);
		const translatedCentralBody: Planet = createPlanet(-400, 800, -20, 70);
		const translatedStone: Planet = createPlanet(
			-400 + 2 * PhysicalConstant.AstroUnit,
			800,
			-20,
			170
		);

		expect(evaluator.evaluate(stone, centralBody)).toEqual(
			evaluator.evaluate(translatedStone, translatedCentralBody)
		);
	});

	it("中心天体が動いていても共通速度を差し引いて評価する", (): void => {
		const evaluator: OrbitScoreEvaluator = new OrbitScoreEvaluator();
		const sharedVelocity: number = PhysicalConstant.AstroUnit / Setting.SecondsPerYear;
		const centralBody: Planet = createPlanet(0, 0, sharedVelocity, 0);
		const stone: Planet = createPlanet(
			2 * PhysicalConstant.AstroUnit,
			0,
			sharedVelocity,
			1000
		);

		const evaluation: OrbitEvaluation = evaluator.evaluate(stone, centralBody);

		expect(evaluation.radialVelocityMetresPerSecond).toBe(0);
		expect(evaluation.radialVelocityPenaltyMetres).toBe(0);
		expect(evaluation.effectiveOrbitErrorMetres).toBe(0);
		expect(evaluation.points).toBe(3);
	});

	it.each([
		[20, 3],
		[20.0001, 2],
		[50, 2],
		[50.0001, 1],
		[100, 1],
		[100.0001, 0]
	])("実効誤差 %s の包含境界を %s 点へ変換する", (error: number, points: number): void => {
		const evaluator: OrbitScoreEvaluator = new OrbitScoreEvaluator(1000, 10, 20, 50, 100);
		const centralBody: Planet = createPlanet(0, 0);
		const stone: Planet = createPlanet(1000 + error, 0);

		expect(evaluator.evaluate(stone, centralBody).points).toBe(points);
	});
});
