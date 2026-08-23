import {GameBalance} from "../src/game_balance";
import {
	CurlingStone,
	EndResult,
	MatchController,
	MatchResult,
	MatchState,
	Player,
	StoneScoreStatusKind
} from "../src/match_controller";
import {Velocity} from "../src/motion";
import {Planet} from "../src/planet";
import {PhysicalConstant} from "../src/physical_constant";
import {IPhysicsIntegrator, PhysicsIntegratorKind} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {Setting} from "../src/setting";
import {SimulationRunner} from "../src/simulation_runner";
import {TrajectoryPoint} from "../src/trajectory";

/** 位置計算を省略し、ゲーム進行の固定ステップ数だけを検証できるControllerを生成します。 */
function createController(): MatchController {
	const integrator: IPhysicsIntegrator = {
		kind: PhysicsIntegratorKind.SymplecticEuler,
		step: (): void => {
			// ゲーム進行テストでは既存積分器の数値計算を重複検証しません。
		}
	};
	const controller: MatchController = new MatchController(new SimulationRunner(
		new PhysicsWorld(), integrator, Setting.PhysicsStepSeconds
	));
	controller.simulationRunner.setCollisionSystem(undefined);
	return controller;
}

/** activeStoneを指定点数の軌道へ置き、現在の1投を完了します。 */
function throwScoredStone(controller: MatchController, points: number): void {
	const errorByPoints: {[key: number]: number} = {0: 1.1, 1: 0.7, 2: 0.3, 3: 0};
	const activeBody: Planet = controller.activeStone!.body;
	activeBody.pos.x = controller.centralBody.pos.x
		+ GameBalance.TargetOrbitRadiusMetres
		+ errorByPoints[points] * PhysicalConstant.AstroUnit;
	activeBody.pos.y = controller.centralBody.pos.y;
	activeBody.velocity.x = controller.centralBody.velocity.x;
	activeBody.velocity.y = controller.centralBody.velocity.y;
	expect(controller.releaseActiveStone()).toBe(true);
	controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds);
}

/** 現在Endを先手から交互に6投進め、実際の投球順を返します。 */
function completeCurrentEnd(
	controller: MatchController,
	redPoints: number[],
	bluePoints: number[]
): Player[] {
	const order: Player[] = [];
	for (let shotIndex: number = 0; shotIndex < controller.maximumShotsPerEnd; shotIndex += 1) {
		const player: Player = controller.currentPlayer;
		order.push(player);
		const playerShotIndex: number = player === Player.Red
			? controller.redCompletedShotsThisEnd
			: controller.blueCompletedShotsThisEnd;
		throwScoredStone(controller, (player === Player.Red ? redPoints : bluePoints)[playerShotIndex]);
		if (shotIndex < controller.maximumShotsPerEnd - 1) {
			expect(controller.state).toBe(MatchState.TurnTransition);
			expect(controller.completeTurnTransition()).toBe(true);
		}
	}
	return order;
}

/** 2つのEndを指定得点で完了し、MatchFinishedへ進めます。 */
function completeMatch(
	controller: MatchController,
	end1Red: number[],
	end1Blue: number[],
	end2Red: number[],
	end2Blue: number[]
): void {
	completeCurrentEnd(controller, end1Red, end1Blue);
	expect(controller.state).toBe(MatchState.EndTransition);
	expect(controller.completeEndTransition()).toBe(true);
	controller.simulationRunner.setCollisionSystem(undefined);
	completeCurrentEnd(controller, end2Red, end2Blue);
}

describe("G6.2 2 End制のターン進行", (): void => {
	it("End 1はRed、End 2はBlueが先手となり、各3投・合計12投で終了する", (): void => {
		const controller: MatchController = createController();
		const end1Order: Player[] = completeCurrentEnd(controller, [0, 0, 0], [0, 0, 0]);

		expect(end1Order).toEqual([Player.Red, Player.Blue, Player.Red, Player.Blue, Player.Red, Player.Blue]);
		expect(controller.state).toBe(MatchState.EndTransition);
		expect(controller.endResults).toHaveLength(1);
		expect(controller.completeEndTransition()).toBe(true);
		controller.simulationRunner.setCollisionSystem(undefined);
		const end2Order: Player[] = completeCurrentEnd(controller, [0, 0, 0], [0, 0, 0]);

		expect(end2Order).toEqual([Player.Blue, Player.Red, Player.Blue, Player.Red, Player.Blue, Player.Red]);
		expect(controller.state).toBe(MatchState.MatchFinished);
		expect(controller.redCompletedShotsThisEnd).toBe(3);
		expect(controller.blueCompletedShotsThisEnd).toBe(3);
		expect(controller.endResults).toHaveLength(2);
		expect(controller.activeStone).toBeUndefined();
	});

	it("End 1の第6投後は試合終了せず、先後と得点をEndResultへ固定する", (): void => {
		const controller: MatchController = createController();
		completeCurrentEnd(controller, [3, 0, 1], [2, 1, 0]);

		expect(controller.state).toBe(MatchState.EndTransition);
		expect(controller.result).toBeUndefined();
		expect(controller.endResults).toEqual([
			new EndResult(1, Player.Red, Player.Blue, 4, 3)
		]);
		expect(controller.totalRedScore).toBe(4);
		expect(controller.totalBlueScore).toBe(3);
	});

	it("NEXT ENDでStone・軌跡・World・中央天体・衝突参照を新しい盤面へ置換する", (): void => {
		const controller: MatchController = createController();
		const firstStone: CurlingStone = controller.activeStone!;
		firstStone.setPredictedTrajectory([new TrajectoryPoint(1, 2, 0)]);
		completeCurrentEnd(controller, [0, 0, 0], [0, 0, 0]);
		const oldCentralBody: Planet = controller.centralBody;
		const oldStoneBodies: Planet[] = controller.stones.map((stone: CurlingStone): Planet => stone.body);

		expect(controller.completeEndTransition()).toBe(true);

		expect(controller.currentEndNumber).toBe(2);
		expect(controller.currentEndStartingPlayer).toBe(Player.Blue);
		expect(controller.currentPlayer).toBe(Player.Blue);
		expect(controller.stones).toHaveLength(1);
		expect(controller.stones[0].actualTrajectory).toHaveLength(0);
		expect(controller.stones[0].predictedTrajectory).toHaveLength(0);
		expect(controller.centralBody).not.toBe(oldCentralBody);
		expect(controller.simulationRunner.world.bodies).toEqual([
			controller.centralBody,
			controller.activeStone!.body
		]);
		expect(controller.simulationRunner.world.bodies).not.toContain(oldCentralBody);
		oldStoneBodies.forEach((body: Planet): void => {
			expect(controller.simulationRunner.world.bodies).not.toContain(body);
		});
		expect(controller.simulationRunner.getCollisionSystem()).toBeDefined();
	});

	it("End 1の得点を盤面破棄後も保持し、End 2との合計で勝敗を決める", (): void => {
		const controller: MatchController = createController();
		completeCurrentEnd(controller, [2, 1, 1], [2, 2, 1]);
		const lockedEnd1: EndResult = controller.endResults[0];
		expect(lockedEnd1).toEqual(new EndResult(1, Player.Red, Player.Blue, 4, 5));

		controller.completeEndTransition();
		controller.simulationRunner.setCollisionSystem(undefined);
		controller.activeStone!.body.pos.x = controller.centralBody.pos.x;
		expect(controller.endResults[0]).toEqual(lockedEnd1);
		completeCurrentEnd(controller, [3, 3, 0], [1, 1, 1]);

		expect(controller.endResults[1]).toEqual(new EndResult(2, Player.Blue, Player.Red, 6, 3));
		expect(controller.totalRedScore).toBe(10);
		expect(controller.totalBlueScore).toBe(8);
		expect(controller.result).toBe(MatchResult.RedWin);
	});

	it.each([
		[[3, 3, 3], [0, 0, 0], MatchResult.RedWin, 18, 0],
		[[0, 0, 0], [3, 3, 3], MatchResult.BlueWin, 0, 18],
		[[2, 2, 2], [2, 2, 2], MatchResult.Draw, 12, 12]
	])(
		"2 End合計を %s / %s として %s を確定する",
		(redPoints: number[], bluePoints: number[], result: MatchResult, redTotal: number, blueTotal: number): void => {
			const controller: MatchController = createController();
			completeMatch(controller, redPoints, bluePoints, redPoints, bluePoints);

			expect(controller.state).toBe(MatchState.MatchFinished);
			expect(controller.totalRedScore).toBe(redTotal);
			expect(controller.totalBlueScore).toBe(blueTotal);
			expect(controller.result).toBe(result);
		}
	);
});

describe("現在Endの盤面状態", (): void => {
	it("activeStoneを除外し、現在Endのリリース済みStoneだけを動的に採点する", (): void => {
		const controller: MatchController = createController();
		const stone: CurlingStone = controller.activeStone!;
		stone.body.pos.x = controller.centralBody.pos.x + GameBalance.TargetOrbitRadiusMetres;
		stone.body.pos.y = controller.centralBody.pos.y;

		expect(controller.currentEndRedScore).toBe(0);
		controller.releaseActiveStone();
		expect(controller.currentEndRedScore).toBe(3);
		expect(controller.totalRedScore).toBe(0);
		stone.body.pos.x += 0.6 * PhysicalConstant.AstroUnit;
		expect(controller.currentEndRedScore).toBe(1);
		expect(controller.currentEndBlueScore).toBe(0);
	});

	it("新しい投球でも現在Endの中央天体と過去Stoneを残し、activeStoneだけを操作する", (): void => {
		const controller: MatchController = createController();
		const centralBody: Planet = controller.centralBody;
		const firstStoneBody: Planet = controller.activeStone!.body;
		controller.setActiveStoneVelocity(new Velocity(10, 20));
		throwScoredStone(controller, 0);
		controller.completeTurnTransition();
		const firstVelocity: Velocity = firstStoneBody.velocity.clone();

		expect(controller.simulationRunner.world.bodies).toContain(centralBody);
		expect(controller.simulationRunner.world.bodies).toContain(firstStoneBody);
		expect(controller.setActiveStoneVelocity(new Velocity(-30, 40))).toBe(true);
		expect(firstStoneBody.velocity).toEqual(firstVelocity);
		expect(controller.activeStone!.body.velocity).toEqual(new Velocity(-30, 40));
	});

	it("10年の固定dt境界で停止し、余分なフレーム時間を進めない", (): void => {
		const controller: MatchController = createController();
		const halfStep: number = Setting.PhysicsStepSeconds / 2;
		controller.releaseActiveStone();
		controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds - halfStep);

		expect(controller.state).toBe(MatchState.Simulating);
		expect(controller.simulationRunner.getRemainingSimulationSeconds()).toBe(halfStep);
		controller.advanceSimulation(10 * Setting.SecondsPerDay);
		expect(controller.state).toBe(MatchState.TurnTransition);
		expect(controller.currentShotSimulationElapsedSeconds).toBe(Setting.SimulationDurationPerShotSeconds);
		expect(controller.simulationRunner.getRemainingSimulationSeconds()).toBe(0);
	});

	it("リリース時の予測と実軌跡をEnd内で保持し、次End開始時に消去する", (): void => {
		const controller: MatchController = createController();
		const firstStone: CurlingStone = controller.activeStone!;
		const prediction: TrajectoryPoint[] = [
			new TrajectoryPoint(firstStone.body.pos.x, firstStone.body.pos.y, 0),
			new TrajectoryPoint(firstStone.body.pos.x + 1, firstStone.body.pos.y + 2, Setting.SecondsPerDay)
		];
		controller.setActiveStonePredictedTrajectory(prediction);
		controller.releaseActiveStone();
		controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds);
		expect(firstStone.predictedTrajectory).toEqual(prediction);
		expect(firstStone.actualTrajectory.length).toBeGreaterThan(1);

		for (let shotIndex: number = 1; shotIndex < controller.maximumShotsPerEnd; shotIndex += 1) {
			controller.completeTurnTransition();
			throwScoredStone(controller, 0);
		}
		controller.completeEndTransition();

		expect(controller.stones).toHaveLength(1);
		expect(controller.stones[0].predictedTrajectory).toHaveLength(0);
		expect(controller.stones[0].actualTrajectory).toHaveLength(0);
	});

	it("HUD用Stone状態を未投球・0～3点・吸収へ変換する", (): void => {
		const controller: MatchController = createController();
		const stone: CurlingStone = controller.activeStone!;
		expect(controller.getStoneScoreStatus(stone).kind).toBe(StoneScoreStatusKind.Unreleased);
		stone.body.pos.x = controller.centralBody.pos.x + GameBalance.TargetOrbitRadiusMetres;
		stone.body.pos.y = controller.centralBody.pos.y;
		controller.releaseActiveStone();
		expect(controller.getStoneScoreStatus(stone).points).toBe(3);
		stone.markAbsorbed();
		expect(controller.getStoneScoreStatus(stone).kind).toBe(StoneScoreStatusKind.Absorbed);
	});
});

describe("New Game", (): void => {
	it("終了済みEnd・得点・勝敗・軌跡を消去し、End 1のRed先手へ戻る", (): void => {
		const controller: MatchController = createController();
		completeMatch(controller, [3, 3, 3], [0, 0, 0], [3, 3, 3], [0, 0, 0]);
		const previousCentralBody: Planet = controller.centralBody;
		expect(controller.result).toBe(MatchResult.RedWin);

		controller.newGame();

		expect(controller.state).toBe(MatchState.Aiming);
		expect(controller.currentEndNumber).toBe(1);
		expect(controller.currentEndStartingPlayer).toBe(Player.Red);
		expect(controller.currentPlayer).toBe(Player.Red);
		expect(controller.endResults).toHaveLength(0);
		expect(controller.totalRedScore).toBe(0);
		expect(controller.totalBlueScore).toBe(0);
		expect(controller.redCompletedShotsThisEnd).toBe(0);
		expect(controller.blueCompletedShotsThisEnd).toBe(0);
		expect(controller.stones).toHaveLength(1);
		expect(controller.stones[0].predictedTrajectory).toHaveLength(0);
		expect(controller.stones[0].actualTrajectory).toHaveLength(0);
		expect(controller.centralBody).not.toBe(previousCentralBody);
		expect(controller.result).toBeUndefined();
	});
});

describe("G6.2ゲーム設定", (): void => {
	it("各Endは1人3投、1試合は2 End・合計12投である", (): void => {
		expect(Setting.ShotsPerPlayerPerEnd).toBe(3);
		expect(Setting.EndsPerMatch).toBe(2);
		expect(Setting.ShotsPerPlayerPerEnd * 2 * Setting.EndsPerMatch).toBe(12);
	});

	it("1投後の物理時間は365日基準の10年で、6時間dtの整数倍である", (): void => {
		expect(Setting.SimulationDurationPerShotSeconds).toBe(10 * 365 * 24 * 60 * 60);
		expect(Setting.SimulationDurationPerShotSeconds % Setting.PhysicsStepSeconds).toBe(0);
	});

	it("投球惑星は中央天体の1%質量で、Newton重力の相互作用を強める", (): void => {
		expect(GameBalance.StoneMassKg).toBe(6 * Math.pow(10, 24));
		expect(GameBalance.CentralBodyMassKg).toBe(6 * Math.pow(10, 26));
		expect(GameBalance.StoneMassKg / GameBalance.CentralBodyMassKg).toBeCloseTo(0.01, 12);
	});
});
