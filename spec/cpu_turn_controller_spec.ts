import {CpuShotCandidate} from "../src/cpu_candidate";
import {ICpuPlanningSession, ICpuShotPlanner} from "../src/cpu_planner";
import {CpuSettings} from "../src/cpu_settings";
import {CpuCandidateResult, CpuBoardMetrics, CpuSimulationContext} from "../src/cpu_simulation";
import {CpuTurnController, CpuTurnState} from "../src/cpu_turn_controller";
import {CpuDifficulty, GameMode, GameSessionConfig} from "../src/game_session";
import {MatchController, MatchState, Player} from "../src/match_controller";
import {IPhysicsIntegrator, PhysicsIntegratorKind} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {Setting} from "../src/setting";
import {SimulationRunner} from "../src/simulation_runner";
import {TrajectoryPredictor} from "../src/trajectory";
import {Velocity} from "../src/motion";

/** 1回のstepで固定bestを返すCpuTurnController状態遷移用sessionです。 */
class ImmediatePlanningSession implements ICpuPlanningSession {
	/** 評価済み件数です。 */
	private evaluated: number = 0;
	/** releaseへ渡す固定bestです。 */
	private readonly result: CpuCandidateResult;

	/** 固定候補を1件だけ持つsessionを生成します。 */
	constructor(result: CpuCandidateResult) {
		this.result = result;
	}

	/** 評価済み件数を返します。 */
	get evaluatedCandidateCount(): number { return this.evaluated; }
	/** 全1件のcandidate数を返します。 */
	get totalCandidateCount(): number { return 1; }
	/** 1件評価後ならtrueを返します。 */
	get isComplete(): boolean { return this.evaluated === 1; }
	/** 評価後だけ固定bestを返します。 */
	get bestResult(): CpuCandidateResult | undefined { return this.isComplete ? this.result : undefined; }
	/** 最大1件だけ評価します。 */
	step(maxEvaluations: number): number {
		if (maxEvaluations <= 0 || this.isComplete) return 0;
		this.evaluated = 1;
		return 1;
	}
}

/** start回数を記録し、即時完了sessionを返すテスト用plannerです。 */
class ImmediateShotPlanner implements ICpuShotPlanner {
	/** planning開始回数です。 */
	startCount: number = 0;
	/** 各開始時に返す固定候補結果です。 */
	private readonly result: CpuCandidateResult;

	/** 固定候補を保持します。 */
	constructor(result: CpuCandidateResult) { this.result = result; }

	/** 開始回数を増やし、新しい1件sessionを返します。 */
	startPlanning(_context: CpuSimulationContext, _difficulty: CpuDifficulty): ICpuPlanningSession {
		this.startCount += 1;
		return new ImmediatePlanningSession(this.result);
	}
}

/** 数値計算を省略し、10年のTurn進行だけを高速に行うintegratorを生成します。 */
function noOpIntegrator(): IPhysicsIntegrator {
	return {
		kind: PhysicsIntegratorKind.SymplecticEuler,
		step: (): void => {
			// 状態遷移テストではNewton物理自体を既存specと重複検証しません。
		}
	};
}

/** Redの1投を完了し、Blue Aimingへ進めたcontrollerを返します。 */
function createBlueTurnController(): MatchController {
	const controller: MatchController = new MatchController(new SimulationRunner(
		new PhysicsWorld(), noOpIntegrator(), Setting.PhysicsStepSeconds
	));
	controller.simulationRunner.setCollisionSystem(undefined);
	controller.releaseActiveStone();
	controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds);
	controller.completeTurnTransition();
	controller.stones[0].body.pos.x = 0;
	return controller;
}

/** End 1を6投完了し、Blue先手のEnd 2 Aimingへ進めます。 */
function createSecondEndController(): MatchController {
	const controller: MatchController = new MatchController(new SimulationRunner(
		new PhysicsWorld(), noOpIntegrator(), Setting.PhysicsStepSeconds
	));
	controller.simulationRunner.setCollisionSystem(undefined);
	for (let shotIndex: number = 0; shotIndex < controller.maximumShotsPerEnd; shotIndex += 1) {
		controller.releaseActiveStone();
		controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds);
		if (shotIndex < controller.maximumShotsPerEnd - 1) controller.completeTurnTransition();
	}
	expect(controller.state).toBe(MatchState.EndTransition);
	controller.completeEndTransition();
	return controller;
}

/** 予測とreleaseへ渡す固定best候補を生成します。 */
function createBestResult(): CpuCandidateResult {
	const shot: CpuShotCandidate = new CpuShotCandidate(100, 0, 100, 0, new Velocity(-10, 0));
	return new CpuCandidateResult(
		shot,
		new CpuBoardMetrics(3, 0, 3, 1, 0, 0, 0, 0),
		3060,
		[]
	);
}

/** controllerとfake plannerを接続するCpuTurnControllerを生成します。 */
function createCpuTurn(
	config: GameSessionConfig,
	matchController: MatchController,
	planner: ImmediateShotPlanner
): CpuTurnController {
	return new CpuTurnController(
		config,
		matchController,
		new TrajectoryPredictor(
			PhysicsIntegratorKind.SymplecticEuler,
			Setting.PhysicsStepSeconds,
			Setting.PhysicsStepSeconds,
			Setting.PhysicsStepSeconds
		),
		1000,
		1280,
		planner
	);
}

describe("CpuTurnController", (): void => {
	it("Local 2PではBlue Aimingでもplanningへ介入せず人間入力を許可する", (): void => {
		const matchController: MatchController = createBlueTurnController();
		const planner: ImmediateShotPlanner = new ImmediateShotPlanner(createBestResult());
		const cpu: CpuTurnController = createCpuTurn(
			new GameSessionConfig(GameMode.LocalTwoPlayer, CpuDifficulty.Normal), matchController, planner
		);

		cpu.update();

		expect(cpu.state).toBe(CpuTurnState.Idle);
		expect(planner.startCount).toBe(0);
		expect(cpu.isHumanStoneInputAllowed).toBe(true);
		expect(matchController.state).toBe(MatchState.Aiming);
	});

	it("Vs CPUはRedをHuman、BlueをPlanning→Prediction→15frame Preview→通常releaseへ進める", (): void => {
		const redController: MatchController = new MatchController(new SimulationRunner(
			new PhysicsWorld(), noOpIntegrator(), Setting.PhysicsStepSeconds
		));
		redController.simulationRunner.setCollisionSystem(undefined);
		const redPlanner: ImmediateShotPlanner = new ImmediateShotPlanner(createBestResult());
		const config: GameSessionConfig = new GameSessionConfig(GameMode.VsCpu, CpuDifficulty.Normal);
		const redCpu: CpuTurnController = createCpuTurn(config, redController, redPlanner);
		expect(redController.currentPlayer).toBe(Player.Red);
		expect(redCpu.isHumanStoneInputAllowed).toBe(true);
		redCpu.update();
		expect(redPlanner.startCount).toBe(0);

		const matchController: MatchController = createBlueTurnController();
		const planner: ImmediateShotPlanner = new ImmediateShotPlanner(createBestResult());
		const cpu: CpuTurnController = createCpuTurn(config, matchController, planner);
		expect(cpu.isHumanStoneInputAllowed).toBe(false);

		cpu.update();
		expect(planner.startCount).toBe(1);
		expect(cpu.state).toBe(CpuTurnState.Previewing);
		expect(matchController.activeStone!.predictedTrajectory.length).toBeGreaterThan(0);
		for (let frame: number = 0; frame < CpuSettings.PreviewFrames - 1; frame += 1) cpu.update();
		expect(matchController.state).toBe(MatchState.Aiming);
		cpu.update();
		expect(matchController.state).toBe(MatchState.Simulating);
		expect(matchController.blueCompletedShotsThisEnd).toBe(1);
		expect(cpu.state).toBe(CpuTurnState.Idle);
	});

	it("End 2開始時はBlue CPUが先手として自動的にplanningを開始する", (): void => {
		const matchController: MatchController = createSecondEndController();
		const planner: ImmediateShotPlanner = new ImmediateShotPlanner(createBestResult());
		const cpu: CpuTurnController = createCpuTurn(
			new GameSessionConfig(GameMode.VsCpu, CpuDifficulty.Normal), matchController, planner
		);

		expect(matchController.currentEndNumber).toBe(2);
		expect(matchController.currentPlayer).toBe(Player.Blue);
		expect(cpu.isHumanStoneInputAllowed).toBe(false);
		cpu.update();

		expect(planner.startCount).toBe(1);
		expect(cpu.state).toBe(CpuTurnState.Previewing);
		expect(matchController.activeStone!.predictedTrajectory.length).toBeGreaterThan(0);
	});

	it("Local 2PのEnd 2 Blue先手ではCPUを開始せず人間入力を許可する", (): void => {
		const matchController: MatchController = createSecondEndController();
		const planner: ImmediateShotPlanner = new ImmediateShotPlanner(createBestResult());
		const cpu: CpuTurnController = createCpuTurn(
			new GameSessionConfig(GameMode.LocalTwoPlayer, CpuDifficulty.Normal), matchController, planner
		);

		cpu.update();

		expect(planner.startCount).toBe(0);
		expect(cpu.state).toBe(CpuTurnState.Idle);
		expect(cpu.isHumanStoneInputAllowed).toBe(true);
	});
});
