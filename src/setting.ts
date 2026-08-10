import {PhysicsIntegratorKind} from "./physics_integrator";

/**
 * 時間進行・積分器・入力感度を一元管理するアプリケーション設定です。
 */
export class Setting {
	/** 1日の秒数です。 */
	static get SecondsPerDay(): number {
		return 24 * 60 * 60;
	}

	/** 物理計算1ステップの固定時間（6時間）です。 */
	static get PhysicsStepSeconds(): number {
		return 6 * 60 * 60;
	}

	/** 実時間1秒で進めるゲーム内時間です。既存の30fps・1フレーム30日相当を維持します。 */
	static get SimulationSecondsPerSecond(): number {
		return 900 * Setting.SecondsPerDay;
	}

	/** ドラッグ速度の換算にだけ使う従来互換の基準時間（30日）です。物理dtとは独立しています。 */
	static get InputVelocityReferenceSeconds(): number {
		return 30 * Setting.SecondsPerDay;
	}

	/** ドラッグ量が過大な初速度にならないようにする従来互換の感度係数です。 */
	static get DragVelocityDivisor(): number {
		return 100;
	}

	/** 初期シナリオの第2惑星に与える速度（m/s）の算出基準時間です。 */
	static get InitialVelocityReferenceSeconds(): number {
		return 30 * Setting.SecondsPerDay;
	}

	/** コード上で選択する積分器です。初期値は既存挙動に近いSymplectic Eulerです。 */
	static get IntegratorKind(): PhysicsIntegratorKind {
		return PhysicsIntegratorKind.SymplecticEuler;
	}
}
