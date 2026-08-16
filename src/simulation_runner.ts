import {BodyPositionSnapshot, CollisionCandidate, CollisionEvent, CollisionSystem} from "./collision";
import {IPhysicsIntegrator} from "./physics_integrator";
import {PhysicsWorld} from "./physics_world";
import {Planet} from "./planet";

/** 既存Planet参照を保ったまま巻き戻す、位置・速度・加速度の完全物理snapshotです。 */
export class PhysicsStateSnapshot {
	/** snapshot時に世界へ存在した天体順です。 */
	private readonly bodies: Planet[];
	/** 各天体のSI物理状態です。 */
	private readonly values: number[][];

	/** 仮積分前の全天体状態を複製します。 */
	constructor(world: PhysicsWorld) {
		this.bodies = world.bodies.slice();
		this.values = this.bodies.map((body: Planet): number[] => [
			body.pos.x, body.pos.y, body.velocity.x, body.velocity.y, body.acceleration.x, body.acceleration.y
		]);
	}

	/** Planetを置換せず全値とworld順を復元し、Viewやゲーム層の参照を壊しません。 */
	restore(world: PhysicsWorld): void {
		world.bodies.splice(0, world.bodies.length, ...this.bodies);
		this.bodies.forEach((body: Planet, index: number): void => {
			const value: number[] = this.values[index];
			body.pos.x = value[0]; body.pos.y = value[1];
			body.velocity.x = value[2]; body.velocity.y = value[3];
			body.acceleration.x = value[4]; body.acceleration.y = value[5];
		});
	}
}

/**
 * 可変量のシミュレーション時間をaccumulatorへ貯め、固定dtだけ物理世界を進めます。
 */
export class SimulationRunner {
	/** 1base step内で許す衝突数です。連鎖を許しつつhangを防ぎます。 */
	static readonly MaxCollisionEventsPerPhysicsStep: number = 12;
	/** zero-time接触後にも時間を前進させる最小内部substep（s）です。 */
	static readonly CollisionTimeEpsilonSeconds: number = 1e-6;
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
			const collisionEvents: CollisionEvent[] = this.stepFixedInterval();
			if (afterStep !== undefined) {
				afterStep(this.world, this.physicsStepSeconds, collisionEvents);
			}
			this.accumulatorSeconds -= this.physicsStepSeconds;
			stepCount += 1;
		}
		this.completedStepCount += stepCount;
		return stepCount;
	}

	/**
	 * 1回の固定base dtを、衝突時だけearliest TOIで内部分割して進めます。
	 * 仮計算・TOI再計算・残時間のすべてに同じIntegratorと全天体を使うためPredictionとも共通です。
	 */
	private stepFixedInterval(): CollisionEvent[] {
		if (this.collisionSystem === undefined) {
			this.integrator.step(this.world, this.physicsStepSeconds);
			return [];
		}
		const events: CollisionEvent[] = [];
		let elapsedSeconds: number = 0;
		let remainingSeconds: number = this.physicsStepSeconds;
		let collisionIterations: number = 0;
		while (remainingSeconds > 0 && collisionIterations < SimulationRunner.MaxCollisionEventsPerPhysicsStep) {
			collisionIterations += 1;
			const snapshot: PhysicsStateSnapshot = new PhysicsStateSnapshot(this.world);
			const startPositions: BodyPositionSnapshot[] = this.collisionSystem.capturePositions();
			this.integrator.step(this.world, remainingSeconds);
			const candidate: CollisionCandidate | undefined = this.collisionSystem.findEarliestCandidate(
				this.world, startPositions
			);
			if (candidate === undefined) {
				remainingSeconds = 0;
				break;
			}
			const timeToImpactSeconds: number = Math.max(0, Math.min(remainingSeconds,
				remainingSeconds * candidate.timeRatio));
			snapshot.restore(this.world);
			if (timeToImpactSeconds > 0) {
				this.integrator.step(this.world, timeToImpactSeconds);
			}
			const eventTime: number = Math.min(this.physicsStepSeconds, elapsedSeconds + timeToImpactSeconds);
			const event: CollisionEvent | undefined = this.collisionSystem.resolveCandidate(this.world, candidate, eventTime);
			if (event !== undefined) {
				events.push(event);
			}
			const consumedSeconds: number = Math.max(timeToImpactSeconds,
				SimulationRunner.CollisionTimeEpsilonSeconds);
			const safeConsumedSeconds: number = Math.min(remainingSeconds, consumedSeconds);
			if (safeConsumedSeconds > timeToImpactSeconds) {
				this.integrator.step(this.world, safeConsumedSeconds - timeToImpactSeconds);
			}
			elapsedSeconds += safeConsumedSeconds;
			remainingSeconds -= safeConsumedSeconds;
		}
		// 安全上限後もbase dtを欠落させず、同じIntegratorで有限に完走します。
		if (remainingSeconds > 0) {
			this.integrator.step(this.world, remainingSeconds);
		}
		return events;
	}
}
