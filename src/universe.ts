import {calculateAccelerations} from "./gravity";
import {calculateLaunchVelocity} from "./input_velocity";
import {MatchController, MatchState} from "./match_controller";
import {Acceleration} from "./motion";
import {Planet} from "./planet";
import {PlanetRenderer} from "./rendering";
import {Setting} from "./setting";

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
		this.renderer.update();
	}

	/** 画面上の累積ドラッグ量を初速度へ変換し、現在のactiveStoneだけへ設定します。 */
	playerDrag(dragXPixels: number, dragYPixels: number): boolean {
		const updated: boolean = this.matchController.setActiveStoneVelocity(calculateLaunchVelocity(
			dragXPixels,
			dragYPixels,
			this.worldWidthMeters,
			this.viewportWidthPixels
		));
		if (updated) {
			this.renderer.update();
		}
		return updated;
	}

	/** 現在のactiveStoneをリリースし、5年の物理進行を開始します。 */
	releaseActiveStone(): boolean {
		return this.matchController.releaseActiveStone();
	}

	/** 試合・物理世界を初期化し、Redの1投目へ戻します。 */
	newGame(): void {
		this.matchController.newGame();
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
}
