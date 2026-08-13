import {GameBalance} from "./game_balance";
import {squareSumRoot} from "./motion";
import {Planet} from "./planet";
import {Setting} from "./setting";

/** 1つの投石天体をターゲット軌道に対して評価した結果です。 */
export class OrbitEvaluation {
	/** 中心天体からの半径（m）です。 */
	readonly radiusMetres: number;

	/** ターゲット半径との距離誤差（m）です。 */
	readonly radialDistanceErrorMetres: number;

	/** 中心天体に対する符号付き動径速度（m/s）です。 */
	readonly radialVelocityMetresPerSecond: number;

	/** 距離誤差と動径速度を合成した実効軌道誤差（m）です。 */
	readonly effectiveOrbitErrorMetres: number;

	/** 実効軌道誤差から得られた点数です。 */
	readonly points: number;

	/** 軌道評価に用いた値を保持します。 */
	constructor(
		radiusMetres: number,
		radialDistanceErrorMetres: number,
		radialVelocityMetresPerSecond: number,
		effectiveOrbitErrorMetres: number,
		points: number
	) {
		this.radiusMetres = radiusMetres;
		this.radialDistanceErrorMetres = radialDistanceErrorMetres;
		this.radialVelocityMetresPerSecond = radialVelocityMetresPerSecond;
		this.effectiveOrbitErrorMetres = effectiveOrbitErrorMetres;
		this.points = points;
	}
}

/** 相対位置と相対速度だけを使い、Akashic Engineに依存せず軌道得点を計算します。 */
export class OrbitScoreEvaluator {
	/** 目標軌道半径（m）です。 */
	readonly targetRadiusMetres: number;

	/** 動径速度を距離へ換算する基準時間（秒）です。 */
	readonly velocityReferenceSeconds: number;

	/** 3点の実効誤差上限（m）です。 */
	readonly threePointErrorMetres: number;

	/** 2点の実効誤差上限（m）です。 */
	readonly twoPointErrorMetres: number;

	/** 1点の実効誤差上限（m）です。 */
	readonly onePointErrorMetres: number;

	/** ゲーム設定またはテスト用に指定した評価条件を保持します。 */
	constructor(
		targetRadiusMetres: number = GameBalance.TargetOrbitRadiusMetres,
		velocityReferenceSeconds: number = Setting.ScoreVelocityReferenceSeconds,
		threePointErrorMetres: number = GameBalance.ThreePointOrbitErrorMetres,
		twoPointErrorMetres: number = GameBalance.TwoPointOrbitErrorMetres,
		onePointErrorMetres: number = GameBalance.OnePointOrbitErrorMetres
	) {
		this.targetRadiusMetres = targetRadiusMetres;
		this.velocityReferenceSeconds = velocityReferenceSeconds;
		this.threePointErrorMetres = threePointErrorMetres;
		this.twoPointErrorMetres = twoPointErrorMetres;
		this.onePointErrorMetres = onePointErrorMetres;
	}

	/** 投石天体を現在の中心天体の位置と速度を基準に評価します。 */
	evaluate(stone: Planet, centralBody: Planet): OrbitEvaluation {
		const relativeX: number = stone.pos.x - centralBody.pos.x;
		const relativeY: number = stone.pos.y - centralBody.pos.y;
		const relativeVelocityX: number = stone.velocity.x - centralBody.velocity.x;
		const relativeVelocityY: number = stone.velocity.y - centralBody.velocity.y;
		const radiusMetres: number = squareSumRoot([relativeX, relativeY]);
		const radialDistanceErrorMetres: number = Math.abs(radiusMetres - this.targetRadiusMetres);
		const radialVelocityMetresPerSecond: number = radiusMetres === 0
			? 0
			: (relativeVelocityX * relativeX + relativeVelocityY * relativeY) / radiusMetres;
		const effectiveOrbitErrorMetres: number = radialDistanceErrorMetres
			+ Math.abs(radialVelocityMetresPerSecond) * this.velocityReferenceSeconds;

		return new OrbitEvaluation(
			radiusMetres,
			radialDistanceErrorMetres,
			radialVelocityMetresPerSecond,
			effectiveOrbitErrorMetres,
			this.calculatePoints(effectiveOrbitErrorMetres)
		);
	}

	/** 実効軌道誤差を包含境界の得点へ変換します。 */
	private calculatePoints(effectiveOrbitErrorMetres: number): number {
		if (effectiveOrbitErrorMetres <= this.threePointErrorMetres) {
			return 3;
		}
		if (effectiveOrbitErrorMetres <= this.twoPointErrorMetres) {
			return 2;
		}
		if (effectiveOrbitErrorMetres <= this.onePointErrorMetres) {
			return 1;
		}
		return 0;
	}
}
