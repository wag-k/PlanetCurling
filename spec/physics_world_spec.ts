import {Acceleration, Pos, Velocity} from "../src/motion";
import {PhysicsWorld, PhysicsWorldClone} from "../src/physics_world";
import {Planet} from "../src/planet";

describe("PhysicsWorld deep clone", (): void => {
	it("全物理値を複製し、元天体からclone天体を明示的に取得できる", (): void => {
		const first: Planet = new Planet(10, 20, new Pos(30, 40), new Velocity(50, 60), new Acceleration(70, 80));
		const second: Planet = new Planet(11, 21, new Pos(31, 41), new Velocity(51, 61), new Acceleration(71, 81));
		const original: PhysicsWorld = new PhysicsWorld([first, second]);

		const cloned: PhysicsWorldClone = original.cloneWithMapping();
		const clonedFirst: Planet = cloned.getClonedBody(first);

		expect(cloned.world.bodies).toHaveLength(2);
		expect(clonedFirst).toEqual(first);
		expect(clonedFirst).not.toBe(first);
		expect(clonedFirst.pos).not.toBe(first.pos);
		expect(clonedFirst.velocity).not.toBe(first.velocity);
		expect(clonedFirst.acceleration).not.toBe(first.acceleration);
		expect(cloned.getClonedBody(second)).toBe(cloned.world.bodies[1]);
	});

	it("clone側の全物理値を変更してもoriginalを変更しない", (): void => {
		const originalBody: Planet = new Planet(
			10,
			20,
			new Pos(30, 40),
			new Velocity(50, 60),
			new Acceleration(70, 80)
		);
		const original: PhysicsWorld = new PhysicsWorld([originalBody]);
		const clonedBody: Planet = original.clone().bodies[0];

		clonedBody.radius = 100;
		clonedBody.mass = 200;
		clonedBody.pos.x = 300;
		clonedBody.velocity.y = 600;
		clonedBody.acceleration.x = 700;

		expect(originalBody).toEqual(new Planet(
			10,
			20,
			new Pos(30, 40),
			new Velocity(50, 60),
			new Acceleration(70, 80)
		));
	});

	it("clone元にない天体の暗黙index対応を許可しない", (): void => {
		const original: PhysicsWorld = new PhysicsWorld([new Planet()]);
		const cloned: PhysicsWorldClone = original.cloneWithMapping();

		expect((): Planet => cloned.getClonedBody(new Planet())).toThrow();
	});
});
