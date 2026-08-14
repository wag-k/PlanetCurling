import {BodyPositionSnapshot, CollisionEvent, CollisionSystem} from "./collision";
import {IPhysicsIntegrator} from "./physics_integrator";
import {PhysicsWorld} from "./physics_world";

/**
 * 可変量のシミュレーション時間をaccumulatorへ貯め、固定dtだけ物理世界を進めます。
 */
export class SimulationRunner {
	/** 更新対象のAkashic非依存な物理世界です。 */
	readonly world: PhysicsWorld;

	/** 物理計算1回あたりの固定時間（s）です。 */
	readonly physicsStepSeconds: number;

	/** 現在使用している積分器です。 */
	private integrator: IPhysicsIntegrator;

	/** 固定ステップ前後に適用する任意の衝突系です。 */
	private collisionSystem?: CollisionSystem;

	/** まだ固定ステップへ変換できていない端数時間（s）です。 */
	private accumulatorSeconds: number = 0;

	/** 診断用の累積物理ステップ数です。 */
	private completedStepCount: number = 0;

	/**
	 * 固定時間刻みの実行器を生成します。
	 * @param world 更新対象の物理世界
	 * @param integrator 使用する積分器
	 * @param physicsStepSeconds 物理計算1回の固定時間（s）
	 */
	constructor(world: PhysicsWorld, integrator: IPhysicsIntegrator, physicsStepSeconds: number) {
		if (physicsStepSeconds <= 0) {
			throw new Error("物理タイムステップは0より大きい必要があります。");
		}
		this.world = world;
		this.integrator = integrator;
		this.physicsStepSeconds = physicsStepSeconds;
	}

	/** 次回以降の固定ステップで使用する積分器を切り替えます。 */
	setIntegrator(integrator: IPhysicsIntegrator): void {
		this.integrator = integrator;
	}

	/** 現在の積分器を返します。 */
	getIntegrator(): IPhysicsIntegrator {
		return this.integrator;
	}

	/** 次回以降の固定ステップで使用する衝突系を設定します。 */
	setCollisionSystem(collisionSystem?: CollisionSystem): void {
		this.collisionSystem = collisionSystem;
	}

	/** 現在の衝突系を返します。 */
	getCollisionSystem(): CollisionSystem | undefined {
		return this.collisionSystem;
	}

	/** 固定ステップ未満として保持している端数時間（s）を返します。 */
	getRemainingSimulationSeconds(): number {
		return this.accumulatorSeconds;
	}

	/** 生成後に完了した物理ステップの総数を返します。 */
	getCompletedStepCount(): number {
		return this.completedStepCount;
	}

	/** ターン境界で固定dt未満の端数だけを破棄します。 */
	clearRemainingSimulationSeconds(): void {
		this.accumulatorSeconds = 0;
	}

	/** New Game時に端数時間と診断用ステップ数を初期化します。 */
	reset(): void {
		this.accumulatorSeconds = 0;
		this.completedStepCount = 0;
	}

	/**
	 * 指定したゲーム内時間をaccumulatorへ追加し、実行できた固定ステップ数を返します。
	 * @param simulationSeconds 進めるゲーム内時間（s）
	 * @param afterStep 各固定物理ステップの完了直後に任意で呼ぶ、記録用途などの副作用コールバック
	 */
	advance(
		simulationSeconds: number,
		afterStep?: (world: PhysicsWorld, physicsStepSeconds: number, collisionEvents: CollisionEvent[]) => void
	): number {
		if (simulationSeconds < 0) {
			throw new Error("シミュレーション時間を負方向へ進めることはできません。");
		}

		this.accumulatorSeconds += simulationSeconds;
		let stepCount: number = 0;
		while (this.accumulatorSeconds >= this.physicsStepSeconds) {
			const collisionEvents: CollisionEvent[] = this.collisionSystem === undefined
				? []
				: this.collisionSystem.resolveBeforeStep(this.world);
			const startPositions: BodyPositionSnapshot[] = this.collisionSystem === undefined
				? []
				: this.collisionSystem.capturePositions();
			this.integrator.step(this.world, this.physicsStepSeconds);
			if (this.collisionSystem !== undefined) {
				collisionEvents.push(...this.collisionSystem.resolveAfterStep(
					this.world,
					startPositions,
					this.physicsStepSeconds
				));
			}
			if (afterStep !== undefined) {
				afterStep(this.world, this.physicsStepSeconds, collisionEvents);
			}
			this.accumulatorSeconds -= this.physicsStepSeconds;
			stepCount += 1;
		}
		this.completedStepCount += stepCount;
		return stepCount;
	}
}
