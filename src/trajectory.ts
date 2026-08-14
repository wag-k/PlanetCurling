import {Velocity} from "./motion";
import {createPhysicsIntegrator, PhysicsIntegratorKind} from "./physics_integrator";
import {PhysicsWorld, PhysicsWorldClone} from "./physics_world";
import {Planet} from "./planet";
import {SimulationRunner} from "./simulation_runner";

/** 軌道上のsample点をSI単位と開始後経過時間で表します。 */
export class TrajectoryPoint {
	/** sample時点のx座標（m）です。 */
	readonly xMetres: number;

	/** sample時点のy座標（m）です。 */
	readonly yMetres: number;

	/** 記録開始から物理時間が進んだ秒数です。 */
	readonly elapsedSeconds: number;

	/** 独立した数値だけを持つ軌道点を生成します。 */
	constructor(xMetres: number, yMetres: number, elapsedSeconds: number) {
		this.xMetres = xMetres;
		this.yMetres = yMetres;
		this.elapsedSeconds = elapsedSeconds;
	}
}

/** 物理ステップ完了通知から一定ゲーム内時間ごとの位置だけをsampleします。 */
export class TrajectoryRecorder {
	/** 描画点数を抑えるsample間隔（s）です。物理dt自体は変更しません。 */
	readonly sampleIntervalSeconds: number;

	/** 記録済みの独立した軌道点です。 */
	private readonly recordedPoints: TrajectoryPoint[] = [];

	/** 記録開始後に実際の物理ステップで進んだ時間（s）です。 */
	private elapsedSeconds: number = 0;

	/** 次にsampleする経過時間（s）です。 */
	private nextSampleSeconds: number;

	/** 正のsample間隔を持つ記録器を生成します。 */
	constructor(sampleIntervalSeconds: number) {
		if (sampleIntervalSeconds <= 0) {
			throw new Error("軌跡のsample間隔は0より大きい必要があります。");
		}
		this.sampleIntervalSeconds = sampleIntervalSeconds;
		this.nextSampleSeconds = sampleIntervalSeconds;
	}

	/** 現在位置を時刻0として記録し、既存軌跡を初期化します。 */
	start(body: Planet): void {
		this.recordedPoints.splice(0, this.recordedPoints.length);
		this.elapsedSeconds = 0;
		this.nextSampleSeconds = this.sampleIntervalSeconds;
		this.recordedPoints.push(new TrajectoryPoint(body.pos.x, body.pos.y, 0));
	}

	/** 実際に完了した1物理ステップ分だけ時刻を進め、sample境界なら位置を追加します。 */
	recordStep(body: Planet, physicsStepSeconds: number): boolean {
		if (physicsStepSeconds <= 0) {
			return false;
		}
		this.elapsedSeconds += physicsStepSeconds;
		if (this.elapsedSeconds < this.nextSampleSeconds) {
			return false;
		}
		this.recordedPoints.push(new TrajectoryPoint(body.pos.x, body.pos.y, this.elapsedSeconds));
		this.nextSampleSeconds += this.sampleIntervalSeconds;
		return true;
	}

	/** 呼び出し側から配列を変更できないよう、記録点の浅いコピーを返します。 */
	getPoints(): TrajectoryPoint[] {
		return this.recordedPoints.slice();
	}
}

/** clone世界を本番と同じ積分器種別・固定dtで進め、副作用なく予測軌道を生成します。 */
export class TrajectoryPredictor {
	/** 本番と一致させる積分器種別です。 */
	readonly integratorKind: PhysicsIntegratorKind;

	/** 予測でも変更せず使用する物理固定dt（s）です。 */
	readonly physicsStepSeconds: number;

	/** 予測するゲーム内期間（s）です。 */
	readonly predictionDurationSeconds: number;

	/** 描画用の予測点だけを保存するsample間隔（s）です。 */
	readonly sampleIntervalSeconds: number;

	/** 本番と一致する物理条件を保持する予測器を生成します。 */
	constructor(
		integratorKind: PhysicsIntegratorKind,
		physicsStepSeconds: number,
		predictionDurationSeconds: number,
		sampleIntervalSeconds: number
	) {
		if (predictionDurationSeconds <= 0 || predictionDurationSeconds % physicsStepSeconds !== 0) {
			throw new Error("予測期間は正で、物理固定dtの整数倍である必要があります。");
		}
		if (sampleIntervalSeconds < physicsStepSeconds || sampleIntervalSeconds % physicsStepSeconds !== 0) {
			throw new Error("予測sample間隔は物理固定dt以上の整数倍である必要があります。");
		}
		this.integratorKind = integratorKind;
		this.physicsStepSeconds = physicsStepSeconds;
		this.predictionDurationSeconds = predictionDurationSeconds;
		this.sampleIntervalSeconds = sampleIntervalSeconds;
	}

	/**
	 * 本番世界をdeep cloneし、指定天体のcloneだけへ仮速度を設定して将来位置を返します。
	 * originalWorld、activeBody、launchVelocityには一切変更を加えません。
	 */
	predict(originalWorld: PhysicsWorld, activeBody: Planet, launchVelocity: Velocity): TrajectoryPoint[] {
		const clonedWorld: PhysicsWorldClone = originalWorld.cloneWithMapping();
		const clonedActiveBody: Planet = clonedWorld.getClonedBody(activeBody);
		clonedActiveBody.velocity.x = launchVelocity.x;
		clonedActiveBody.velocity.y = launchVelocity.y;

		const recorder: TrajectoryRecorder = new TrajectoryRecorder(this.sampleIntervalSeconds);
		recorder.start(clonedActiveBody);
		const runner: SimulationRunner = new SimulationRunner(
			clonedWorld.world,
			createPhysicsIntegrator(this.integratorKind),
			this.physicsStepSeconds
		);
		runner.advance(
			this.predictionDurationSeconds,
			(_world: PhysicsWorld, stepSeconds: number): void => {
				recorder.recordStep(clonedActiveBody, stepSeconds);
			}
		);
		return recorder.getPoints();
	}
}
