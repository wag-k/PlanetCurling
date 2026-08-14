import {PhysicalConstant} from "./physical_constant";

/**
 * ゲームルールから調整する物理量をSI単位系で一元管理します。
 * Newton重力そのものを変えず、質量と初期配置だけでゲーム性を調整します。
 */
export class GameBalance {
	/** 画面短辺へ表示する物理世界の幅（m）です。 */
	static get WorldSpanMeters(): number {
		return 10 * PhysicalConstant.AstroUnit;
	}

	/** 全プレイヤー共通の投球開始x座標（m）です。 */
	static get ShotStartXMetres(): number {
		return 4 * PhysicalConstant.AstroUnit;
	}

	/** 全プレイヤー共通の投球開始y座標（m）です。 */
	static get ShotStartYMetres(): number {
		return 4 * PhysicalConstant.AstroUnit;
	}

	/** 投球惑星の表示・物理半径（m）です。 */
	static get StoneRadiusMetres(): number {
		return 40000;
	}

	/** 投石同士のゲームプレイ上の衝突半径（m）です。描画半径とは独立しています。 */
	static get StoneCollisionRadiusMetres(): number {
		return 0.15 * PhysicalConstant.AstroUnit;
	}

	/** 相互重力をゲーム上認識できる強さにする暫定投球惑星質量（kg）です。 */
	static get StoneMassKg(): number {
		return 6 * Math.pow(10, 24);
	}

	/** 軌道形成の主因として扱う中央天体の暫定質量（kg）です。 */
	static get CentralBodyMassKg(): number {
		return 6 * Math.pow(10, 26);
	}

	/** 中央天体の半径（m）です。固定物体化には使用しません。 */
	static get CentralBodyRadiusMetres(): number {
		return 40000;
	}

	/** 中央天体のゲームプレイ上の吸収半径（m）です。描画半径とは独立しています。 */
	static get CentralBodyCollisionRadiusMetres(): number {
		return 0.25 * PhysicalConstant.AstroUnit;
	}

	/** 投石同士の反発係数です。 */
	static get StoneCollisionRestitution(): number {
		return 0.9;
	}

	/** 中央天体の初期x座標（m）です。 */
	static get CentralBodyStartXMetres(): number {
		return 6 * PhysicalConstant.AstroUnit;
	}

	/** 中央天体の初期y座標（m）です。 */
	static get CentralBodyStartYMetres(): number {
		return 5 * PhysicalConstant.AstroUnit;
	}

	/** 中心天体から測るターゲット軌道の半径（m）です。 */
	static get TargetOrbitRadiusMetres(): number {
		return 2 * PhysicalConstant.AstroUnit;
	}

	/** 3点になる実効軌道誤差の上限（m）です。 */
	static get ThreePointOrbitErrorMetres(): number {
		return 0.2 * PhysicalConstant.AstroUnit;
	}

	/** 2点になる実効軌道誤差の上限（m）です。 */
	static get TwoPointOrbitErrorMetres(): number {
		return 0.5 * PhysicalConstant.AstroUnit;
	}

	/** 1点になる実効軌道誤差の上限（m）です。 */
	static get OnePointOrbitErrorMetres(): number {
		return PhysicalConstant.AstroUnit;
	}
}
