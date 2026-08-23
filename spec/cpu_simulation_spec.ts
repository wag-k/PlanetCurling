import {CollisionSystem} from "../src/collision";
import {CpuShotCandidate} from "../src/cpu_candidate";
import {
	CpuBoardEvaluator, CpuBoardMetrics, CpuCandidateResult, CpuFinalStoneState,
	CpuShotSimulator, CpuSimulationContext, CpuStoneSnapshot
} from "../src/cpu_simulation";
import {CurlingStone, MatchController, Player} from "../src/match_controller";
import {Acceleration, Pos, Velocity} from "../src/motion";
import {OrbitScoreEvaluator} from "../src/orbit_score";
import {createPhysicsIntegrator, PhysicsIntegratorKind} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {Planet} from "../src/planet";
import {Setting} from "../src/setting";
import {SimulationRunner} from "../src/simulation_runner";

/** SI値を明示してCPU物理テスト用Planetを生成します。 */
function body(x: number, velocityX: number = 0, mass: number = 1): Planet {
	return new Planet(1, mass, new Pos(x, 0), new Velocity(velocityX, 0), new Acceleration(0, 0));
}

/** 指定速度を持つvirtual drag由来相当の候補を生成します。 */
function candidate(velocityX: number, angle: number = 0): CpuShotCandidate {
	return new CpuShotCandidate(100, 0, 100, angle, new Velocity(velocityX, 0));
}

/** 衝突後にHuman Stoneが中央天体へ吸収される短時間のparity盤面を生成します。 */
function createCollisionContext(): {
	context: CpuSimulationContext;
	human: CurlingStone;
	active: CurlingStone;
	central: Planet;
	collision: CollisionSystem;
} {
	const central: Planet = body(8, 0, 100);
	const human: CurlingStone = new CurlingStone(Player.Red, 1, body(3));
	human.markReleased();
	const active: CurlingStone = new CurlingStone(Player.Blue, 1, body(0));
	const world: PhysicsWorld = new PhysicsWorld([central, active.body, human.body]);
	const collision: CollisionSystem = new CollisionSystem(central, [active.body, human.body], 0.5, 0.5, 1);
	const context: CpuSimulationContext = new CpuSimulationContext(
		world,
		collision,
		central,
		active.body,
		[new CpuStoneSnapshot(human), new CpuStoneSnapshot(active)],
		PhysicsIntegratorKind.SymplecticEuler,
		2,
		2,
		new OrbitScoreEvaluator(2, 1, 0.2, 0.5, 1)
	);
	return {context: context, human: human, active: active, central: central, collision: collision};
}

describe("CpuBoardEvaluator", (): void => {
	const evaluator: CpuBoardEvaluator = new CpuBoardEvaluator();

	it("0点差より3点差を最優先で高く評価する", (): void => {
		const zero: number = evaluator.evaluate(new CpuBoardMetrics(0, 0, 0, 0, 0, 0, 0, 0));
		const three: number = evaluator.evaluate(new CpuBoardMetrics(3, 0, 3, 0, 0, 0, 0, 0));
		expect(three).toBeGreaterThan(zero);
		expect(three - zero).toBe(3000);
	});

	it("他条件同値ならHuman Stoneの新規吸収をbonus評価する", (): void => {
		const remains: number = evaluator.evaluate(new CpuBoardMetrics(2, 2, 2, 1, 1, 0, 0, 0));
		const absorbed: number = evaluator.evaluate(new CpuBoardMetrics(2, 2, 2, 1, 1, 1, 0, 0));
		expect(absorbed - remains).toBe(120);
	});

	it("通常条件では得点して残るactive Stoneを無得点自己吸収より高くする", (): void => {
		const survives: number = evaluator.evaluate(new CpuBoardMetrics(2, 0, 2, 1, 0, 0, 0, 0));
		const selfAbsorbed: number = evaluator.evaluate(new CpuBoardMetrics(0, 0, 0, 0, 0, 0, 0, 1));
		expect(survives).toBeGreaterThan(selfAbsorbed);
		expect(selfAbsorbed).toBe(-180);
	});
});

describe("CpuShotSimulator", (): void => {
	it("候補評価後もoriginal world・Planet・MatchController・Stone・trajectoryを一切変更しない", (): void => {
		const controller: MatchController = new MatchController(new SimulationRunner(
			new PhysicsWorld(), createPhysicsIntegrator(Setting.IntegratorKind), Setting.PhysicsStepSeconds
		));
		controller.setActiveStoneVelocity(new Velocity(20, -10));
		controller.releaseActiveStone();
		controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds);
		controller.completeTurnTransition();
		const context: CpuSimulationContext = CpuSimulationContext.fromMatchController(controller);
		const originalBodies: Planet[] = context.originalWorld.bodies.slice();
		const originalValues: Planet[] = originalBodies.map((value: Planet): Planet => value.clone());
		const originalStoneValues = controller.stones.map((stone: CurlingStone): object => ({
			released: stone.isReleased,
			absorbed: stone.isAbsorbed,
			prediction: stone.predictedTrajectory,
			actual: stone.actualTrajectory
		}));
		const originalScores: number[] = [controller.currentEndRedScore, controller.currentEndBlueScore];

		new CpuShotSimulator().simulate(context, candidate(35));

		expect(context.originalWorld.bodies).toEqual(originalBodies);
		originalBodies.forEach((value: Planet, index: number): void => expect(value).toEqual(originalValues[index]));
		expect(controller.stones.map((stone: CurlingStone): object => ({
			released: stone.isReleased,
			absorbed: stone.isAbsorbed,
			prediction: stone.predictedTrajectory,
			actual: stone.actualTrajectory
		}))).toEqual(originalStoneValues);
		expect([controller.currentEndRedScore, controller.currentEndBlueScore]).toEqual(originalScores);
		expect(controller.activeStone!.body).toBe(context.activeStoneBody);
	});

	it("候補終了結果と同じvelocityの実投球が衝突・Human吸収を含めて一致する", (): void => {
		const setup = createCollisionContext();
		const shot: CpuShotCandidate = candidate(4);
		const result: CpuCandidateResult = new CpuShotSimulator().simulate(setup.context, shot);
		const expectedHuman: CpuFinalStoneState = result.finalStoneStates.filter(
			(state: CpuFinalStoneState): boolean => state.owner === Player.Red
		)[0];
		const expectedActive: CpuFinalStoneState = result.finalStoneStates.filter(
			(state: CpuFinalStoneState): boolean => state.owner === Player.Blue
		)[0];

		setup.active.body.velocity.x = shot.velocity.x;
		setup.active.body.velocity.y = shot.velocity.y;
		const actualRunner: SimulationRunner = new SimulationRunner(
			setup.context.originalWorld,
			createPhysicsIntegrator(setup.context.integratorKind),
			setup.context.physicsStepSeconds
		);
		actualRunner.setCollisionSystem(setup.collision);
		actualRunner.advance(setup.context.simulationDurationSeconds);

		expect(expectedHuman.isPresent).toBe(false);
		expect(setup.context.originalWorld.bodies).not.toContain(setup.human.body);
		expect(expectedActive.isPresent).toBe(true);
		expect(setup.context.originalWorld.bodies).toContain(setup.active.body);
		expect(expectedActive.xMetres).toBeCloseTo(setup.active.body.pos.x, 10);
		expect(expectedActive.yMetres).toBeCloseTo(setup.active.body.pos.y, 10);
		expect(expectedActive.velocityXMetresPerSecond).toBeCloseTo(setup.active.body.velocity.x, 10);
	});
});
