import {calculateAccelerations} from "./gravity";
import {Acceleration} from "./motion";
import {PhysicsWorld} from "./physics_world";
import {Planet} from "./planet";

/** 設定から選択できる数値積分器の種類です。 */
export enum PhysicsIntegratorKind {
	SymplecticEuler = "SymplecticEuler",
	VelocityVerlet = "VelocityVerlet"
}

/**
 * 物理世界を固定時間だけ進める積分アルゴリズムの契約です。
 */
export interface IPhysicsIntegrator {
	/** 診断と設定表示に使用する積分器名です。 */
	readonly kind: PhysicsIntegratorKind;

	/**
	 * 物理世界を1ステップ進めます。
	 * @param world 更新対象の物理世界
	 * @param deltaTimeSeconds 固定時間刻み（s）
	 */
	step(world: PhysicsWorld, deltaTimeSeconds: number): void;
}

/**
 * 同時刻の加速度で全速度を更新後、その速度で全位置を進めるSymplectic Euler積分器です。
 */
export class SymplecticEulerIntegrator implements IPhysicsIntegrator {
	/** この積分器を設定から識別する名前です。 */
	readonly kind: PhysicsIntegratorKind = PhysicsIntegratorKind.SymplecticEuler;

	/** 同時刻の全状態を基準に、速度更新後の位置を計算します。 */
	step(world: PhysicsWorld, deltaTimeSeconds: number): void {
		const accelerations: Acceleration[] = calculateAccelerations(world.bodies);

		world.bodies.forEach((body: Planet, index: number): void => {
			body.acceleration.update(accelerations[index]);
			body.velocity.update(deltaTimeSeconds, accelerations[index]);
		});

		world.bodies.forEach((body: Planet): void => {
			body.pos.update(deltaTimeSeconds, body.velocity);
		});
	}
}

/**
 * 更新後の全位置で加速度を再評価し、位置と速度を2次精度で進めるVelocity Verlet積分器です。
 */
export class VelocityVerletIntegrator implements IPhysicsIntegrator {
	/** この積分器を設定から識別する名前です。 */
	readonly kind: PhysicsIntegratorKind = PhysicsIntegratorKind.VelocityVerlet;

	/** 全位置を進めてから新しい加速度を評価し、全速度を更新します。 */
	step(world: PhysicsWorld, deltaTimeSeconds: number): void {
		const currentAccelerations: Acceleration[] = calculateAccelerations(world.bodies);
		const halfDeltaTimeSquared: number = 0.5 * deltaTimeSeconds * deltaTimeSeconds;

		world.bodies.forEach((body: Planet, index: number): void => {
			body.pos.x += body.velocity.x * deltaTimeSeconds + currentAccelerations[index].x * halfDeltaTimeSquared;
			body.pos.y += body.velocity.y * deltaTimeSeconds + currentAccelerations[index].y * halfDeltaTimeSquared;
		});

		const nextAccelerations: Acceleration[] = calculateAccelerations(world.bodies);
		world.bodies.forEach((body: Planet, index: number): void => {
			body.velocity.x += 0.5 * (currentAccelerations[index].x + nextAccelerations[index].x) * deltaTimeSeconds;
			body.velocity.y += 0.5 * (currentAccelerations[index].y + nextAccelerations[index].y) * deltaTimeSeconds;
			body.acceleration.update(nextAccelerations[index]);
		});
	}
}

/** 設定値に対応する積分器を生成します。 */
export function createPhysicsIntegrator(kind: PhysicsIntegratorKind): IPhysicsIntegrator {
	if (kind === PhysicsIntegratorKind.VelocityVerlet) {
		return new VelocityVerletIntegrator();
	}
	return new SymplecticEulerIntegrator();
}
