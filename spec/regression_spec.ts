import {PhysicalConstant} from "../src/physical_constant";
import {Pos, Velocity} from "../src/motion";
import {
	IPhysicsIntegrator,
	SymplecticEulerIntegrator,
	VelocityVerletIntegrator
} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {Planet} from "../src/planet";
import {Setting} from "../src/setting";

describe("2体問題の数値回帰", (): void => {
	it.each([
		["Symplectic Euler", new SymplecticEulerIntegrator()],
		["Velocity Verlet", new VelocityVerletIntegrator()]
	])("%sで1年間進めても有限値と合理的なエネルギー誤差を保つ", (_name: string, integrator: IPhysicsIntegrator): void => {
		const world: PhysicsWorld = createCircularTwoBodyWorld();
		const initialEnergy: number = calculateTotalEnergy(world);
		const stepCount: number = 365 * Setting.SecondsPerDay / Setting.PhysicsStepSeconds;

		for (let index: number = 0; index < stepCount; index += 1) {
			integrator.step(world, Setting.PhysicsStepSeconds);
		}

		world.bodies.forEach((body: Planet): void => {
			expect(Number.isFinite(body.pos.x)).toBe(true);
			expect(Number.isFinite(body.pos.y)).toBe(true);
			expect(Number.isFinite(body.velocity.x)).toBe(true);
			expect(Number.isFinite(body.velocity.y)).toBe(true);
		});
		const finalEnergy: number = calculateTotalEnergy(world);
		const relativeEnergyError: number = Math.abs((finalEnergy - initialEnergy) / initialEnergy);
		expect(relativeEnergyError).toBeLessThan(0.01);
	});
});

/** 太陽・地球相当の2天体を重心基準の円軌道へ配置します。 */
function createCircularTwoBodyWorld(): PhysicsWorld {
	const starMass: number = 1.989e30;
	const planetMass: number = 5.972e24;
	const separation: number = PhysicalConstant.AstroUnit;
	const totalMass: number = starMass + planetMass;
	const angularVelocity: number = Math.sqrt(
		PhysicalConstant.ConstantOfGravitation * totalMass / Math.pow(separation, 3)
	);
	const starDistance: number = separation * planetMass / totalMass;
	const planetDistance: number = separation * starMass / totalMass;
	const star: Planet = new Planet(
		6.96e8,
		starMass,
		new Pos(-starDistance, 0),
		new Velocity(0, -angularVelocity * starDistance)
	);
	const planet: Planet = new Planet(
		6.37e6,
		planetMass,
		new Pos(planetDistance, 0),
		new Velocity(0, angularVelocity * planetDistance)
	);
	return new PhysicsWorld([star, planet]);
}

/** 2体の運動エネルギーと重力ポテンシャルエネルギーの和を返します。 */
function calculateTotalEnergy(world: PhysicsWorld): number {
	const first: Planet = world.bodies[0];
	const second: Planet = world.bodies[1];
	const firstKinetic: number = 0.5 * first.mass * (
		first.velocity.x * first.velocity.x + first.velocity.y * first.velocity.y
	);
	const secondKinetic: number = 0.5 * second.mass * (
		second.velocity.x * second.velocity.x + second.velocity.y * second.velocity.y
	);
	const deltaX: number = second.pos.x - first.pos.x;
	const deltaY: number = second.pos.y - first.pos.y;
	const distance: number = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
	const potential: number = -PhysicalConstant.ConstantOfGravitation * first.mass * second.mass / distance;
	return firstKinetic + secondKinetic + potential;
}
