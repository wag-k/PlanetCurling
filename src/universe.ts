import {PlanetRenderer} from "./rendering";
import {SimulationRunner} from "./simulation_runner";
import * as State from "./universe_state";

/**
 * 入力状態・固定刻みシミュレーション・描画同期を接続するアプリケーション層です。
 * 物理計算そのものはSimulationRunner以下へ委譲します。
 */
export class Universe {
	/** 固定刻みの物理シミュレーション実行器です。 */
	readonly simulationRunner: SimulationRunner;

	/** 全物理サブステップ後にだけ呼び出す描画同期先です。 */
	readonly renderer: PlanetRenderer;

	/** 入力速度の換算に使用する物理世界の幅（m）です。 */
	readonly worldWidthMeters: number;

	/** 入力速度の換算に使用する画面幅（px）です。 */
	readonly viewportWidthPixels: number;

	/** 惑星運動を進める状態です。 */
	readonly motionSimulationState: State.MotionSimulationState;

	/** プレイヤーが初速度を選択する状態です。 */
	readonly directionSelectState: State.DirectionSelectState;

	/** 現在の入力・更新状態です。 */
	private currentState: State.IUniverseState;

	/**
	 * アプリケーション層を生成します。
	 * @param simulationRunner 固定刻みシミュレーション実行器
	 * @param renderer Akashic描画同期先
	 * @param worldWidthMeters 入力換算に使う物理世界幅（m）
	 * @param viewportWidthPixels 入力換算に使う画面幅（px）
	 */
	constructor(
		simulationRunner: SimulationRunner,
		renderer: PlanetRenderer,
		worldWidthMeters: number,
		viewportWidthPixels: number
	) {
		this.simulationRunner = simulationRunner;
		this.renderer = renderer;
		this.worldWidthMeters = worldWidthMeters;
		this.viewportWidthPixels = viewportWidthPixels;
		this.motionSimulationState = new State.MotionSimulationState(this);
		this.directionSelectState = new State.DirectionSelectState(this);
		this.currentState = this.directionSelectState;
		this.currentState.stateChanged();
	}

	/** 現在の入力・更新状態を返します。 */
	get state(): State.IUniverseState {
		return this.currentState;
	}

	/** 状態を切り替え、切り替え先へ初期同期を通知します。 */
	set state(state: State.IUniverseState) {
		this.currentState = state;
		this.currentState.stateChanged();
	}

	/** Akashicの1更新分の実時間を現在状態へ渡します。 */
	update(realSeconds: number): void {
		this.currentState.update(realSeconds);
	}

	/** 画面上の累積ドラッグ量を現在状態へ渡します。 */
	playerDrag(dragXPixels: number, dragYPixels: number): void {
		this.currentState.playerDrag(dragXPixels, dragYPixels);
	}
}
