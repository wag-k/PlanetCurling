import {GameBalance} from "../src/game_balance";
import {MatchController} from "../src/match_controller";
import {Acceleration, Pos, Velocity} from "../src/motion";
import {IPhysicsIntegrator, PhysicsIntegratorKind} from "../src/physics_integrator";
import {PhysicsWorld} from "../src/physics_world";
import {
	formatScoreDistanceAu,
	ScoreDetailKind,
	ScoreDetailsModel
} from "../src/score_details";
import {Setting} from "../src/setting";
import {SimulationRunner} from "../src/simulation_runner";
import {PhysicalConstant} from "../src/physical_constant";

/** 得点内訳のUIモデルだけを高速に検証するno-op物理Controllerを生成します。 */
function createController(): MatchController {
	const integrator: IPhysicsIntegrator = {
		kind: PhysicsIntegratorKind.SymplecticEuler,
		step: (): void => {
			// Score Details testでは既存のNewton物理計算を重複検証しません。
		}
	};
	const controller: MatchController = new MatchController(new SimulationRunner(
		new PhysicsWorld(), integrator, Setting.PhysicsStepSeconds
	));
	controller.simulationRunner.setCollisionSystem(undefined);
	return controller;
}

describe("Score Details model", (): void => {
	it("現在EndのR1～R3・B1～B3を固定順で表示し、未投球をハイフン扱いにする", (): void => {
		const controller: MatchController = createController();

		const model: ScoreDetailsModel = ScoreDetailsModel.fromMatchController(controller);

		expect(model.endNumber).toBe(1);
		expect(model.rows.map((row): string => row.stoneId)).toEqual(["R1", "R2", "R3", "B1", "B2", "B3"]);
		model.rows.forEach((row): void => {
			expect(row.kind).toBe(ScoreDetailKind.Unreleased);
			expect(row.points).toBeUndefined();
			expect(row.evaluation).toBeUndefined();
		});
	});

	it("released Stoneへ位置誤差・速度ペナルティ・実効誤差・点数を同じ評価結果から表示する", (): void => {
		const controller: MatchController = createController();
		const stone = controller.activeStone!;
		const positionErrorMetres: number = 0.12 * PhysicalConstant.AstroUnit;
		const speedPenaltyMetres: number = 0.05 * PhysicalConstant.AstroUnit;
		stone.body.pos = new Pos(
			controller.centralBody.pos.x + GameBalance.TargetOrbitRadiusMetres + positionErrorMetres,
			controller.centralBody.pos.y
		);
		stone.body.velocity = new Velocity(
			controller.centralBody.velocity.x + speedPenaltyMetres / Setting.ScoreVelocityReferenceSeconds,
			controller.centralBody.velocity.y
		);
		controller.releaseActiveStone();

		const row = ScoreDetailsModel.fromMatchController(controller).rows[0];

		expect(row.kind).toBe(ScoreDetailKind.Scored);
		expect(row.evaluation!.radialDistanceErrorMetres).toBeCloseTo(positionErrorMetres, 4);
		expect(row.evaluation!.radialVelocityPenaltyMetres).toBeCloseTo(speedPenaltyMetres, 4);
		expect(row.evaluation!.effectiveOrbitErrorMetres).toBeCloseTo(
			positionErrorMetres + speedPenaltyMetres, 4
		);
		expect(row.points).toBe(3);
		expect(formatScoreDistanceAu(row.evaluation!.radialDistanceErrorMetres)).toBe("0.12 AU");
		expect(formatScoreDistanceAu(row.evaluation!.radialVelocityPenaltyMetres)).toBe("0.05 AU");
		expect(formatScoreDistanceAu(row.evaluation!.effectiveOrbitErrorMetres)).toBe("0.17 AU");
	});

	it("吸収済みStoneを内訳対象外の0点として表示する", (): void => {
		const controller: MatchController = createController();
		const stone = controller.activeStone!;
		controller.releaseActiveStone();
		stone.markAbsorbed();

		const row = ScoreDetailsModel.fromMatchController(controller).rows[0];

		expect(row.kind).toBe(ScoreDetailKind.Absorbed);
		expect(row.points).toBe(0);
		expect(row.evaluation).toBeUndefined();
	});

	it("モデル生成でStone位置・速度・加速度・得点を変更しない", (): void => {
		const controller: MatchController = createController();
		const stone = controller.activeStone!;
		stone.body.pos.x = controller.centralBody.pos.x + GameBalance.TargetOrbitRadiusMetres;
		stone.body.acceleration = new Acceleration(12, -8);
		controller.releaseActiveStone();
		const positionBefore: Pos = stone.body.pos.clone();
		const velocityBefore: Velocity = stone.body.velocity.clone();
		const accelerationBefore: Acceleration = stone.body.acceleration.clone();
		const scoreBefore: number = controller.currentEndRedScore;

		ScoreDetailsModel.fromMatchController(controller);

		expect(stone.body.pos).toEqual(positionBefore);
		expect(stone.body.velocity).toEqual(velocityBefore);
		expect(stone.body.acceleration).toEqual(accelerationBefore);
		expect(controller.currentEndRedScore).toBe(scoreBefore);
	});
});
