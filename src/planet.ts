import {Acceleration, Pos, Velocity} from "./motion";

/**
 * Akashic Engineに依存しない天体の物理状態です。
 * すべての値をSI単位系で保持し、描画情報は持ちません。
 */
export class Planet {
	/** 天体の半径（m）です。 */
	radius: number;

	/** 天体の質量（kg）です。 */
	mass: number;

	/** 天体の位置（m）です。 */
	pos: Pos;

	/** 天体の速度（m/s）です。 */
	velocity: Velocity;

	/** 最後に評価した加速度（m/s^2）です。 */
	acceleration: Acceleration;

	/**
	 * 天体の物理状態を生成します。
	 * @param radius 半径（m）
	 * @param mass 質量（kg）
	 * @param initPos 初期位置（m）
	 * @param initVelocity 初期速度（m/s）
	 * @param initAcceleration 初期加速度（m/s^2）
	 */
	constructor(
		radius: number = 0,
		mass: number = 0,
		initPos: Pos = new Pos(0, 0),
		initVelocity: Velocity = new Velocity(0, 0),
		initAcceleration: Acceleration = new Acceleration(0, 0)
	) {
		this.radius = radius;
		this.mass = mass;
		this.pos = initPos;
		this.velocity = initVelocity;
		this.acceleration = initAcceleration;
	}

	/** 物理状態だけを複製します。 */
	clone(): Planet {
		return new Planet(
			this.radius,
			this.mass,
			this.pos.clone(),
			this.velocity.clone(),
			this.acceleration.clone()
		);
	}
}
