import {PhysicsIntegratorKind} from "./physics_integrator";

/**
 * 時間進行・積分器・入力感度を一元管理するアプリケーション設定です。
 */
export class Setting {
	/** 1日の秒数です。 */
	static get SecondsPerDay(): number {
		return 24 * 60 * 60;
	}

	/** ゲーム内1年の秒数です。G1では365日で固定します。 */
	static get SecondsPerYear(): number {
		return 365 * Setting.SecondsPerDay;
	}

	/** 物理計算1ステップの固定時間（6時間）です。 */
	static get PhysicsStepSeconds(): number {
		return 6 * 60 * 60;
	}

	/** 実時間1秒で進めるゲーム内時間です。既存の30fps・1フレーム30日相当を維持します。 */
	static get SimulationSecondsPerSecond(): number {
		return 900 * Setting.SecondsPerDay;
	}

	/** 1投のリリース後に物理世界を進める固定ゲーム内時間（10年）です。 */
	static get SimulationDurationPerShotSeconds(): number {
		return 10 * Setting.SecondsPerYear;
	}

	/** ドラッグから求めた基準速度へ最後に掛ける、ゲームプレイ調整用の倍率です。 */
	static get LaunchVelocityMultiplier(): number {
		return 1.5;
	}

	/** 軌道得点で動径速度を距離誤差へ換算する基準時間です。 */
	static get ScoreVelocityReferenceSeconds(): number {
		return Setting.SecondsPerYear;
	}

	/** 照準中に本番と同じ物理で予測する期間（10ゲーム年）です。 */
	static get PredictionDurationSeconds(): number {
		return 10 * Setting.SecondsPerYear;
	}

	/** 予測軌道と実軌跡を描画点へ間引くゲーム内時間間隔（10日）です。 */
	static get TrajectorySampleIntervalSeconds(): number {
		return 10 * Setting.SecondsPerDay;
	}

	/** 実質的な入力がない予測線を隠すドラッグ距離の下限（px）です。 */
	static get PredictionMinimumDragPixels(): number {
		return 2;
	}

	/** ドラッグ中の予測再計算を抑える入力変化量（px）です。投球速度そのものは丸めません。 */
	static get PredictionRecalculationThresholdPixels(): number {
		return 4;
	}

	/** RedとBlueがそれぞれ投げる回数です。 */
	static get ShotsPerPlayer(): number {
		return 3;
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
