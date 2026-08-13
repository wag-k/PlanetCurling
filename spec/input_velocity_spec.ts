import {calculateLaunchVelocity} from "../src/input_velocity";
import {Velocity} from "../src/motion";
import {Setting} from "../src/setting";

describe("ドラッグ入力", (): void => {
	it("従来の30日基準速度へ最終的に1.5倍を適用する", (): void => {
		const worldWidthMeters: number = 1000000;
		const viewportWidthPixels: number = 1000;
		const velocity: Velocity = calculateLaunchVelocity(50, -25, worldWidthMeters, viewportWidthPixels);
		const legacyVelocityPerPixel: number =
			-worldWidthMeters / (30 * Setting.SecondsPerDay) / viewportWidthPixels / 100;

		expect(velocity.x).toBeCloseTo(legacyVelocityPerPixel * 50 * 1.5, 15);
		expect(velocity.y).toBeCloseTo(legacyVelocityPerPixel * -25 * 1.5, 15);
		expect(Setting.LaunchVelocityMultiplier).toBe(1.5);
	});

	it("物理dtを入力に受け取らず独立した基準時間だけで換算する", (): void => {
		const first: Velocity = calculateLaunchVelocity(10, 20, 1000000, 1000, 12345, 50, 1.5);
		const second: Velocity = calculateLaunchVelocity(10, 20, 1000000, 1000, 12345, 50, 1.5);

		expect(first.x).toBe(second.x);
		expect(first.y).toBe(second.y);
		expect(Setting.PhysicsStepSeconds).not.toBe(Setting.InputVelocityReferenceSeconds);
	});
});
