import {calculateAccelerations} from "../src/gravity";
import {Acceleration, Pos, Velocity} from "../src/motion";
import {
	createPhysicsIntegrator,
	PhysicsIntegratorKind,
	SymplecticEulerIntegrator,
	VelocityVerletIntegrator
} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {Planet} from "../src/planet";

describe("Symplectic Euler", (): void => {
	it("重力がなければ一定速度で移動する", (): void => {
		const body: Planet = new Planet(1, 1, new Pos(2, 3), new Velocity(4, -5));
		const world: PhysicsWorld = new PhysicsWorld([body]);

		new SymplecticEulerIntegrator().step(world, 10);

		expect(body.pos.x).toBe(42);
		expect(body.pos.y).toBe(-47);
		expect(body.velocity.x).toBe(4);
		expect(body.velocity.y).toBe(-5);
	});

	it("天体配列の更新順に依存しない", (): void => {
		const firstA: Planet = new Planet(1, 2e10, new Pos(-10, 0), new Velocity(0, 1));
		const firstB: Planet = new Planet(1, 3e10, new Pos(10, 0), new Velocity(0, -1));
		const secondA: Planet = firstA.clone();
		const secondB: Planet = firstB.clone();

		const integrator: SymplecticEulerIntegrator = new SymplecticEulerIntegrator();
		integrator.step(new PhysicsWorld([firstA, firstB]), 0.5);
		integrator.step(new PhysicsWorld([secondB, secondA]), 0.5);

		expect(firstA.pos.x).toBeCloseTo(secondA.pos.x, 12);
		expect(firstA.pos.y).toBeCloseTo(secondA.pos.y, 12);
		expect(firstB.pos.x).toBeCloseTo(secondB.pos.x, 12);
		expect(firstB.pos.y).toBeCloseTo(secondB.pos.y, 12);
	});
});

describe("Velocity Verlet", (): void => {
	it("重力がなければ一定速度で移動する", (): void => {
		const body: Planet = new Planet(1, 1, new Pos(2, 3), new Velocity(4, -5));
		const world: PhysicsWorld = new PhysicsWorld([body]);

		new VelocityVerletIntegrator().step(world, 10);

		expect(body.pos.x).toBe(42);
		expect(body.pos.y).toBe(-47);
		expect(body.velocity.x).toBe(4);
		expect(body.velocity.y).toBe(-5);
	});

	it("更新後の全位置で加速度を再評価する", (): void => {
		const left: Planet = new Planet(1, 1e10, new Pos(0, 0), new Velocity(0, 0));
		const right: Planet = new Planet(1, 2e10, new Pos(1000, 0), new Velocity(0, 0));
		const world: PhysicsWorld = new PhysicsWorld([left, right]);
		const current: Acceleration[] = calculateAccelerations(world.bodies);
		const deltaTime: number = 2;
		const expectedLeftPosition: number = 0.5 * current[0].x * deltaTime * deltaTime;
		const expectedRightPosition: number = 1000 + 0.5 * current[1].x * deltaTime * deltaTime;

		new VelocityVerletIntegrator().step(world, deltaTime);
		const updated: Acceleration[] = calculateAccelerations(world.bodies);

		expect(left.pos.x).toBeCloseTo(expectedLeftPosition, 12);
		expect(right.pos.x).toBeCloseTo(expectedRightPosition, 12);
		expect(left.acceleration.x).toBeCloseTo(updated[0].x, 15);
		expect(right.acceleration.x).toBeCloseTo(updated[1].x, 15);
		expect(left.velocity.x).toBeCloseTo(0.5 * (current[0].x + updated[0].x) * deltaTime, 15);
	});

	it("天体配列の更新順に依存しない", (): void => {
		const firstA: Planet = new Planet(1, 2e10, new Pos(-10, 0), new Velocity(0, 1));
		const firstB: Planet = new Planet(1, 3e10, new Pos(10, 0), new Velocity(0, -1));
		const secondA: Planet = firstA.clone();
		const secondB: Planet = firstB.clone();

		const integrator: VelocityVerletIntegrator = new VelocityVerletIntegrator();
		integrator.step(new PhysicsWorld([firstA, firstB]), 0.5);
		integrator.step(new PhysicsWorld([secondB, secondA]), 0.5);

		expect(firstA.pos.x).toBeCloseTo(secondA.pos.x, 12);
		expect(firstA.velocity.x).toBeCloseTo(secondA.velocity.x, 12);
		expect(firstB.pos.x).toBeCloseTo(secondB.pos.x, 12);
		expect(firstB.velocity.x).toBeCloseTo(secondB.velocity.x, 12);
	});
});

describe("積分器切り替え", (): void => {
	it("同じPhysicsWorldを設定した種類の積分器で更新できる", (): void => {
		const body: Planet = new Planet(1, 1, new Pos(0, 0), new Velocity(1, 0));
		const world: PhysicsWorld = new PhysicsWorld([body]);
		const symplectic = createPhysicsIntegrator(PhysicsIntegratorKind.SymplecticEuler);
		symplectic.step(world, 1);
		expect(symplectic.kind).toBe(PhysicsIntegratorKind.SymplecticEuler);
		expect(body.pos.x).toBe(1);

		const verlet = createPhysicsIntegrator(PhysicsIntegratorKind.VelocityVerlet);
		verlet.step(world, 1);
		expect(verlet.kind).toBe(PhysicsIntegratorKind.VelocityVerlet);
		expect(body.pos.x).toBe(2);
	});
});
