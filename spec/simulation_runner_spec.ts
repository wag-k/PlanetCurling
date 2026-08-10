import {IPhysicsIntegrator, PhysicsIntegratorKind} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {Setting} from "../src/setting";
import {SimulationRunner} from "../src/simulation_runner";

describe("固定タイムステップ", (): void => {
	it("PhysicsStepSecondsは6時間である", (): void => {
		expect(Setting.PhysicsStepSeconds).toBe(6 * 60 * 60);
	});

	it("30日を6時間刻みの120ステップで進める", (): void => {
		let calls: number = 0;
		const integrator: IPhysicsIntegrator = {
			kind: PhysicsIntegratorKind.SymplecticEuler,
			step: (_world: PhysicsWorld, deltaTimeSeconds: number): void => {
				expect(deltaTimeSeconds).toBe(Setting.PhysicsStepSeconds);
				calls += 1;
			}
		};
		const runner: SimulationRunner = new SimulationRunner(
			new PhysicsWorld(),
			integrator,
			Setting.PhysicsStepSeconds
		);

		expect(runner.advance(30 * Setting.SecondsPerDay)).toBe(120);
		expect(calls).toBe(120);
		expect(runner.getCompletedStepCount()).toBe(120);
	});

	it("固定刻み未満の端数を次回へ保持する", (): void => {
		let calls: number = 0;
		const integrator: IPhysicsIntegrator = {
			kind: PhysicsIntegratorKind.SymplecticEuler,
			step: (): void => {
				calls += 1;
			}
		};
		const runner: SimulationRunner = new SimulationRunner(
			new PhysicsWorld(),
			integrator,
			Setting.PhysicsStepSeconds
		);

		expect(runner.advance(Setting.PhysicsStepSeconds + 100)).toBe(1);
		expect(runner.getRemainingSimulationSeconds()).toBe(100);
		expect(runner.advance(Setting.PhysicsStepSeconds - 100)).toBe(1);
		expect(runner.getRemainingSimulationSeconds()).toBe(0);
		expect(calls).toBe(2);
	});
});
