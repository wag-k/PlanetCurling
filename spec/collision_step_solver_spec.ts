import {CollisionEvent, CollisionEventKind, CollisionSystem} from "../src/collision";
import {Acceleration, Pos, Velocity} from "../src/motion";
import {IPhysicsIntegrator, PhysicsIntegratorKind} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {Planet} from "../src/planet";
import {PhysicsStateSnapshot, SimulationRunner} from "../src/simulation_runner";

/** 重力なしの解析しやすい直線運動でも、solverのinternal substep経路は本番と同じです。 */
class LinearIntegrator implements IPhysicsIntegrator {
	readonly kind: PhysicsIntegratorKind = PhysicsIntegratorKind.SymplecticEuler;
	readonly steps: number[] = [];
	step(world: PhysicsWorld, deltaTimeSeconds: number): void {
		this.steps.push(deltaTimeSeconds);
		world.bodies.forEach((body: Planet): void => body.pos.update(deltaTimeSeconds, body.velocity));
	}
}

function body(x: number, velocityX: number): Planet {
	return new Planet(1, 1, new Pos(x, 0), new Velocity(velocityX, 0), new Acceleration(0, 0));
}

function run(world: PhysicsWorld, central: Planet, stones: Planet[], seconds: number): {events: CollisionEvent[]; integrator: LinearIntegrator} {
	const integrator: LinearIntegrator = new LinearIntegrator();
	const runner: SimulationRunner = new SimulationRunner(world, integrator, seconds);
	runner.setCollisionSystem(new CollisionSystem(central, stones, 0.5, 0.5, 1));
	let events: CollisionEvent[] = [];
	runner.advance(seconds, (_world, _step, values: CollisionEvent[]): void => { events = values; });
	return {events: events, integrator: integrator};
}

describe("chronological collision-aware fixed step", (): void => {
	it("Stoneとの先行衝突で元の直線軌道上にあったSun吸収を回避する", (): void => {
		const central: Planet = body(3, 0);
		central.pos.y = 0;
		const moving: Planet = body(-3, 2);
		const blocker: Planet = body(0, 0);
		blocker.pos.y = 0.8;
		const result = run(new PhysicsWorld([central, moving, blocker]), central, [moving, blocker], 3);
		expect(result.events[0].kind).toBe(CollisionEventKind.StoneStone);
		expect(result.events.some((event: CollisionEvent): boolean =>
			event.kind === CollisionEventKind.StoneCentralBody && event.firstBody === moving)).toBe(false);
		expect(result.events.length).toBeLessThanOrEqual(SimulationRunner.MaxCollisionEventsPerPhysicsStep);
	});

	it("Stone-Stoneを後発のSun吸収より先に解決し、step内時刻を秒で通知する", (): void => {
		const central: Planet = body(8, 0);
		central.mass = 100;
		const first: Planet = body(0, 4);
		const second: Planet = body(3, 0);
		const result = run(new PhysicsWorld([central, first, second]), central, [first, second], 2);
		expect(result.events.map((event: CollisionEvent): CollisionEventKind => event.kind)).toEqual([
			CollisionEventKind.StoneStone, CollisionEventKind.StoneCentralBody
		]);
		expect(result.events[0].timeFromStepStartSeconds).toBeCloseTo(0.5, 8);
		expect(result.events[1].timeFromStepStartSeconds).toBeCloseTo(1.5, 8);
	});

	it("AからB、BからCへの三体cascadeを1base step内で順に処理する", (): void => {
		const central: Planet = body(100, 0);
		const first: Planet = body(0, 10);
		const second: Planet = body(3, 0);
		const third: Planet = body(6, 0);
		const result = run(new PhysicsWorld([central, first, second, third]), central, [first, second, third], 1);
		expect(result.events).toHaveLength(2);
		expect(result.events[0].firstBody).toBe(first);
		expect(result.events[0].secondBody).toBe(second);
		expect(result.events[1].firstBody).toBe(second);
		expect(result.events[1].secondBody).toBe(third);
		expect(result.events[1].timeFromStepStartSeconds).toBeGreaterThan(result.events[0].timeFromStepStartSeconds);
	});

	it("衝突後の残時間も同じIntegratorへ戻し、単純なposition補間で済ませない", (): void => {
		const central: Planet = body(100, 0);
		const first: Planet = body(0, 4);
		const second: Planet = body(3, 0);
		const result = run(new PhysicsWorld([central, first, second]), central, [first, second], 2);
		expect(result.integrator.steps.length).toBeGreaterThan(2);
		expect(result.integrator.steps.some((seconds: number): boolean => seconds > 0 && seconds < 2)).toBe(true);
	});

	it("full snapshotはPlanet参照を保ちposition・velocity・accelerationを復元する", (): void => {
		const original: Planet = body(1, 2);
		original.acceleration.x = 3;
		const world: PhysicsWorld = new PhysicsWorld([original]);
		const snapshot: PhysicsStateSnapshot = new PhysicsStateSnapshot(world);
		original.pos.x = 9; original.velocity.x = 8; original.acceleration.x = 7;
		world.removeBody(original);
		snapshot.restore(world);
		expect(world.bodies[0]).toBe(original);
		expect([original.pos.x, original.velocity.x, original.acceleration.x]).toEqual([1, 2, 3]);
	});
});
