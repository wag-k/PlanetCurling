import {CpuCandidateGenerator, CpuShotCandidate} from "../src/cpu_candidate";
import {CpuPlanningSession} from "../src/cpu_planner";
import {
	CpuCandidateResult, CpuShotSimulator, CpuSimulationContext, CpuStoneSnapshot
} from "../src/cpu_simulation";
import {CpuDifficulty} from "../src/game_session";
import {CurlingStone, Player} from "../src/match_controller";
import {Acceleration, Pos, Velocity} from "../src/motion";
import {OrbitScoreEvaluator} from "../src/orbit_score";
import {PhysicsIntegratorKind} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {Planet} from "../src/planet";

/** 物理時間を進めず、candidate速度による得点評価だけを行える小さな盤面を生成します。 */
function createContext(): CpuSimulationContext {
	const central: Planet = new Planet(1, 0, new Pos(0, 0), new Velocity(0, 0), new Acceleration(0, 0));
	const active: CurlingStone = new CurlingStone(
		Player.Blue,
		1,
		new Planet(1, 0, new Pos(2, 0), new Velocity(0, 0), new Acceleration(0, 0))
	);
	const world: PhysicsWorld = new PhysicsWorld([central, active.body]);
	return new CpuSimulationContext(
		world,
		undefined,
		central,
		active.body,
		[new CpuStoneSnapshot(active)],
		PhysicsIntegratorKind.SymplecticEuler,
		1,
		0,
		new OrbitScoreEvaluator(2, 1, 0.2, 0.5, 1)
	);
}

/** 2つのplanning sessionを完了まで1候補ずつ進めます。 */
function finish(session: CpuPlanningSession): CpuCandidateResult {
	while (!session.isComplete) session.step(1);
	return session.bestResult!;
}

describe("CpuPlanningSession", (): void => {
	it("step(1)ごとに1候補だけ進み、Normalの72候補後にbestを返す", (): void => {
		const session: CpuPlanningSession = new CpuPlanningSession(
			createContext(),
			CpuDifficulty.Normal,
			new CpuCandidateGenerator(1000, 1280),
			new CpuShotSimulator()
		);

		expect(session.evaluatedCandidateCount).toBe(0);
		expect(session.totalCandidateCount).toBe(72);
		expect(session.step(1)).toBe(1);
		expect(session.evaluatedCandidateCount).toBe(1);
		while (!session.isComplete) {
			const before: number = session.evaluatedCandidateCount;
			const evaluated: number = session.step(1);
			expect(evaluated).toBe(1);
			expect(session.evaluatedCandidateCount).toBe(before + 1);
		}
		expect(session.evaluatedCandidateCount).toBe(72);
		expect(session.bestResult).toBeDefined();
	});

	it("同じ盤面・難易度なら2回とも同じcandidateを選ぶ", (): void => {
		const generator: CpuCandidateGenerator = new CpuCandidateGenerator(1000, 1280);
		const first: CpuCandidateResult = finish(new CpuPlanningSession(
			createContext(), CpuDifficulty.Easy, generator, new CpuShotSimulator()
		));
		const second: CpuCandidateResult = finish(new CpuPlanningSession(
			createContext(), CpuDifficulty.Easy, generator, new CpuShotSimulator()
		));

		expect(first.candidate.virtualDragXPixels).toBeCloseTo(second.candidate.virtualDragXPixels, 12);
		expect(first.candidate.virtualDragYPixels).toBeCloseTo(second.candidate.virtualDragYPixels, 12);
		expect(first.candidate.velocity.x).toBeCloseTo(second.candidate.velocity.x, 12);
		expect(first.candidate.velocity.y).toBeCloseTo(second.candidate.velocity.y, 12);
	});
});
