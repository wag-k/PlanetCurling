import {CpuCandidateGenerator, CpuShotCandidate} from "./cpu_candidate";
import {CpuSettings} from "./cpu_settings";
import {CpuCandidateResult, CpuShotSimulator, CpuSimulationContext} from "./cpu_simulation";
import {CpuDifficulty} from "./game_session";

/** CpuTurnControllerが実装詳細へ依存せずincremental探索を進める契約です。 */
export interface ICpuPlanningSession {
	/** 評価済みcandidate数です。 */
	readonly evaluatedCandidateCount: number;
	/** globalとrefinementを合わせた予定candidate数です。 */
	readonly totalCandidateCount: number;
	/** すべてのcandidate評価が完了した場合はtrueです。 */
	readonly isComplete: boolean;
	/** 現在までで最良の候補です。未評価ならundefinedです。 */
	readonly bestResult: CpuCandidateResult | undefined;
	/** 指定数以下だけ候補を評価し、呼び出し元frameへ制御を戻します。 */
	step(maxEvaluations: number): number;
}

/** 現在盤面と難易度からplanning sessionを開始する契約です。 */
export interface ICpuShotPlanner {
	/** Aiming開始時点の情報だけを使う1-ply sessionを生成します。 */
	startPlanning(context: CpuSimulationContext, difficulty: CpuDifficulty): ICpuPlanningSession;
}

/** global探索後にbest周辺だけをrefineする、決定論的な段階実行sessionです。 */
export class CpuPlanningSession implements ICpuPlanningSession {
	/** 評価対象となる現在Aiming盤面です。 */
	private readonly context: CpuSimulationContext;
	/** globalと局所候補を同じ規則で生成するgeneratorです。 */
	private readonly generator: CpuCandidateGenerator;
	/** 軌跡を保存せずclone最終盤面だけを返すsimulatorです。 */
	private readonly simulator: CpuShotSimulator;
	/** 候補密度を決める難易度です。 */
	private readonly difficulty: CpuDifficulty;
	/** 生成済みの決定的candidate列です。 */
	private readonly candidates: CpuShotCandidate[];
	/** 次に評価するcandidate indexです。 */
	private nextCandidateIndex: number = 0;
	/** global best周辺を一度だけ追加済みならtrueです。 */
	private refinementGenerated: boolean = false;
	/** これまでの明確なtie-break込み最良結果です。 */
	private currentBestResult: CpuCandidateResult | undefined;
	/** 全候補を評価し終えた場合はtrueです。 */
	private completed: boolean = false;

	/** 現在盤面を変更しないincremental 1-ply探索を準備します。 */
	constructor(
		context: CpuSimulationContext,
		difficulty: CpuDifficulty,
		generator: CpuCandidateGenerator,
		simulator: CpuShotSimulator
	) {
		this.context = context;
		this.difficulty = difficulty;
		this.generator = generator;
		this.simulator = simulator;
		this.candidates = generator.generateGlobalCandidates(difficulty);
	}

	/** 評価済みcandidate数を返します。 */
	get evaluatedCandidateCount(): number {
		return this.nextCandidateIndex;
	}

	/** global候補と重複中心を除く予定refinement候補の合計を返します。 */
	get totalCandidateCount(): number {
		const config = CpuSettings.getCandidateConfig(this.difficulty);
		return config.globalCandidateCount + config.refinementCandidateCount;
	}

	/** 全candidate評価が完了した場合はtrueを返します。 */
	get isComplete(): boolean {
		return this.completed;
	}

	/** 現在までの最良結果を返します。 */
	get bestResult(): CpuCandidateResult | undefined {
		return this.currentBestResult;
	}

	/** 指定候補数だけ同期評価し、残りを次frameへ持ち越します。 */
	step(maxEvaluations: number): number {
		if (maxEvaluations <= 0 || this.completed) return 0;
		let evaluatedThisStep: number = 0;
		while (evaluatedThisStep < maxEvaluations) {
			if (this.nextCandidateIndex >= this.candidates.length) {
				if (!this.refinementGenerated) {
					this.generateRefinement();
					continue;
				}
				this.completed = true;
				break;
			}
			const result: CpuCandidateResult = this.simulator.simulate(
				this.context, this.candidates[this.nextCandidateIndex]
			);
			this.nextCandidateIndex += 1;
			evaluatedThisStep += 1;
			if (this.currentBestResult === undefined || this.compare(result, this.currentBestResult) < 0) {
				this.currentBestResult = result;
			}
		}
		if (this.nextCandidateIndex >= this.candidates.length && !this.refinementGenerated) {
			this.generateRefinement();
		}
		if (this.nextCandidateIndex >= this.candidates.length && this.refinementGenerated) {
			this.completed = true;
		}
		return evaluatedThisStep;
	}

	/** global bestを中心とする局所gridを一度だけ末尾へ追加します。 */
	private generateRefinement(): void {
		this.refinementGenerated = true;
		if (this.currentBestResult === undefined) return;
		const refinement: CpuShotCandidate[] = this.generator.generateRefinementCandidates(
			this.difficulty,
			this.currentBestResult.candidate,
			this.candidates
		);
		this.candidates.push(...refinement);
	}

	/** utility同値時も完全に決定的な優先順位でfirstが良ければ負数を返します。 */
	private compare(first: CpuCandidateResult, second: CpuCandidateResult): number {
		const epsilon: number = 1e-9;
		if (Math.abs(first.utility - second.utility) > epsilon) return second.utility - first.utility;
		if (first.metrics.activeStonePoints !== second.metrics.activeStonePoints) {
			return second.metrics.activeStonePoints - first.metrics.activeStonePoints;
		}
		if (first.metrics.cpuScore !== second.metrics.cpuScore) {
			return second.metrics.cpuScore - first.metrics.cpuScore;
		}
		if (first.metrics.humanScore !== second.metrics.humanScore) {
			return first.metrics.humanScore - second.metrics.humanScore;
		}
		if (Math.abs(first.candidate.speedMetresPerSecond - second.candidate.speedMetresPerSecond) > epsilon) {
			return first.candidate.speedMetresPerSecond - second.candidate.speedMetresPerSecond;
		}
		return first.candidate.angleRadians - second.candidate.angleRadians;
	}
}

/** 候補generatorとexact simulatorを組み合わせ、難易度別sessionを生成します。 */
export class CpuShotPlanner implements ICpuShotPlanner {
	/** virtual drag探索空間の生成器です。 */
	readonly candidateGenerator: CpuCandidateGenerator;
	/** clone世界で本番物理を進めるsimulatorです。 */
	readonly simulator: CpuShotSimulator;

	/** 人間と同じ画面幅・世界幅の速度変換を使うplannerを生成します。 */
	constructor(
		worldWidthMetres: number,
		viewportWidthPixels: number,
		simulator: CpuShotSimulator = new CpuShotSimulator()
	) {
		this.candidateGenerator = new CpuCandidateGenerator(worldWidthMetres, viewportWidthPixels);
		this.simulator = simulator;
	}

	/** 現在Aiming盤面だけを入力に、決定論的な1-ply sessionを開始します。 */
	startPlanning(context: CpuSimulationContext, difficulty: CpuDifficulty): ICpuPlanningSession {
		return new CpuPlanningSession(context, difficulty, this.candidateGenerator, this.simulator);
	}
}
