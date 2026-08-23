import {CpuDifficulty} from "./game_session";

/** 1難易度の全方向探索密度と局所refinement密度です。 */
export class CpuCandidateConfig {
	/** 360度を等分する方向数です。 */
	readonly directionCount: number;
	/** 最大virtual dragまでを等分する速度段階数です。 */
	readonly speedCount: number;
	/** global best周辺の局所grid一辺です。0はrefinementなしです。 */
	readonly refinementGridSize: number;

	/** 決定論的な極座標grid設定を生成します。 */
	constructor(directionCount: number, speedCount: number, refinementGridSize: number) {
		this.directionCount = directionCount;
		this.speedCount = speedCount;
		this.refinementGridSize = refinementGridSize;
	}

	/** global候補数を返します。 */
	get globalCandidateCount(): number {
		return this.directionCount * this.speedCount;
	}

	/** 重複する中心点を除いた局所候補数を返します。 */
	get refinementCandidateCount(): number {
		return this.refinementGridSize <= 0 ? 0
			: this.refinementGridSize * this.refinementGridSize - 1;
	}
}

/** 得点を主に、軌道品質と吸収戦術を補助にするCPU評価weightです。 */
export class CpuUtilityWeights {
	/** CPUとHumanの得点差へ掛ける最優先weightです。 */
	readonly scoreDifference: number = 1000;
	/** 0～1の連続軌道品質合計差へ掛ける補助weightです。 */
	readonly orbitQualityDifference: number = 60;
	/** 今回新たにHuman Stoneを吸収させた個数のbonusです。 */
	readonly newlyAbsorbedHuman: number = 120;
	/** 既存CPU Stoneを新たに失った個数のpenaltyです。 */
	readonly newlyAbsorbedCpuExisting: number = 120;
	/** 今回投げるCPU active Stone自身が吸収された場合のpenaltyです。 */
	readonly activeStoneAbsorbed: number = 180;
}

/** CPU探索量と演出時間を物理・GameBalanceから分離して一元管理します。 */
export class CpuSettings {
	/** 人間と同じ速度変換へ渡すCPUの最大virtual drag（logical px）です。 */
	static readonly MaxVirtualDragPixels: number = 300;
	/** UIをfreezeさせないため1frameで評価する候補数です。 */
	static readonly CandidateEvaluationsPerFrame: number = 1;
	/** 最善手の既存予測線をrelease前に表示する30fps基準frame数です。 */
	static readonly PreviewFrames: number = 15;
	/** utilityの調整値です。物理条件は含みません。 */
	static readonly UtilityWeights: CpuUtilityWeights = new CpuUtilityWeights();

	/** 難易度に対応する全方向gridとrefinement設定を返します。 */
	static getCandidateConfig(difficulty: CpuDifficulty): CpuCandidateConfig {
		if (difficulty === CpuDifficulty.Easy) return new CpuCandidateConfig(12, 3, 0);
		if (difficulty === CpuDifficulty.Hard) return new CpuCandidateConfig(24, 5, 5);
		return new CpuCandidateConfig(16, 4, 3);
	}
}
