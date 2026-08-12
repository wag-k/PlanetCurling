import {Planet} from "./planet";

/**
 * 同じ時刻に属する天体群を保持する、Akashic非依存の物理世界です。
 */
export class PhysicsWorld {
	/** 積分器が同時刻の状態として扱う天体群です。 */
	readonly bodies: Planet[];

	/** 物理世界を生成します。 */
	constructor(bodies: Planet[] = []) {
		this.bodies = bodies;
	}

	/** 天体を物理世界へ追加します。 */
	addBody(body: Planet): void {
		this.bodies.push(body);
	}

	/** New Game時に同じPhysicsWorldインスタンスからすべての天体を取り除きます。 */
	clearBodies(): void {
		this.bodies.splice(0, this.bodies.length);
	}
}
