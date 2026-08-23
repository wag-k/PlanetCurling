import {CollisionSystem} from "./collision";
import {CpuShotCandidate} from "./cpu_candidate";
import {CpuSettings, CpuUtilityWeights} from "./cpu_settings";
import {CurlingStone, MatchController, Player} from "./match_controller";
import {OrbitEvaluation, OrbitScoreEvaluator} from "./orbit_score";
import {createPhysicsIntegrator, PhysicsIntegratorKind} from "./physics_integrator";
import {PhysicsWorld, PhysicsWorldClone} from "./physics_world";
import {Planet} from "./planet";
import {Setting} from "./setting";
import {SimulationRunner} from "./simulation_runner";

/** CPUがAiming開始時点で参照できるStone所有者・投球状態の不変snapshotです。 */
export class CpuStoneSnapshot {
	/** clone対応に使う現在盤面の物理天体です。 */
	readonly sourceBody: Planet;
	/** Red HumanまたはBlue CPUの所有者です。 */
	readonly owner: Player;
	/** 所有者内の1始まり投球番号です。 */
	readonly shotNumber: number;
	/** 現在盤面でリリース済みならtrueです。 */
	readonly isReleased: boolean;
	/** 現在盤面ですでに中央天体へ吸収済みならtrueです。 */
	readonly isAbsorbed: boolean;

	/** 物理層へ所有者を混在させず、探索に必要な現在情報だけを保存します。 */
	constructor(stone: CurlingStone) {
		this.sourceBody = stone.body;
		this.owner = stone.owner;
		this.shotNumber = stone.shotNumber;
		this.isReleased = stone.isReleased;
		this.isAbsorbed = stone.isAbsorbed;
	}
}

/** 1-ply探索に必要な現在盤面と本番物理条件だけを保持します。 */
export class CpuSimulationContext {
	/** 絶対に変更せずclone元としてだけ使う本番物理世界です。 */
	readonly originalWorld: PhysicsWorld;
	/** cloneForWorld()で複製する本番衝突系です。 */
	readonly collisionSystem: CollisionSystem | undefined;
	/** scoreと相対軌道品質の基準になる現在の中央天体です。 */
	readonly centralBody: Planet;
	/** 今回だけ仮速度を与えるBlue active Stoneです。 */
	readonly activeStoneBody: Planet;
	/** 現在Aiming時点の全Stoneメタデータです。 */
	readonly stones: CpuStoneSnapshot[];
	/** 本番と同じ積分器種別です。 */
	readonly integratorKind: PhysicsIntegratorKind;
	/** 本番と同じ固定base dt（s）です。 */
	readonly physicsStepSeconds: number;
	/** 候補を進める本番同等期間（s）です。 */
	readonly simulationDurationSeconds: number;
	/** candidate終了盤面を本番と同じ境界で採点する評価器です。 */
	readonly scoreEvaluator: OrbitScoreEvaluator;

	/** MatchControllerのBlue Aiming盤面から、後続手を含まない1-ply入力を生成します。 */
	static fromMatchController(controller: MatchController): CpuSimulationContext {
		if (controller.activeStone === undefined || controller.activeStone.owner !== Player.Blue) {
			throw new Error("CPU planningはBlue active Stoneが存在するAiming盤面で開始してください。");
		}
		return new CpuSimulationContext(
			controller.simulationRunner.world,
			controller.simulationRunner.getCollisionSystem(),
			controller.centralBody,
			controller.activeStone.body,
			controller.stones.map((stone: CurlingStone): CpuStoneSnapshot => new CpuStoneSnapshot(stone)),
			controller.simulationRunner.getIntegrator().kind,
			controller.simulationRunner.physicsStepSeconds,
			Setting.SimulationDurationPerShotSeconds,
			controller.scoreEvaluator
		);
	}

	/** 副作用のない候補simulationへ必要な参照とSI設定を渡します。 */
	constructor(
		originalWorld: PhysicsWorld,
		collisionSystem: CollisionSystem | undefined,
		centralBody: Planet,
		activeStoneBody: Planet,
		stones: CpuStoneSnapshot[],
		integratorKind: PhysicsIntegratorKind,
		physicsStepSeconds: number,
		simulationDurationSeconds: number,
		scoreEvaluator: OrbitScoreEvaluator
	) {
		this.originalWorld = originalWorld;
		this.collisionSystem = collisionSystem;
		this.centralBody = centralBody;
		this.activeStoneBody = activeStoneBody;
		this.stones = stones.slice();
		this.integratorKind = integratorKind;
		this.physicsStepSeconds = physicsStepSeconds;
		this.simulationDurationSeconds = simulationDurationSeconds;
		this.scoreEvaluator = scoreEvaluator;
	}
}

/** 候補終了時の1 Stoneについて、parity診断可能な独立した物理値を保持します。 */
export class CpuFinalStoneState {
	/** 所有者です。 */
	readonly owner: Player;
	/** 所有者内の投球番号です。 */
	readonly shotNumber: number;
	/** 10年後もclone世界へ存在する場合はtrueです。 */
	readonly isPresent: boolean;
	/** 10年後のx座標（m）です。吸収時はundefinedです。 */
	readonly xMetres?: number;
	/** 10年後のy座標（m）です。吸収時はundefinedです。 */
	readonly yMetres?: number;
	/** 10年後のx速度（m/s）です。吸収時はundefinedです。 */
	readonly velocityXMetresPerSecond?: number;
	/** 10年後のy速度（m/s）です。吸収時はundefinedです。 */
	readonly velocityYMetresPerSecond?: number;
	/** 10年後の0～3点です。未投球・吸収は0です。 */
	readonly points: number;
	/** OnePoint境界を基準にした0～1の連続軌道品質です。 */
	readonly orbitQuality: number;

	/** clone終了状態からUI非依存の診断値を生成します。 */
	constructor(
		stone: CpuStoneSnapshot,
		body: Planet | undefined,
		points: number,
		orbitQuality: number
	) {
		this.owner = stone.owner;
		this.shotNumber = stone.shotNumber;
		this.isPresent = body !== undefined;
		this.xMetres = body === undefined ? undefined : body.pos.x;
		this.yMetres = body === undefined ? undefined : body.pos.y;
		this.velocityXMetresPerSecond = body === undefined ? undefined : body.velocity.x;
		this.velocityYMetresPerSecond = body === undefined ? undefined : body.velocity.y;
		this.points = points;
		this.orbitQuality = orbitQuality;
	}
}

/** 10年後の盤面全体をutilityへ変換する集計値です。 */
export class CpuBoardMetrics {
	/** Blue CPU全Stoneの最終得点です。 */
	readonly cpuScore: number;
	/** Red Human全Stoneの最終得点です。 */
	readonly humanScore: number;
	/** 今回投げるBlue Stoneの最終得点です。 */
	readonly activeStonePoints: number;
	/** Blue CPU全Stoneの連続軌道品質合計です。 */
	readonly cpuOrbitQuality: number;
	/** Red Human全Stoneの連続軌道品質合計です。 */
	readonly humanOrbitQuality: number;
	/** 今回の10年で新たに吸収されたHuman Stone数です。 */
	readonly newlyAbsorbedHumanCount: number;
	/** 今回の10年で新たに吸収された既存CPU Stone数です。 */
	readonly newlyAbsorbedCpuExistingCount: number;
	/** 今回のCPU active Stoneが吸収された場合は1、残存なら0です。 */
	readonly activeStoneAbsorbed: number;

	/** candidate終了盤面の得点・品質・吸収差を保持します。 */
	constructor(
		cpuScore: number,
		humanScore: number,
		activeStonePoints: number,
		cpuOrbitQuality: number,
		humanOrbitQuality: number,
		newlyAbsorbedHumanCount: number,
		newlyAbsorbedCpuExistingCount: number,
		activeStoneAbsorbed: number
	) {
		this.cpuScore = cpuScore;
		this.humanScore = humanScore;
		this.activeStonePoints = activeStonePoints;
		this.cpuOrbitQuality = cpuOrbitQuality;
		this.humanOrbitQuality = humanOrbitQuality;
		this.newlyAbsorbedHumanCount = newlyAbsorbedHumanCount;
		this.newlyAbsorbedCpuExistingCount = newlyAbsorbedCpuExistingCount;
		this.activeStoneAbsorbed = activeStoneAbsorbed;
	}
}

/** 得点差を最優先しつつ、軌道品質・攻撃・自己損失を補助評価する純粋関数です。 */
export class CpuBoardEvaluator {
	/** utility式に使うCPU専用weightです。 */
	readonly weights: CpuUtilityWeights;

	/** GameBalanceへ混在させないCPU評価weightを保持します。 */
	constructor(weights: CpuUtilityWeights = CpuSettings.UtilityWeights) {
		this.weights = weights;
	}

	/** 10年後の盤面全体metricsを大きいほど良いutilityへ変換します。 */
	evaluate(metrics: CpuBoardMetrics): number {
		return this.weights.scoreDifference * (metrics.cpuScore - metrics.humanScore)
			+ this.weights.orbitQualityDifference *
				(metrics.cpuOrbitQuality - metrics.humanOrbitQuality)
			+ this.weights.newlyAbsorbedHuman * metrics.newlyAbsorbedHumanCount
			- this.weights.newlyAbsorbedCpuExisting * metrics.newlyAbsorbedCpuExistingCount
			- this.weights.activeStoneAbsorbed * metrics.activeStoneAbsorbed;
	}
}

/** 1候補の10年後盤面、utility、parity診断値を保持します。 */
export class CpuCandidateResult {
	/** 評価したvirtual dragと初速度です。 */
	readonly candidate: CpuShotCandidate;
	/** 盤面全体から集計した得点・品質・吸収値です。 */
	readonly metrics: CpuBoardMetrics;
	/** 大きいほどCPUに有利な決定的評価値です。 */
	readonly utility: number;
	/** 候補simulation終了時の全Stone独立snapshotです。 */
	readonly finalStoneStates: CpuFinalStoneState[];

	/** 候補、評価、最終盤面を関連付けます。 */
	constructor(
		candidate: CpuShotCandidate,
		metrics: CpuBoardMetrics,
		utility: number,
		finalStoneStates: CpuFinalStoneState[]
	) {
		this.candidate = candidate;
		this.metrics = metrics;
		this.utility = utility;
		this.finalStoneStates = finalStoneStates.slice();
	}
}

/** Current PhysicsWorldをdeep cloneし、本番と同じ物理で1候補だけを10年進めます。 */
export class CpuShotSimulator {
	/** 盤面全体をutilityへ変換する副作用のない評価器です。 */
	readonly boardEvaluator: CpuBoardEvaluator;

	/** trajectory sampleを生成せず、最終状態だけを評価するsimulatorを生成します。 */
	constructor(boardEvaluator: CpuBoardEvaluator = new CpuBoardEvaluator()) {
		this.boardEvaluator = boardEvaluator;
	}

	/** originalを変更せず、cloneへ候補速度を設定して同じcollision solverで終了盤面を返します。 */
	simulate(context: CpuSimulationContext, candidate: CpuShotCandidate): CpuCandidateResult {
		const worldClone: PhysicsWorldClone = context.originalWorld.cloneWithMapping();
		const clonedActive: Planet = worldClone.getClonedBody(context.activeStoneBody);
		clonedActive.velocity.x = candidate.velocity.x;
		clonedActive.velocity.y = candidate.velocity.y;
		const runner: SimulationRunner = new SimulationRunner(
			worldClone.world,
			createPhysicsIntegrator(context.integratorKind),
			context.physicsStepSeconds
		);
		if (context.collisionSystem !== undefined) {
			runner.setCollisionSystem(context.collisionSystem.cloneForWorld(worldClone));
		}
		runner.advance(context.simulationDurationSeconds);
		return this.evaluateFinalWorld(context, candidate, worldClone);
	}

	/** clone終了盤面を全Stone得点・連続品質・新規吸収数へ集計します。 */
	private evaluateFinalWorld(
		context: CpuSimulationContext,
		candidate: CpuShotCandidate,
		worldClone: PhysicsWorldClone
	): CpuCandidateResult {
		const clonedCentral: Planet = worldClone.getClonedBody(context.centralBody);
		let cpuScore: number = 0;
		let humanScore: number = 0;
		let activeStonePoints: number = 0;
		let cpuOrbitQuality: number = 0;
		let humanOrbitQuality: number = 0;
		let newlyAbsorbedHumanCount: number = 0;
		let newlyAbsorbedCpuExistingCount: number = 0;
		let activeStoneAbsorbed: number = 0;
		const finalStates: CpuFinalStoneState[] = [];

		context.stones.forEach((stone: CpuStoneSnapshot): void => {
			const wasPresent: boolean = context.originalWorld.bodies.indexOf(stone.sourceBody) >= 0;
			const clonedBody: Planet | undefined = wasPresent
				? worldClone.getClonedBody(stone.sourceBody)
				: undefined;
			const finalBody: Planet | undefined = clonedBody !== undefined
				&& worldClone.world.bodies.indexOf(clonedBody) >= 0 ? clonedBody : undefined;
			const isCandidateStone: boolean = stone.sourceBody === context.activeStoneBody;
			const shouldScore: boolean = stone.isReleased || isCandidateStone;
			let points: number = 0;
			let quality: number = 0;
			if (finalBody !== undefined && shouldScore) {
				const evaluation: OrbitEvaluation = context.scoreEvaluator.evaluate(finalBody, clonedCentral);
				points = evaluation.points;
				quality = Math.max(0, Math.min(1,
					1 - evaluation.effectiveOrbitErrorMetres / context.scoreEvaluator.onePointErrorMetres));
			}
			if (stone.owner === Player.Blue) {
				cpuScore += points;
				cpuOrbitQuality += quality;
			} else {
				humanScore += points;
				humanOrbitQuality += quality;
			}
			if (isCandidateStone) activeStonePoints = points;
			if (wasPresent && finalBody === undefined) {
				if (isCandidateStone) activeStoneAbsorbed = 1;
				else if (stone.owner === Player.Blue) newlyAbsorbedCpuExistingCount += 1;
				else newlyAbsorbedHumanCount += 1;
			}
			finalStates.push(new CpuFinalStoneState(stone, finalBody, points, quality));
		});
		const metrics: CpuBoardMetrics = new CpuBoardMetrics(
			cpuScore,
			humanScore,
			activeStonePoints,
			cpuOrbitQuality,
			humanOrbitQuality,
			newlyAbsorbedHumanCount,
			newlyAbsorbedCpuExistingCount,
			activeStoneAbsorbed
		);
		return new CpuCandidateResult(candidate, metrics, this.boardEvaluator.evaluate(metrics), finalStates);
	}
}
