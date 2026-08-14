import {Planet} from "./planet";

/** Deep cloneした物理世界と、元天体からclone天体への明示的な対応を保持します。 */
export class PhysicsWorldClone {
	/** 予測などで本番から独立して変更できるclone側の物理世界です。 */
	readonly world: PhysicsWorld;

	/** clone元の天体参照を順序付きで保持します。 */
	private readonly sourceBodies: Planet[];

	/** sourceBodiesと1対1に対応するclone側天体です。 */
	private readonly clonedBodies: Planet[];

	/** clone世界と参照対応を生成します。 */
	constructor(world: PhysicsWorld, sourceBodies: Planet[], clonedBodies: Planet[]) {
		this.world = world;
		this.sourceBodies = sourceBodies;
		this.clonedBodies = clonedBodies;
	}

	/** 元の天体参照に対応するclone側天体を返します。物理配列indexへゲーム上の意味を持たせません。 */
	getClonedBody(sourceBody: Planet): Planet {
		const sourceIndex: number = this.sourceBodies.indexOf(sourceBody);
		if (sourceIndex < 0) {
			throw new Error("clone元のPhysicsWorldに指定天体が存在しません。");
		}
		return this.clonedBodies[sourceIndex];
	}
}

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

	/** 指定した天体を物理世界から取り除き、見つかった場合はtrueを返します。 */
	removeBody(body: Planet): boolean {
		const bodyIndex: number = this.bodies.indexOf(body);
		if (bodyIndex < 0) {
			return false;
		}
		this.bodies.splice(bodyIndex, 1);
		return true;
	}

	/** New Game時に同じPhysicsWorldインスタンスからすべての天体を取り除きます。 */
	clearBodies(): void {
		this.bodies.splice(0, this.bodies.length);
	}

	/** 全天体と物理値をdeep cloneし、本番世界と参照を共有しない新しい世界を返します。 */
	clone(): PhysicsWorld {
		return this.cloneWithMapping().world;
	}

	/** deep cloneした世界と、元天体からclone天体を明示取得できる対応結果を返します。 */
	cloneWithMapping(): PhysicsWorldClone {
		const sourceBodies: Planet[] = this.bodies.slice();
		const clonedBodies: Planet[] = sourceBodies.map((body: Planet): Planet => body.clone());
		return new PhysicsWorldClone(new PhysicsWorld(clonedBodies), sourceBodies, clonedBodies);
	}
}
