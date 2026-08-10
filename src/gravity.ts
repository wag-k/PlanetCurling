import {Acceleration} from "./motion";
import {PhysicalConstant} from "./physical_constant";
import {Planet} from "./planet";

/**
 * 全天体の同時刻の位置から、各天体に生じる重力加速度をまとめて計算します。
 * @param bodies 同じ時刻の物理状態を持つ天体群
 */
export function calculateAccelerations(bodies: Planet[]): Acceleration[] {
	return bodies.map((body: Planet, bodyIndex: number): Acceleration => {
		const acceleration: Acceleration = new Acceleration(0, 0);

		bodies.forEach((otherBody: Planet, otherIndex: number): void => {
			if (bodyIndex === otherIndex) {
				return;
			}

			const deltaX: number = otherBody.pos.x - body.pos.x;
			const deltaY: number = otherBody.pos.y - body.pos.y;
			const distanceSquared: number = deltaX * deltaX + deltaY * deltaY;
			if (distanceSquared === 0) {
				throw new Error("異なる天体を同一位置に置いた状態では重力加速度を計算できません。");
			}

			const distance: number = Math.sqrt(distanceSquared);
			const accelerationMagnitude: number =
				PhysicalConstant.ConstantOfGravitation * otherBody.mass / distanceSquared;
			acceleration.x += accelerationMagnitude * deltaX / distance;
			acceleration.y += accelerationMagnitude * deltaY / distance;
		});

		return acceleration;
	});
}
