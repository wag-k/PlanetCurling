import {GameBalance} from "../src/game_balance";
import {MatchController, MatchState, Player} from "../src/match_controller";
import {Velocity} from "../src/motion";
import {IPhysicsIntegrator, PhysicsIntegratorKind} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {Setting} from "../src/setting";
import {SimulationRunner} from "../src/simulation_runner";

/** 位置計算を省略し、ゲーム進行の固定ステップ数だけを検証できるControllerを生成します。 */
function createController(): MatchController {
	const integrator: IPhysicsIntegrator = {
		kind: PhysicsIntegratorKind.SymplecticEuler,
		step: (): void => {
			// ゲーム進行テストでは既存積分器の数値計算を重複検証しません。
		}
	};
	return new MatchController(new SimulationRunner(
		new PhysicsWorld(),
		integrator,
		Setting.PhysicsStepSeconds
	));
}

describe("ローカル2人対戦のターン進行", (): void => {
	it("RedとBlueが交互に3投ずつ投げ、合計6投で終了する", (): void => {
		const controller: MatchController = createController();
		const turnOrder: Player[] = [];

		for (let shotIndex: number = 0; shotIndex < 6; shotIndex += 1) {
			turnOrder.push(controller.currentPlayer);
			const throwingPlayer: Player = controller.currentPlayer;
			expect(controller.state).toBe(MatchState.Aiming);
			expect(controller.activeStone).toBeDefined();
			expect(controller.releaseActiveStone()).toBe(true);
			expect(controller.currentPlayer).toBe(throwingPlayer);
			controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds);

			if (shotIndex < 5) {
				expect(controller.state).toBe(MatchState.TurnTransition);
				expect(controller.completeTurnTransition()).toBe(true);
			} else {
				expect(controller.state).toBe(MatchState.MatchFinished);
			}
		}

		expect(turnOrder).toEqual([
			Player.Red,
			Player.Blue,
			Player.Red,
			Player.Blue,
			Player.Red,
			Player.Blue
		]);
		expect(controller.redShotCount).toBe(3);
		expect(controller.blueShotCount).toBe(3);
		expect(controller.totalCompletedShots).toBe(6);
		expect(controller.activeStone).toBeUndefined();
		const finishedStepCount: number = controller.simulationRunner.getCompletedStepCount();
		expect(controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds)).toBe(0);
		expect(controller.simulationRunner.getCompletedStepCount()).toBe(finishedStepCount);
		expect(controller.setActiveStoneVelocity(new Velocity(1, 1))).toBe(false);
	});

	it("5年の固定dt境界で停止し、余分なフレーム時間を進めない", (): void => {
		const controller: MatchController = createController();
		const halfStep: number = Setting.PhysicsStepSeconds / 2;

		controller.releaseActiveStone();
		controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds - halfStep);
		expect(controller.state).toBe(MatchState.Simulating);
		expect(controller.currentShotSimulationElapsedSeconds).toBe(
			Setting.SimulationDurationPerShotSeconds - Setting.PhysicsStepSeconds
		);
		expect(controller.simulationRunner.getRemainingSimulationSeconds()).toBe(halfStep);

		controller.advanceSimulation(10 * Setting.SecondsPerDay);
		expect(controller.state).toBe(MatchState.TurnTransition);
		expect(controller.currentShotSimulationElapsedSeconds).toBe(Setting.SimulationDurationPerShotSeconds);
		expect(controller.simulationRunner.getRemainingSimulationSeconds()).toBe(0);
		expect(controller.simulationRunner.getCompletedStepCount()).toBe(
			Setting.SimulationDurationPerShotSeconds / Setting.PhysicsStepSeconds
		);
	});

	it("新しい投球ごとにPlanetを追加し、中央天体と過去のPlanetを残す", (): void => {
		const controller: MatchController = createController();
		const centralBody = controller.centralBody;
		const firstStoneBody = controller.activeStone!.body;

		expect(controller.simulationRunner.world.bodies).toEqual([centralBody, firstStoneBody]);
		controller.releaseActiveStone();
		controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds);
		controller.completeTurnTransition();

		expect(controller.simulationRunner.world.bodies.length).toBe(3);
		expect(controller.simulationRunner.world.bodies).toContain(centralBody);
		expect(controller.simulationRunner.world.bodies).toContain(firstStoneBody);
		expect(controller.simulationRunner.world.bodies).toContain(controller.activeStone!.body);
	});

	it("速度変更はactiveStoneだけへ適用し、過去のPlanetを変更しない", (): void => {
		const controller: MatchController = createController();
		const firstStoneBody = controller.activeStone!.body;
		controller.setActiveStoneVelocity(new Velocity(10, 20));
		controller.releaseActiveStone();
		controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds);
		controller.completeTurnTransition();

		const firstVelocityBefore: Velocity = firstStoneBody.velocity.clone();
		const secondStoneBody = controller.activeStone!.body;
		expect(controller.setActiveStoneVelocity(new Velocity(-30, 40))).toBe(true);

		expect(firstStoneBody.velocity).toEqual(firstVelocityBefore);
		expect(secondStoneBody.velocity).toEqual(new Velocity(-30, 40));
	});

	it("New Gameで中央天体とRedの1投目だけの初期盤面へ戻る", (): void => {
		const controller: MatchController = createController();
		const previousCentralBody = controller.centralBody;
		controller.releaseActiveStone();
		controller.advanceSimulation(Setting.SecondsPerDay);

		controller.newGame();

		expect(controller.state).toBe(MatchState.Aiming);
		expect(controller.currentPlayer).toBe(Player.Red);
		expect(controller.redShotCount).toBe(0);
		expect(controller.blueShotCount).toBe(0);
		expect(controller.stones.length).toBe(1);
		expect(controller.simulationRunner.world.bodies.length).toBe(2);
		expect(controller.centralBody).not.toBe(previousCentralBody);
		expect(controller.simulationRunner.getCompletedStepCount()).toBe(0);
		expect(controller.simulationRunner.getRemainingSimulationSeconds()).toBe(0);
	});
});

describe("G1ゲーム設定", (): void => {
	it("1投後の物理時間は365日基準の5年で、6時間dtの整数倍である", (): void => {
		expect(Setting.SimulationDurationPerShotSeconds).toBe(5 * 365 * 24 * 60 * 60);
		expect(Setting.SimulationDurationPerShotSeconds % Setting.PhysicsStepSeconds).toBe(0);
	});

	it("投球惑星は中央天体の1%質量で、Newton重力の相互作用を強める", (): void => {
		expect(GameBalance.StoneMassKg).toBe(6 * Math.pow(10, 24));
		expect(GameBalance.CentralBodyMassKg).toBe(6 * Math.pow(10, 26));
		expect(GameBalance.StoneMassKg / GameBalance.CentralBodyMassKg).toBeCloseTo(0.01, 12);
	});
});
