import {ICpuPlanningSession, ICpuShotPlanner} from "../src/cpu_planner";
import {CpuCandidateResult, CpuSimulationContext} from "../src/cpu_simulation";
import {CpuTurnController} from "../src/cpu_turn_controller";
import {GameBalance} from "../src/game_balance";
import {CpuDifficulty, GameMode, GameSessionConfig} from "../src/game_session";
import {MatchController, MatchState} from "../src/match_controller";
import {OrbitScoreEvaluator} from "../src/orbit_score";
import {PhysicalConstant} from "../src/physical_constant";
import {IPhysicsIntegrator, PhysicsIntegratorKind} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {RulesContent} from "../src/rules_content";
import {RulesInteractionGate, RulesOverlayState} from "../src/rules_state";
import {Setting} from "../src/setting";
import {SimulationRunner} from "../src/simulation_runner";
import {TrajectoryPredictor} from "../src/trajectory";

/** Candidate評価数だけを増やし、pause中の継続性を検証するplanning sessionです。 */
class CountingPlanningSession implements ICpuPlanningSession {
	/** 現在までに評価したcandidate数です。 */
	private evaluated: number = 0;

	/** 評価済みcandidate数を返します。 */
	get evaluatedCandidateCount(): number { return this.evaluated; }
	/** 完了までのcandidate総数を返します。 */
	get totalCandidateCount(): number { return 100; }
	/** このpause test中には完了しません。 */
	get isComplete(): boolean { return false; }
	/** 未完了なのでbest resultは返しません。 */
	get bestResult(): CpuCandidateResult | undefined { return undefined; }

	/** 指定上限だけ評価数を増やします。 */
	step(maxEvaluations: number): number {
		this.evaluated += maxEvaluations;
		return maxEvaluations;
	}
}

/** 同じCountingPlanningSessionを返し、再開時に探索が継続することを観測します。 */
class CountingShotPlanner implements ICpuShotPlanner {
	/** CPU controllerへ返す継続可能sessionです。 */
	readonly session: CountingPlanningSession = new CountingPlanningSession();
	/** planning開始回数です。 */
	startCount: number = 0;

	/** 現在盤面を変更せず、counting sessionを返します。 */
	startPlanning(_context: CpuSimulationContext, _difficulty: CpuDifficulty): ICpuPlanningSession {
		this.startCount += 1;
		return this.session;
	}
}

/** 数値計算を省略してapplication stateのpauseだけを検証するintegratorです。 */
function noOpIntegrator(): IPhysicsIntegrator {
	return {
		kind: PhysicsIntegratorKind.SymplecticEuler,
		step: (): void => {
			// Rules testでは既存physics specと数値計算を重複検証しません。
		}
	};
}

/** 新規試合のControllerを軽量integratorで生成します。 */
function createMatchController(): MatchController {
	const runner: SimulationRunner = new SimulationRunner(
		new PhysicsWorld(),
		noOpIntegrator(),
		Setting.PhysicsStepSeconds
	);
	runner.setCollisionSystem(undefined);
	return new MatchController(runner);
}

/** Redの1投を完了させ、Blue CPUのAimingへ進めます。 */
function createBlueTurnController(): MatchController {
	const controller: MatchController = createMatchController();
	controller.releaseActiveStone();
	controller.advanceSimulation(Setting.SimulationDurationPerShotSeconds);
	controller.completeTurnTransition();
	return controller;
}

/** CPU pause test用Controllerとcounting plannerを接続します。 */
function createCpuTurn(controller: MatchController, planner: CountingShotPlanner): CpuTurnController {
	return new CpuTurnController(
		new GameSessionConfig(GameMode.VsCpu, CpuDifficulty.Normal),
		controller,
		new TrajectoryPredictor(
			PhysicsIntegratorKind.SymplecticEuler,
			Setting.PhysicsStepSeconds,
			Setting.PhysicsStepSeconds,
			Setting.PhysicsStepSeconds
		),
		GameBalance.WorldSpanMeters,
		1280,
		planner
	);
}

/** 全pageの表示文を単純な配列へ平坦化します。 */
function allRulesText(content: RulesContent): string[] {
	const lines: string[] = [];
	content.pages.forEach((page): void => {
		lines.push(page.title);
		page.sections.forEach((section): void => {
			lines.push(section.title);
			section.lines.forEach((line): void => {
				lines.push(line.text);
			});
		});
	});
	return lines;
}

describe("G6.2 Rules content and navigation", (): void => {
	it("Match Format / Goal / Play / Tacticsの4ページを定義する", (): void => {
		const content: RulesContent = RulesContent.createDefault();

		expect(content.pages.length).toBe(4);
		expect(content.pages.map((page): string => page.title)).toEqual([
			"MATCH FORMAT",
			"GOAL & SCORE",
			"HOW TO PLAY",
			"COLLISIONS & TACTICS"
		]);
	});

	it("Next / Previousで移動し、両端の範囲外へ進まない", (): void => {
		const state: RulesOverlayState = new RulesOverlayState(RulesContent.createDefault());
		state.show();

		state.movePrevious();
		expect(state.pageIndex).toBe(0);
		state.moveNext();
		expect(state.pageIndex).toBe(1);
		state.moveNext();
		expect(state.pageIndex).toBe(2);
		state.moveNext();
		expect(state.pageIndex).toBe(3);
		state.moveNext();
		expect(state.pageIndex).toBe(3);
		state.movePrevious();
		expect(state.pageIndex).toBe(2);
		expect(state.pageIndicator).toBe("3 / 4");
	});

	it("2 End・各3投・先後交代・盤面reset・合計得点を説明する", (): void => {
		const lines: string[] = allRulesText(RulesContent.createDefault());

		expect(lines).toContain("Each player throws 3 planets per End.");
		expect(lines).toContain("END 1: RED STARTS. BLUE HAS THE FINAL SHOT.");
		expect(lines).toContain("END 2: BLUE STARTS. RED HAS THE FINAL SHOT.");
		expect(lines).toContain("The board resets between Ends.");
		expect(lines).toContain("Scores from both Ends are added together.");
	});

	it("得点詳細を現在のOrbitScoreEvaluator / GameBalance / Settingから生成する", (): void => {
		const evaluator: OrbitScoreEvaluator = new OrbitScoreEvaluator();
		const lines: string[] = allRulesText(RulesContent.createDefault(evaluator));
		const targetAu: string = (GameBalance.TargetOrbitRadiusMetres / PhysicalConstant.AstroUnit).toFixed(0) + " AU";
		const threeAu: string = (GameBalance.ThreePointOrbitErrorMetres / PhysicalConstant.AstroUnit).toFixed(2) + " AU";
		const twoAu: string = (GameBalance.TwoPointOrbitErrorMetres / PhysicalConstant.AstroUnit).toFixed(2) + " AU";
		const oneAu: string = (GameBalance.OnePointOrbitErrorMetres / PhysicalConstant.AstroUnit).toFixed(2) + " AU";

		expect(evaluator.targetRadiusMetres).toBe(GameBalance.TargetOrbitRadiusMetres);
		expect(evaluator.velocityReferenceSeconds).toBe(Setting.ScoreVelocityReferenceSeconds);
		expect(lines).toContain("Target orbit: " + targetAu + " from the Sun");
		expect(lines).toContain("3 points: <= " + threeAu);
		expect(lines).toContain("2 points: <= " + twoAu);
		expect(lines).toContain("1 point: <= " + oneAu + "   otherwise: 0 points");
		expect(lines).toContain("Effective error = distance error + radial speed x 1 game year");
	});
});

describe("G6.1 Rules pause and input gate", (): void => {
	it("表示中はSimulationを進めず、閉じると同じstateから再開する", (): void => {
		const controller: MatchController = createMatchController();
		controller.releaseActiveStone();
		const state: RulesOverlayState = new RulesOverlayState(RulesContent.createDefault());
		const gate: RulesInteractionGate = new RulesInteractionGate(state);
		const before: number = controller.currentShotSimulationElapsedSeconds;
		state.show();

		expect(gate.runFrame((): void => {
			controller.advanceSimulation(Setting.PhysicsStepSeconds);
		})).toBe(false);
		expect(controller.currentShotSimulationElapsedSeconds).toBe(before);

		state.close();
		expect(gate.runFrame((): void => {
			controller.advanceSimulation(Setting.PhysicsStepSeconds);
		})).toBe(true);
		expect(controller.currentShotSimulationElapsedSeconds).toBeGreaterThan(before);
	});

	it("表示中はCPU candidateを評価せず、閉じると同じplanning sessionを継続する", (): void => {
		const planner: CountingShotPlanner = new CountingShotPlanner();
		const cpu: CpuTurnController = createCpuTurn(createBlueTurnController(), planner);
		const state: RulesOverlayState = new RulesOverlayState(RulesContent.createDefault());
		const gate: RulesInteractionGate = new RulesInteractionGate(state);
		gate.runFrame((): void => cpu.update());
		const beforePause: number = cpu.evaluatedCandidateCount;
		state.show();

		gate.runFrame((): void => cpu.update());
		expect(cpu.evaluatedCandidateCount).toBe(beforePause);
		expect(planner.startCount).toBe(1);

		state.close();
		gate.runFrame((): void => cpu.update());
		expect(cpu.evaluatedCandidateCount).toBeGreaterThan(beforePause);
		expect(planner.startCount).toBe(1);
	});

	it("表示中はHuman Stoneをreleaseできず、閉じると通常releaseできる", (): void => {
		const controller: MatchController = createMatchController();
		const state: RulesOverlayState = new RulesOverlayState(RulesContent.createDefault());
		const gate: RulesInteractionGate = new RulesInteractionGate(state);
		state.show();

		expect(gate.runHumanInput((): void => { controller.releaseActiveStone(); })).toBe(false);
		expect(controller.state).toBe(MatchState.Aiming);

		state.close();
		expect(gate.runHumanInput((): void => { controller.releaseActiveStone(); })).toBe(true);
		expect(controller.state).toBe(MatchState.Simulating);
	});
});
