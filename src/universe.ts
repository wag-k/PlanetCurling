import {CollisionEvent} from "./collision";
import {calculateAccelerations} from "./gravity";
import {calculateLaunchVelocity} from "./input_velocity";
import {MatchController, MatchState} from "./match_controller";
import {Acceleration, Velocity} from "./motion";
import {Planet} from "./planet";
import {PlanetRenderer} from "./rendering";
import {Setting} from "./setting";
import {TrajectoryPoint, TrajectoryPredictor} from "./trajectory";

/**
 * Akashicの入力・更新周期をゲーム進行層と描画層へ接続するアプリケーション層です。
 * ターン規則はMatchController、物理計算はSimulationRunnerへ委譲します。
 */
export class Universe {
	/** Akashic非依存の試合進行とactiveStoneの管理先です。 */
	readonly matchController: MatchController;

	/** 全物理サブステップ後にだけ呼び出す描画同期先です。 */
	readonly renderer: PlanetRenderer;

	/** 入力速度の換算に使用する物理世界の幅（m）です。 */
	readonly worldWidthMeters: number;

	/** 入力速度の換算に使用する画面幅（px）です。 */
	readonly viewportWidthPixels: number;

	/** 本番世界をcloneし、同じ積分器・6時間dtで10年先を計算する予測器です。 */
	readonly trajectoryPredictor: TrajectoryPredictor;

	/** 同じAiming盤面で予測済みのドラッグx（px）です。 */
	private lastPredictedDragXPixels: number | undefined;

	/** 同じAiming盤面で予測済みのドラッグy（px）です。 */
	private lastPredictedDragYPixels: number | undefined;

	/** 予測キャッシュが属するactiveStoneの物理天体参照です。 */
	private lastPredictedBody: Planet | undefined;

	/** アプリケーション層を生成し、初期盤面の加速度をView用に評価します。 */
	constructor(
		matchController: MatchController,
		renderer: PlanetRenderer,
		worldWidthMeters: number,
		viewportWidthPixels: number
	) {
		this.matchController = matchController;
		this.renderer = renderer;
		this.worldWidthMeters = worldWidthMeters;
		this.viewportWidthPixels = viewportWidthPixels;
		this.trajectoryPredictor = new TrajectoryPredictor(
			matchController.simulationRunner.getIntegrator().kind,
			Setting.PhysicsStepSeconds,
			Setting.PredictionDurationSeconds,
			Setting.TrajectorySampleIntervalSeconds
		);
		this.refreshAccelerations();
	}

	/**
	 * Akashicの1更新分を処理します。
	 * AimingとMatchFinishedでは時間を止め、Simulatingだけを6時間固定dtで進めます。
	 */
	update(realSeconds: number): void {
		if (this.matchController.state === MatchState.Simulating) {
			this.matchController.advanceSimulation(realSeconds * Setting.SimulationSecondsPerSecond);
		} else if (this.matchController.state === MatchState.TurnTransition) {
			this.matchController.completeTurnTransition();
			this.refreshAccelerations();
		}
		const collisionEvents: CollisionEvent[] = this.matchController.consumeCollisionEvents();
		if (collisionEvents.length > 0) {
			this.renderer.addCollisionEffects(collisionEvents);
		}
		this.renderer.update();
	}

	/** 画面上の累積ドラッグ量を初速度へ変換し、現在のactiveStoneだけへ設定します。 */
	playerDrag(dragXPixels: number, dragYPixels: number): boolean {
		const launchVelocity = calculateLaunchVelocity(
			dragXPixels,
			dragYPixels,
			this.worldWidthMeters,
			this.viewportWidthPixels
		);
		const updated: boolean = this.matchController.setActiveStoneVelocity(launchVelocity);
		if (updated) {
			this.updatePrediction(dragXPixels, dragYPixels, launchVelocity);
			this.renderer.update();
		}
		return updated;
	}

	/** 現在のactiveStoneをリリースし、保存済み予測を残したまま10年の物理進行を開始します。 */
	releaseActiveStone(): boolean {
		return this.matchController.releaseActiveStone();
	}

	/** 試合・物理世界を初期化し、Redの1投目へ戻します。 */
	newGame(): void {
		this.matchController.newGame();
		this.clearPredictionCache();
		this.refreshAccelerations();
	}

	/** 現在位置のNewton重力加速度を全Planetへ同期し、照準中の表示に利用します。 */
	private refreshAccelerations(): void {
		const bodies: Planet[] = this.matchController.simulationRunner.world.bodies;
		const accelerations: Acceleration[] = calculateAccelerations(bodies);
		bodies.forEach((body: Planet, index: number): void => {
			body.acceleration.update(accelerations[index]);
		});
	}

	/** 入力変化が十分ある場合だけ予測を再計算し、同一入力イベントの重複計算を避けます。 */
	private updatePrediction(dragXPixels: number, dragYPixels: number, launchVelocity: Velocity): void {
		const activeBody: Planet | undefined = this.matchController.activeStone === undefined
			? undefined
			: this.matchController.activeStone.body;
		if (activeBody === undefined) {
			return;
		}
		const dragMagnitude: number = Math.sqrt(dragXPixels * dragXPixels + dragYPixels * dragYPixels);
		if (dragMagnitude < Setting.PredictionMinimumDragPixels) {
			this.matchController.setActiveStonePredictedTrajectory([]);
			this.rememberPredictedInput(activeBody, dragXPixels, dragYPixels);
			return;
		}
		if (!this.shouldRecalculatePrediction(activeBody, dragXPixels, dragYPixels)) {
			return;
		}
		const points: TrajectoryPoint[] = this.trajectoryPredictor.predict(
			this.matchController.simulationRunner.world,
			activeBody,
			launchVelocity,
			this.matchController.simulationRunner.getCollisionSystem()
		);
		this.matchController.setActiveStonePredictedTrajectory(points);
		this.rememberPredictedInput(activeBody, dragXPixels, dragYPixels);
	}

	/** 盤面またはドラッグ量が表示threshold以上変化した場合だけtrueを返します。 */
	private shouldRecalculatePrediction(activeBody: Planet, dragXPixels: number, dragYPixels: number): boolean {
		if (
			this.lastPredictedBody !== activeBody
			|| this.lastPredictedDragXPixels === undefined
			|| this.lastPredictedDragYPixels === undefined
		) {
			return true;
		}
		const deltaX: number = dragXPixels - this.lastPredictedDragXPixels;
		const deltaY: number = dragYPixels - this.lastPredictedDragYPixels;
		return Math.sqrt(deltaX * deltaX + deltaY * deltaY) >= Setting.PredictionRecalculationThresholdPixels;
	}

	/** 再計算済み入力を小さなAiming中キャッシュとして保存します。 */
	private rememberPredictedInput(activeBody: Planet, dragXPixels: number, dragYPixels: number): void {
		this.lastPredictedBody = activeBody;
		this.lastPredictedDragXPixels = dragXPixels;
		this.lastPredictedDragYPixels = dragYPixels;
	}

	/** New Game時に盤面依存の予測キャッシュを無効化します。 */
	private clearPredictionCache(): void {
		this.lastPredictedBody = undefined;
		this.lastPredictedDragXPixels = undefined;
		this.lastPredictedDragYPixels = undefined;
	}
}
