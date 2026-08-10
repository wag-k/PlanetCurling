import {calculateAccelerations} from "../src/gravity";
import {Acceleration, Pos, Velocity} from "../src/motion";
import {PhysicalConstant} from "../src/physical_constant";
import {Planet} from "../src/planet";

describe("重力加速度", (): void => {
	it("単一天体では0になる", (): void => {
		const body: Planet = new Planet(1, 10, new Pos(3, 4));
		const result: Acceleration[] = calculateAccelerations([body]);

		expect(result).toHaveLength(1);
		expect(result[0].x).toBe(0);
		expect(result[0].y).toBe(0);
	});

	it("2天体では互いの方向を向きNewtonの式と一致する", (): void => {
		const distance: number = 10;
		const leftMass: number = 20;
		const rightMass: number = 30;
		const left: Planet = new Planet(1, leftMass, new Pos(0, 0), new Velocity(0, 0));
		const right: Planet = new Planet(1, rightMass, new Pos(distance, 0), new Velocity(0, 0));

		const result: Acceleration[] = calculateAccelerations([left, right]);

		expect(result[0].x).toBeCloseTo(
			PhysicalConstant.ConstantOfGravitation * rightMass / Math.pow(distance, 2),
			15
		);
		expect(result[0].y).toBe(0);
		expect(result[1].x).toBeCloseTo(
			-PhysicalConstant.ConstantOfGravitation * leftMass / Math.pow(distance, 2),
			15
		);
		expect(result[1].y).toBe(0);
	});
});
