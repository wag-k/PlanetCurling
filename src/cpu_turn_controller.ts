import {CpuShotPlanner, ICpuPlanningSession, ICpuShotPlanner} from "./cpu_planner";
import {CpuSettings} from "./cpu_settings";
import {CpuCandidateResult, CpuSimulationContext} from "./cpu_simulation";
import {GameMode, GameSessionConfig} from "./game_session";
import {MatchController, MatchState, Player} from "./match_controller";
import {TrajectoryPoint, TrajectoryPredictor} from "./trajectory";

/** MatchStateを増やさず、Blue CPUのアプリケーション上の進行だけを表します。 */
export enum CpuTurnState {
	/** CPU対象外、または次のBlue Aimingを待っている状態です。 */
	Idle = "Idle",
	/** clone世界で候補をframeごとに評価している状態です。 */
	Planning = "Planning",
	/** 最善手の既存予測線をrelease前に表示している状態です。 */
	Previewing = "Previewing"
}

/** Vs CPUのBlue Aimingだけを探索・予測・通常releaseへ接続するアプリケーション層です。 */
export class CpuTurnController {
	/** Rematchでも保持される対戦モードと難易度です。 */
	readonly sessionConfig: GameSessionConfig;
	/** Turn・Stone・本番physicsを所有する既存ゲームルール層です。 */
	readonly matchController: MatchController;
	/** 最善1候補だけの表示軌道を既存物理から生成する予測器です。 */
	readonly trajectoryPredictor: TrajectoryPredictor;
	/** 現在盤面からincremental sessionを作る探索器です。 */
	readonly shotPlanner: ICpuShotPlanner;
	/** 現在のCPUアプリケーション状態です。 */
	private currentState: CpuTurnState = CpuTurnState.Idle;
	/** 実行中のAiming盤面専用planning sessionです。 */
	private planningSession: ICpuPlanningSession | undefined;
	/** planningを開始したactive Stone参照です。盤面切替検出に使います。 */
	private planningActiveBody: object | undefined;
	/** releaseまで予測線を見せる残りframeです。 */
	private previewFramesRemaining: number = 0;
	/** 直前planningの開始時刻（ms）です。 */
	private planningStartedAtMilliseconds: number = 0;
	/** 直前に完了したplanning全体の実測時間（ms）です。 */
	private lastPlanningElapsedMillisecondsValue: number = 0;

	/** MatchControllerへCPU判断を混在させず、既存経路へ最善手だけを渡します。 */
	constructor(
		sessionConfig: GameSessionConfig,
		matchController: MatchController,
		trajectoryPredictor: TrajectoryPredictor,
		worldWidthMetres: number,
		viewportWidthPixels: number,
		shotPlanner?: ICpuShotPlanner
	) {
		this.sessionConfig = sessionConfig;
		this.matchController = matchController;
		this.trajectoryPredictor = trajectoryPredictor;
		this.shotPlanner = shotPlanner === undefined
			? new CpuShotPlanner(worldWidthMetres, viewportWidthPixels)
			: shotPlanner;
	}

	/** Idle・Planning・Previewingの現在値を返します。 */
	get state(): CpuTurnState {
		return this.currentState;
	}

	/** 現在sessionで評価済みのcandidate数を返します。 */
	get evaluatedCandidateCount(): number {
		return this.planningSession === undefined ? 0 : this.planningSession.evaluatedCandidateCount;
	}

	/** 現在sessionのglobal＋refinement予定candidate数を返します。 */
	get totalCandidateCount(): number {
		return this.planningSession === undefined ? 0 : this.planningSession.totalCandidateCount;
	}

	/** Thinking表示用の0～1進捗を返します。 */
	get planningProgress(): number {
		return this.totalCandidateCount === 0 ? 0
			: Math.max(0, Math.min(1, this.evaluatedCandidateCount / this.totalCandidateCount));
	}

	/** 直前に完了したCPU planningのwall-clock時間（ms）を返します。 */
	get lastPlanningElapsedMilliseconds(): number {
		return this.lastPlanningElapsedMillisecondsValue;
	}

	/** 現在Aiming Stoneを人間が操作してよい場合だけtrueを返します。 */
	get isHumanStoneInputAllowed(): boolean {
		if (this.matchController.state !== MatchState.Aiming) return false;
		return this.sessionConfig.gameMode === GameMode.LocalTwoPlayer
			|| this.matchController.currentPlayer === Player.Red;
	}

	/** 1frame分だけCPU進行を更新し、候補評価数を上限内に抑えます。 */
	update(): void {
		if (!this.shouldControlCurrentTurn()) {
			this.cancelPlanning();
			return;
		}
		if (this.matchController.activeStone === undefined) {
			this.cancelPlanning();
			return;
		}
		if (this.planningActiveBody !== undefined
			&& this.planningActiveBody !== this.matchController.activeStone.body) {
			this.cancelPlanning();
		}
		if (this.currentState === CpuTurnState.Idle) {
			this.startPlanning();
		}
		if (this.currentState === CpuTurnState.Planning) {
			this.advancePlanning();
		} else if (this.currentState === CpuTurnState.Previewing) {
			this.advancePreview();
		}
	}

	/** New Game・Mode変更時に進行中の探索とpreviewを破棄します。 */
	reset(): void {
		this.currentState = CpuTurnState.Idle;
		this.planningSession = undefined;
		this.planningActiveBody = undefined;
		this.previewFramesRemaining = 0;
	}

	/** 現在がVs CPUのBlue Aimingで、CPUが入力を担当すべき場合だけtrueを返します。 */
	private shouldControlCurrentTurn(): boolean {
		return this.sessionConfig.gameMode === GameMode.VsCpu
			&& this.matchController.state === MatchState.Aiming
			&& this.matchController.currentPlayer === Player.Blue;
	}

	/** Blue Aiming開始盤面をsnapshot入力にし、1-ply incremental探索を開始します。 */
	private startPlanning(): void {
		const context: CpuSimulationContext = CpuSimulationContext.fromMatchController(this.matchController);
		this.planningSession = this.shotPlanner.startPlanning(context, this.sessionConfig.cpuDifficulty);
		this.planningActiveBody = context.activeStoneBody;
		this.planningStartedAtMilliseconds = Date.now();
		this.currentState = CpuTurnState.Planning;
	}

	/** 設定数だけcandidateを評価し、完了時は最善手の既存predictionへ移ります。 */
	private advancePlanning(): void {
		if (this.planningSession === undefined) return;
		this.planningSession.step(CpuSettings.CandidateEvaluationsPerFrame);
		if (!this.planningSession.isComplete) return;
		this.lastPlanningElapsedMillisecondsValue = Date.now() - this.planningStartedAtMilliseconds;
		const best: CpuCandidateResult | undefined = this.planningSession.bestResult;
		if (best === undefined || this.matchController.activeStone === undefined) {
			this.cancelPlanning();
			return;
		}
		this.matchController.setActiveStoneVelocity(best.candidate.velocity);
		const points: TrajectoryPoint[] = this.trajectoryPredictor.predict(
			this.matchController.simulationRunner.world,
			this.matchController.activeStone.body,
			best.candidate.velocity,
			this.matchController.simulationRunner.getCollisionSystem()
		);
		this.matchController.setActiveStonePredictedTrajectory(points);
		this.previewFramesRemaining = CpuSettings.PreviewFrames;
		this.currentState = CpuTurnState.Previewing;
	}

	/** 約0.5秒の予測線表示後、Humanと同じreleaseActiveStone()経路を呼びます。 */
	private advancePreview(): void {
		this.previewFramesRemaining -= 1;
		if (this.previewFramesRemaining > 0) return;
		this.matchController.releaseActiveStone();
		this.currentState = CpuTurnState.Idle;
		this.planningSession = undefined;
		this.planningActiveBody = undefined;
	}

	/** CPU対象外へ移った場合に、actual盤面へ触れず一時探索だけを破棄します。 */
	private cancelPlanning(): void {
		if (this.currentState !== CpuTurnState.Idle || this.planningSession !== undefined) {
			this.reset();
		}
	}
}
