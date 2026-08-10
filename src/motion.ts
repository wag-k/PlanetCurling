/**
 * SI単位系の2次元位置を表します。
 */
export class Pos {
	/** x方向の位置（m）です。 */
	x: number;

	/** y方向の位置（m）です。 */
	y: number;

	/**
	 * 位置を生成します。
	 * @param x x方向の位置（m）
	 * @param y y方向の位置（m）
	 */
	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	/**
	 * 指定した速度と時間で位置を進めます。
	 * @param deltaTimeSeconds 経過時間（s）
	 * @param velocity 速度（m/s）
	 */
	update(deltaTimeSeconds: number, velocity: Velocity): void {
		this.x += velocity.x * deltaTimeSeconds;
		this.y += velocity.y * deltaTimeSeconds;
	}

	/** 現在値を複製します。 */
	clone(): Pos {
		return new Pos(this.x, this.y);
	}
}

/**
 * SI単位系の2次元速度を表します。
 */
export class Velocity {
	/** x方向の速度（m/s）です。 */
	x: number;

	/** y方向の速度（m/s）です。 */
	y: number;

	/**
	 * 速度を生成します。
	 * @param x x方向の速度（m/s）
	 * @param y y方向の速度（m/s）
	 */
	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	/**
	 * 指定した加速度と時間で速度を進めます。
	 * @param deltaTimeSeconds 経過時間（s）
	 * @param acceleration 加速度（m/s^2）
	 */
	update(deltaTimeSeconds: number, acceleration: Acceleration): void {
		this.x += acceleration.x * deltaTimeSeconds;
		this.y += acceleration.y * deltaTimeSeconds;
	}

	/** 現在値を複製します。 */
	clone(): Velocity {
		return new Velocity(this.x, this.y);
	}
}

/**
 * SI単位系の2次元加速度を表します。
 */
export class Acceleration {
	/** x方向の加速度（m/s^2）です。 */
	x: number;

	/** y方向の加速度（m/s^2）です。 */
	y: number;

	/**
	 * 加速度を生成します。
	 * @param x x方向の加速度（m/s^2）
	 * @param y y方向の加速度（m/s^2）
	 */
	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	/** 指定値で現在値を置き換えます。 */
	update(acceleration: Acceleration): void {
		this.x = acceleration.x;
		this.y = acceleration.y;
	}

	/** 現在値を複製します。 */
	clone(): Acceleration {
		return new Acceleration(this.x, this.y);
	}
}

/**
 * 2次元ベクトルの大きさを返します。
 * @param values ベクトルの各成分
 */
export function squareSumRoot(values: number[]): number {
	let sumSquare: number = 0;
	values.forEach((value: number): void => {
		sumSquare += Math.pow(value, 2);
	});
	return Math.sqrt(sumSquare);
}

/**
 * 極座標を表します。
 */
export class Polar {
	/** 中心からの距離です。 */
	radius: number;

	/** ラジアン単位の角度です。 */
	angular: number;

	/**
	 * 直交座標を極座標へ変換します。
	 * @param center 極座標の中心
	 * @param pos 変換する位置
	 */
	static orthogonalToPolar(center: Pos, pos: Pos): Polar {
		const deltaX: number = pos.x - center.x;
		const deltaY: number = pos.y - center.y;
		return new Polar(Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2)), Math.atan2(deltaY, deltaX));
	}

	/** 極座標を生成します。 */
	constructor(radius: number, angular: number) {
		this.radius = radius;
		this.angular = angular;
	}

	/** 度数法で角度を設定します。 */
	set angularDegree(degree: number) {
		this.angular = degree / 180 * Math.PI;
	}

	/** 度数法で角度を取得します。 */
	get angularDegree(): number {
		return this.angular / Math.PI * 180;
	}

	/** 指定した中心を基準に直交座標へ変換します。 */
	toOrthogonal(center: Pos): Pos {
		return new Pos(
			center.x + this.radius * Math.cos(this.angular),
			center.y + this.radius * Math.sin(this.angular)
		);
	}
}
