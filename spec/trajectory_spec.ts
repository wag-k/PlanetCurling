import {Acceleration, Pos, Velocity} from "../src/motion";
import {createPhysicsIntegrator, PhysicsIntegratorKind} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {Planet} from "../src/planet";
import {Setting} from "../src/setting";
import {SimulationRunner} from "../src/simulation_runner";
import {TrajectoryPoint, TrajectoryPredictor, TrajectoryRecorder} from "../src/trajectory";

/** 軌道テスト用の天体を生成します。 */
function createBody(x: number, y: number, velocityX: number = 0, velocityY: number = 0): Planet {
	return new Planet(1, 0, new Pos(x, y), new Velocity(velocityX, velocityY), new Acceleration(0, 0));
}

describe("TrajectoryPredictor", (): void => {
	it("本番世界へ副作用を与えず、仮のlaunch velocityをclone側だけへ適用する", (): void => {
		const activeBody: Planet = createBody(10, 20, 3, 4);
		activeBody.acceleration.update(new Acceleration(5, 6));
		const world: PhysicsWorld = new PhysicsWorld([activeBody]);
		const predictor: TrajectoryPredictor = new TrajectoryPredictor(
			PhysicsIntegratorKind.SymplecticEuler,
			Setting.PhysicsStepSeconds,
			10 * Setting.SecondsPerDay,
			10 * Setting.SecondsPerDay
		);
		const originalSnapshot: Planet = activeBody.clone();

		const points: TrajectoryPoint[] = predictor.predict(world, activeBody, new Velocity(100, -50));

		expect(activeBody).toEqual(originalSnapshot);
		expect(world.bodies).toEqual([originalSnapshot]);
		expect(points[0]).toEqual(new TrajectoryPoint(10, 20, 0));
		expect(points[1].xMetres).toBe(10 + 100 * 10 * Setting.SecondsPerDay);
		expect(points[1].yMetres).toBe(20 - 50 * 10 * Setting.SecondsPerDay);
	});

	it("6時間dtのまま10年間を計算し、10日ごとの約365点だけを返す", (): void => {
		const activeBody: Planet = createBody(0, 0);
		const predictor: TrajectoryPredictor = new TrajectoryPredictor(
			PhysicsIntegratorKind.SymplecticEuler,
			Setting.PhysicsStepSeconds,
			Setting.PredictionDurationSeconds,
			Setting.TrajectorySampleIntervalSeconds
		);

		const points: TrajectoryPoint[] = predictor.predict(
			new PhysicsWorld([activeBody]),
			activeBody,
			new Velocity(1, 0)
		);

		expect(predictor.physicsStepSeconds).toBe(6 * 60 * 60);
		expect(predictor.predictionDurationSeconds).toBe(10 * 365 * Setting.SecondsPerDay);
		expect(points).toHaveLength(366);
		expect(points[points.length - 1].elapsedSeconds).toBe(Setting.PredictionDurationSeconds);
	});

	it.each([
		PhysicsIntegratorKind.SymplecticEuler,
		PhysicsIntegratorKind.VelocityVerlet
	])("%sで同じ初期条件の本番SimulationRunnerと最終位置が一致する", (kind: PhysicsIntegratorKind): void => {
		const predictionBody: Planet = new Planet(
			1,
			1,
			new Pos(0, 0),
			new Velocity(0, 0),
			new Acceleration(0, 0)
		);
		const launchVelocity: Velocity = new Velocity(123, -45);
		const duration: number = 20 * Setting.SecondsPerDay;
		const predictor: TrajectoryPredictor = new TrajectoryPredictor(
			kind,
			Setting.PhysicsStepSeconds,
			duration,
			10 * Setting.SecondsPerDay
		);
		const predicted: TrajectoryPoint[] = predictor.predict(
			new PhysicsWorld([predictionBody]),
			predictionBody,
			launchVelocity
		);

		const actualBody: Planet = predictionBody.clone();
		actualBody.velocity = launchVelocity.clone();
		const runner: SimulationRunner = new SimulationRunner(
			new PhysicsWorld([actualBody]),
			createPhysicsIntegrator(kind),
			Setting.PhysicsStepSeconds
		);
		runner.advance(duration);
		const finalPrediction: TrajectoryPoint = predicted[predicted.length - 1];

		expect(finalPrediction.xMetres).toBeCloseTo(actualBody.pos.x, 8);
		expect(finalPrediction.yMetres).toBeCloseTo(actualBody.pos.y, 8);
	});
});

describe("TrajectoryRecorder", (): void => {
	it("物理時間がsample間隔まで進んだ場合だけ位置を追加する", (): void => {
		const body: Planet = createBody(1, 2);
		const recorder: TrajectoryRecorder = new TrajectoryRecorder(10 * Setting.SecondsPerDay);
		recorder.start(body);

		for (let index: number = 0; index < 39; index += 1) {
			body.pos.x += 1;
			expect(recorder.recordStep(body, Setting.PhysicsStepSeconds)).toBe(false);
		}
		expect(recorder.getPoints()).toHaveLength(1);
		body.pos.x += 1;
		expect(recorder.recordStep(body, Setting.PhysicsStepSeconds)).toBe(true);
		expect(recorder.getPoints()).toEqual([
			new TrajectoryPoint(1, 2, 0),
			new TrajectoryPoint(41, 2, 10 * Setting.SecondsPerDay)
		]);
	});

	it("物理時間0のAiming相当呼び出しでは同一点を追加しない", (): void => {
		const body: Planet = createBody(1, 2);
		const recorder: TrajectoryRecorder = new TrajectoryRecorder(Setting.SecondsPerDay);
		recorder.start(body);

		expect(recorder.recordStep(body, 0)).toBe(false);
		expect(recorder.getPoints()).toHaveLength(1);
	});
});
