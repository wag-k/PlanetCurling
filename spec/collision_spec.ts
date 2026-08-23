import {
	BodyPositionSnapshot,
	CollisionDetector,
	CollisionEvent,
	CollisionEventKind,
	CollisionResolver,
	CollisionSystem,
	SweptCollisionContact
} from "../src/collision";
import {GameBalance} from "../src/game_balance";
import {MatchController} from "../src/match_controller";
import {Acceleration, Pos, Velocity} from "../src/motion";
import {Planet} from "../src/planet";
import {IPhysicsIntegrator, PhysicsIntegratorKind} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {SimulationRunner} from "../src/simulation_runner";
import {TrajectoryPoint, TrajectoryPredictor} from "../src/trajectory";

/** 指定した質量・位置・速度の衝突テスト用天体を生成します。 */
function createBody(mass: number, x: number, y: number, velocityX: number, velocityY: number): Planet {
	return new Planet(
		1,
		mass,
		new Pos(x, y),
		new Velocity(velocityX, velocityY),
		new Acceleration(0, 0)
	);
}

/** 重力や移動を行わず、衝突フェーズだけを検証する積分器を生成します。 */
function createNoOpIntegrator(): IPhysicsIntegrator {
	return {
		kind: PhysicsIntegratorKind.SymplecticEuler,
		step: (): void => {
			// 衝突テストでは必要に応じてステップ前後の位置を直接設定します。
		}
	};
}

describe("CollisionDetector", (): void => {
	it("1ステップ中に高速ですれ違う2円の最初の接触時刻を検出する", (): void => {
		const first: Planet = createBody(1, 10, 0, 20, 0);
		const second: Planet = createBody(1, -10, 0, -20, 0);
		const contact: SweptCollisionContact | undefined = CollisionDetector.detectSweptCircle(
			first,
			second,
			new Pos(-10, 0),
			new Pos(10, 0),
			1,
			1
		);

		expect(contact).toBeDefined();
		expect(contact!.timeRatio).toBeCloseTo(0.45, 10);
		expect(contact!.firstContactPosition.x).toBeCloseTo(-1, 10);
		expect(contact!.secondContactPosition.x).toBeCloseTo(1, 10);
	});

	it("離れた平行移動では接触を返さない", (): void => {
		const first: Planet = createBody(1, 10, 0, 10, 0);
		const second: Planet = createBody(1, 10, 5, 10, 0);

		expect(CollisionDetector.detectSweptCircle(
			first,
			second,
			new Pos(0, 0),
			new Pos(0, 5),
			1,
			1
		)).toBeUndefined();
	});
});

describe("CollisionResolver", (): void => {
	it("同質量の正面衝突で反発係数0.9を適用して速度を交換する", (): void => {
		const first: Planet = createBody(2, -1, 0, 10, 0);
		const second: Planet = createBody(2, 1, 0, -10, 0);
		const contact: SweptCollisionContact = new SweptCollisionContact(
			first,
			second,
			0,
			1,
			0,
			first.pos.clone(),
			second.pos.clone(),
			true
		);

		expect(CollisionResolver.resolveStoneCollision(contact, 1, 2, 0.9)).toBe(true);
		expect(first.velocity.x).toBeCloseTo(-9, 10);
		expect(second.velocity.x).toBeCloseTo(9, 10);
	});

	it("反発係数を変更すると法線方向の相対分離速度が同じ比率で変わる", (): void => {
		/** 指定反発係数で正面衝突後の相対分離速度を返します。 */
		function resolveWithRestitution(restitution: number): number {
			const first: Planet = createBody(1, -1, 0, 5, 0);
			const second: Planet = createBody(1, 1, 0, -5, 0);
			const contact: SweptCollisionContact = new SweptCollisionContact(
				first,
				second,
				0,
				1,
				0,
				first.pos.clone(),
				second.pos.clone(),
				true
			);
			CollisionResolver.resolveStoneCollision(contact, 1, 2, restitution);
			return second.velocity.x - first.velocity.x;
		}

		expect(resolveWithRestitution(0.7)).toBeCloseTo(7, 10);
		expect(resolveWithRestitution(1)).toBeCloseTo(10, 10);
	});

	it("斜め衝突では接線方向速度を保つ", (): void => {
		const first: Planet = createBody(1, -1, 0, 4, 3);
		const second: Planet = createBody(1, 1, 0, 0, -2);
		const contact: SweptCollisionContact = new SweptCollisionContact(
			first,
			second,
			0,
			1,
			0,
			first.pos.clone(),
			second.pos.clone(),
			true
		);

		CollisionResolver.resolveStoneCollision(contact, 1, 2, 1);
		expect(first.velocity.y).toBe(3);
		expect(second.velocity.y).toBe(-2);
		expect(first.velocity.x).toBeCloseTo(0, 10);
		expect(second.velocity.x).toBeCloseTo(4, 10);
	});

	it("異なる質量でも運動量を保存する", (): void => {
		const first: Planet = createBody(2, -1, 0, 6, 0);
		const second: Planet = createBody(5, 1, 0, -1, 0);
		const momentumBefore: number = first.mass * first.velocity.x + second.mass * second.velocity.x;
		const contact: SweptCollisionContact = new SweptCollisionContact(
			first,
			second,
			0,
			1,
			0,
			first.pos.clone(),
			second.pos.clone(),
			true
		);

		CollisionResolver.resolveStoneCollision(contact, 1, 2, 0.9);
		const momentumAfter: number = first.mass * first.velocity.x + second.mass * second.velocity.x;
		expect(momentumAfter).toBeCloseTo(momentumBefore, 10);
	});

	it("分離中の接触へインパルスを繰り返し加えない", (): void => {
		const first: Planet = createBody(1, -0.9, 0, -2, 0);
		const second: Planet = createBody(1, 0.9, 0, 2, 0);
		const contact: SweptCollisionContact = new SweptCollisionContact(
			first,
			second,
			0,
			1,
			0,
			first.pos.clone(),
			second.pos.clone(),
			true
		);

		expect(CollisionResolver.resolveStoneCollision(contact, 1, 2, 0.9)).toBe(false);
		expect(first.velocity.x).toBe(-2);
		expect(second.velocity.x).toBe(2);
		expect(second.pos.x - first.pos.x).toBeCloseTo(2, 10);
	});

	it("完全に同じ位置からでもNaNを出さずめり込みを解消する", (): void => {
		const first: Planet = createBody(1, 0, 0, 0, 0);
		const second: Planet = createBody(1, 0, 0, 0, 0);
		const contact: SweptCollisionContact | undefined = CollisionDetector.detectSweptCircle(
			first,
			second,
			first.pos,
			second.pos,
			1,
			1
		);

		CollisionResolver.resolveStoneCollision(contact!, 1, 2, 0.9);
		expect(Number.isFinite(first.pos.x)).toBe(true);
		expect(Number.isFinite(second.pos.x)).toBe(true);
		expect(second.pos.x - first.pos.x).toBeCloseTo(2, 10);
	});
});

describe("CollisionSystem", (): void => {
	it("高速ですり抜ける投石同士を反発させ、種類付きイベントを返す", (): void => {
		const central: Planet = createBody(100, 100, 100, 0, 0);
		const first: Planet = createBody(1, 10, 0, 20, 0);
		const second: Planet = createBody(1, -10, 0, -20, 0);
		const world: PhysicsWorld = new PhysicsWorld([central, first, second]);
		const system: CollisionSystem = new CollisionSystem(central, [first, second], 1, 1, 0.9);
		const snapshots: BodyPositionSnapshot[] = [
			new BodyPositionSnapshot(central, central.pos),
			new BodyPositionSnapshot(first, new Pos(-10, 0)),
			new BodyPositionSnapshot(second, new Pos(10, 0))
		];

		const events: CollisionEvent[] = system.resolveAfterStep(world, snapshots, 1);
		expect(events).toHaveLength(1);
		expect(events[0].kind).toBe(CollisionEventKind.StoneStone);
		expect(first.velocity.x).toBeCloseTo(-18, 10);
		expect(second.velocity.x).toBeCloseTo(18, 10);
	});

	it("中央天体へ接触した投石を物理世界から除外し中央天体を変更しない", (): void => {
		const central: Planet = createBody(100, 0, 0, 7, -3);
		const stone: Planet = createBody(1, -5, 0, 10, 0);
		const world: PhysicsWorld = new PhysicsWorld([central, stone]);
		const system: CollisionSystem = new CollisionSystem(central, [stone], 1, 2, 0.9);
		const centralSnapshot: Planet = central.clone();
		const snapshots: BodyPositionSnapshot[] = system.capturePositions();
		stone.pos.x = 5;

		const events: CollisionEvent[] = system.resolveAfterStep(world, snapshots, 1);
		expect(events).toHaveLength(1);
		expect(events[0].kind).toBe(CollisionEventKind.StoneCentralBody);
		expect(world.bodies).toEqual([central]);
		expect(central).toEqual(centralSnapshot);
		expect(stone.pos.x).toBeCloseTo(-3, 10);
	});

	it("中央天体と完全に同じ位置の投石を積分前に安全に吸収する", (): void => {
		const central: Planet = createBody(100, 0, 0, 0, 0);
		const stone: Planet = createBody(1, 0, 0, 0, 0);
		const world: PhysicsWorld = new PhysicsWorld([central, stone]);
		const runner: SimulationRunner = new SimulationRunner(world, createNoOpIntegrator(), 1);
		runner.setCollisionSystem(new CollisionSystem(central, [stone], 1, 2, 0.9));
		let events: CollisionEvent[] = [];

		runner.advance(1, (_world, _step, stepEvents: CollisionEvent[]): void => {
			events = stepEvents;
		});
		expect(world.bodies).toEqual([central]);
		expect(events[0].kind).toBe(CollisionEventKind.StoneCentralBody);
	});
});

describe("ゲーム進行と予測への衝突統合", (): void => {
	it("吸収された投石を状態として保持し、得点0・物理除外・最終軌跡保存にする", (): void => {
		const runner: SimulationRunner = new SimulationRunner(new PhysicsWorld(), createNoOpIntegrator(), 1);
		const controller: MatchController = new MatchController(runner);
		const stone = controller.activeStone!;
		stone.body.pos.x = controller.centralBody.pos.x;
		stone.body.pos.y = controller.centralBody.pos.y;
		controller.releaseActiveStone();

		controller.advanceSimulation(1);
		expect(stone.isAbsorbed).toBe(true);
		expect(runner.world.bodies.indexOf(stone.body)).toBe(-1);
		expect(controller.currentEndRedScore).toBe(0);
		expect(stone.actualTrajectory[stone.actualTrajectory.length - 1].xMetres).toBe(stone.body.pos.x);
		expect(controller.consumeCollisionEvents()[0].kind).toBe(CollisionEventKind.StoneCentralBody);
	});

	it("予測中のactiveStoneにも本番と同じ投石衝突を適用する", (): void => {
		const central: Planet = createBody(1, 100, 100, 0, 0);
		const active: Planet = createBody(1, 0, 0, 0, 0);
		const other: Planet = createBody(1, 3, 0, 0, 0);
		const world: PhysicsWorld = new PhysicsWorld([central, active, other]);
		const collisionSystem: CollisionSystem = new CollisionSystem(central, [active, other], 0.5, 0.5, 1);
		const predictor: TrajectoryPredictor = new TrajectoryPredictor(
			PhysicsIntegratorKind.SymplecticEuler,
			1,
			2,
			1
		);

		const points: TrajectoryPoint[] = predictor.predict(world, active, new Velocity(10, 0), collisionSystem);
		const predictedCollision: CollisionEvent = predictor.getLastCollisionEvents()[0];
		active.velocity.x = 10;
		const actualRunner: SimulationRunner = new SimulationRunner(
			world,
			createNoOpIntegrator(),
			1
		);
		actualRunner.getIntegrator().step = (actualWorld: PhysicsWorld, stepSeconds: number): void => {
			actualWorld.bodies.forEach((body: Planet): void => body.pos.update(stepSeconds, body.velocity));
		};
		actualRunner.setCollisionSystem(collisionSystem);
		let actualCollision: CollisionEvent | undefined;
		actualRunner.advance(1, (_actualWorld, _step, events: CollisionEvent[]): void => {
			actualCollision = events[0];
		});
		expect(points.length).toBeGreaterThan(1);
		expect(predictedCollision.kind).toBe(CollisionEventKind.StoneStone);
		expect(actualCollision).toBeDefined();
		expect(actualCollision!.position.x).toBeCloseTo(predictedCollision.position.x, 6);
		expect(actualCollision!.position.y).toBeCloseTo(predictedCollision.position.y, 6);
	});

	it("New Gameで吸収状態・衝突イベント・過去軌跡を破棄する", (): void => {
		const runner: SimulationRunner = new SimulationRunner(new PhysicsWorld(), createNoOpIntegrator(), 1);
		const controller: MatchController = new MatchController(runner);
		const absorbedStone = controller.activeStone!;
		absorbedStone.body.pos.x = controller.centralBody.pos.x;
		absorbedStone.body.pos.y = controller.centralBody.pos.y;
		controller.releaseActiveStone();
		controller.advanceSimulation(1);
		expect(absorbedStone.isAbsorbed).toBe(true);

		controller.newGame();
		expect(controller.stones).toHaveLength(1);
		expect(controller.stones[0].isAbsorbed).toBe(false);
		expect(controller.stones[0].actualTrajectory).toHaveLength(0);
		expect(controller.consumeCollisionEvents()).toHaveLength(0);
	});

	it("描画用とゲームプレイ用の半径を独立して保持する", (): void => {
		expect(GameBalance.StoneCollisionRadiusMetres).not.toBe(GameBalance.StoneRadiusMetres);
		expect(GameBalance.CentralBodyCollisionRadiusMetres).not.toBe(GameBalance.CentralBodyRadiusMetres);
		expect(GameBalance.StoneCollisionRestitution).toBe(0.9);
	});
});
