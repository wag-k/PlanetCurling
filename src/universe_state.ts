import {calculateAccelerations} from "./gravity";
import {calculateLaunchVelocity} from "./input_velocity";
import {Acceleration, Velocity} from "./motion";
import {Planet} from "./planet";
import {Setting} from "./setting";
import {Universe} from "./universe";

/**
 * Universeの入力モードとフレーム更新処理を差し替えるための状態契約です。
 */
export interface IUniverseState {
	/** 状態へ遷移した直後の同期処理を行います。 */
	stateChanged(): void;

	/** Akashicの1フレーム分を処理します。 */
	update(realSeconds: number): void;

	/** 画面上の累積ドラッグ量を処理します。 */
	playerDrag(dragXPixels: number, dragYPixels: number): void;
}

/**
 * 実時間をゲーム内時間へ換算して固定ステップを実行し、最後に描画を1回だけ同期する状態です。
 */
export class MotionSimulationState implements IUniverseState {
	/** 更新対象のアプリケーション層です。 */
	private readonly universe: Universe;

	/** 惑星運動状態を生成します。 */
	constructor(universe: Universe) {
		this.universe = universe;
	}

	/** 状態遷移時に必要な追加処理はありません。 */
	stateChanged(): void {
		// 固定ステップの端数時間はSimulationRunnerに保持されるため、遷移時にリセットしません。
	}

	/** 必要数の物理サブステップを完了してから描画を1回だけ同期します。 */
	update(realSeconds: number): void {
		this.universe.simulationRunner.advance(realSeconds * Setting.SimulationSecondsPerSecond);
		this.universe.renderer.update();
	}

	/** 運動中のドラッグは初速度へ反映しません。 */
	playerDrag(_dragXPixels: number, _dragYPixels: number): void {
		// 入力はDirectionSelectStateだけが扱います。
	}
}

/**
 * 物理シミュレーションを進めず、ドラッグ量からプレイヤー天体の初速度を決める状態です。
 */
export class DirectionSelectState implements IUniverseState {
	/** 更新対象のアプリケーション層です。 */
	private readonly universe: Universe;

	/** 方向選択状態を生成します。 */
	constructor(universe: Universe) {
		this.universe = universe;
	}

	/** 現在位置の重力加速度を評価し、Viewへ最新状態を反映します。 */
	stateChanged(): void {
		const bodies: Planet[] = this.universe.simulationRunner.world.bodies;
		const accelerations: Acceleration[] = calculateAccelerations(bodies);
		bodies.forEach((body: Planet, index: number): void => {
			body.acceleration.update(accelerations[index]);
		});
		this.universe.renderer.update();
	}

	/** 物理状態は進めず、現在のモデル状態を描画へ同期します。 */
	update(_realSeconds: number): void {
		this.universe.renderer.update();
	}

	/** 物理dtと独立した入力感度でプレイヤー天体の初速度を更新します。 */
	playerDrag(dragXPixels: number, dragYPixels: number): void {
		const player: Planet | undefined = this.universe.simulationRunner.world.bodies[0];
		if (player === undefined) {
			return;
		}
		const velocity: Velocity = calculateLaunchVelocity(
			dragXPixels,
			dragYPixels,
			this.universe.worldWidthMeters,
			this.universe.viewportWidthPixels
		);
		player.velocity.x = velocity.x;
		player.velocity.y = velocity.y;
		this.universe.renderer.update();
	}
}
