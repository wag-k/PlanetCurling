import {GameBalance} from "./game_balance";
import {Acceleration, Pos, Velocity} from "./motion";
import {Planet} from "./planet";
import {Setting} from "./setting";
import {SimulationRunner} from "./simulation_runner";

/** ローカル対戦を行うプレイヤーです。物理モデルへ所有者情報を混在させないため独立させます。 */
export enum Player {
	Red = "Red",
	Blue = "Blue"
}

/** 照準・物理進行・ターン切替・終了を明確に分ける試合状態です。 */
export enum MatchState {
	Aiming = "Aiming",
	Simulating = "Simulating",
	TurnTransition = "TurnTransition",
	MatchFinished = "MatchFinished"
}

/**
 * ゲーム上の投球駒と純粋な物理天体を関連付けます。
 * 所有者や投球番号をPlanetへ追加せず、物理層をゲームルールから分離します。
 */
export class CurlingStone {
	/** この駒を投げるプレイヤーです。 */
	readonly owner: Player;

	/** 所有プレイヤーにとって何投目かを表す1始まりの番号です。 */
	readonly shotNumber: number;

	/** Newton重力と積分器が扱う純粋な物理天体です。 */
	readonly body: Planet;

	/** ゲーム上のメタデータと物理天体の関連を生成します。 */
	constructor(owner: Player, shotNumber: number, body: Planet) {
		this.owner = owner;
		this.shotNumber = shotNumber;
		this.body = body;
	}
}

/**
 * Red/Blueのターン、activeStone、投球後タイマーを管理するAkashic非依存のゲーム進行層です。
 * 物理計算はSimulationRunnerへ委譲し、Planet配列のindexへゲーム上の意味を持たせません。
 */
export class MatchController {
	/** 物理世界を6時間固定dtで進める既存実行器です。 */
	readonly simulationRunner: SimulationRunner;

	/** 生成済みの投球駒です。過去の駒も重力源として保持します。 */
	readonly stones: CurlingStone[] = [];

	/** 現在の試合状態です。 */
	private currentState: MatchState = MatchState.Aiming;

	/** 照準から投球後シミュレーション完了までを担当する現在プレイヤーです。 */
	private currentTurnPlayer: Player = Player.Red;

	/** 現在ターンだけが入力対象であることを明示する駒です。 */
	private currentActiveStone: CurlingStone | undefined;

	/** 固定物体化せずPhysicsWorldへ登録する中央天体です。 */
	private currentCentralBody: Planet;

	/** Redがリリース済みの投球数です。 */
	private redCompletedShots: number = 0;

	/** Blueがリリース済みの投球数です。 */
	private blueCompletedShots: number = 0;

	/** 現在の投球で完了した固定物理ステップ相当のゲーム内時間（s）です。 */
	private shotSimulationElapsedSeconds: number = 0;

	/** 既存物理実行器へゲーム進行を接続し、Redの1投目を開始します。 */
	constructor(simulationRunner: SimulationRunner) {
		this.simulationRunner = simulationRunner;
		this.newGame();
	}

	/** 現在の状態を返します。 */
	get state(): MatchState {
		return this.currentState;
	}

	/** 現在操作可能な駒を返します。照準中以外は存在しません。 */
	get activeStone(): CurlingStone | undefined {
		return this.currentActiveStone;
	}

	/** 動的な通常天体として登録中の中央天体を返します。 */
	get centralBody(): Planet {
		return this.currentCentralBody;
	}

	/** 現在または次に投げるプレイヤーを返します。 */
	get currentPlayer(): Player {
		return this.currentTurnPlayer;
	}

	/** Redのリリース済み投球数を返します。 */
	get redShotCount(): number {
		return this.redCompletedShots;
	}

	/** Blueのリリース済み投球数を返します。 */
	get blueShotCount(): number {
		return this.blueCompletedShots;
	}

	/** 全プレイヤーのリリース済み投球数を返します。 */
	get totalCompletedShots(): number {
		return this.redCompletedShots + this.blueCompletedShots;
	}

	/** 1人あたりの最大投球数を返します。 */
	get shotsPerPlayer(): number {
		return Setting.ShotsPerPlayer;
	}

	/** 試合全体の最大投球数を返します。 */
	get maximumTotalShots(): number {
		return Setting.ShotsPerPlayer * 2;
	}

	/** 現在の投球で固定ステップにより進んだゲーム内時間（s）を返します。 */
	get currentShotSimulationElapsedSeconds(): number {
		return this.shotSimulationElapsedSeconds;
	}

	/** 表示用に、現在プレイヤーがこれから投げる番号を返します。 */
	getCurrentPlayerShotNumber(): number {
		if (this.currentState === MatchState.MatchFinished) {
			return Setting.ShotsPerPlayer;
		}
		return this.currentState === MatchState.Aiming
			? this.getCompletedShots(this.currentPlayer) + 1
			: this.getCompletedShots(this.currentPlayer);
	}

	/** 表示用に、現在進行中の総投球番号を1始まりで返します。 */
	getCurrentTotalShotNumber(): number {
		if (this.currentState === MatchState.MatchFinished) {
			return this.maximumTotalShots;
		}
		return this.currentState === MatchState.Aiming
			? this.totalCompletedShots + 1
			: this.totalCompletedShots;
	}

	/**
	 * activeStoneだけへドラッグ由来の速度を設定します。
	 * 過去の駒を再操作できないことをゲーム進行層で保証します。
	 */
	setActiveStoneVelocity(velocity: Velocity): boolean {
		if (this.currentState !== MatchState.Aiming || this.currentActiveStone === undefined) {
			return false;
		}
		this.currentActiveStone.body.velocity.x = velocity.x;
		this.currentActiveStone.body.velocity.y = velocity.y;
		return true;
	}

	/** activeStoneの投球を確定し、物理シミュレーション状態へ移ります。 */
	releaseActiveStone(): boolean {
		if (this.currentState !== MatchState.Aiming || this.currentActiveStone === undefined) {
			return false;
		}
		if (this.currentActiveStone.owner === Player.Red) {
			this.redCompletedShots += 1;
		} else {
			this.blueCompletedShots += 1;
		}
		this.currentActiveStone = undefined;
		this.shotSimulationElapsedSeconds = 0;
		this.simulationRunner.clearRemainingSimulationSeconds();
		this.currentState = MatchState.Simulating;
		return true;
	}

	/**
	 * 指定時間のうち5年の境界までだけを固定dtで進め、実際に進んだ時間（s）を返します。
	 * accumulator中の端数も差し引くため、最後の描画フレーム分を余計に進めません。
	 */
	advanceSimulation(simulationSeconds: number): number {
		if (this.currentState !== MatchState.Simulating) {
			return 0;
		}
		const remainingInputSeconds: number = Math.max(
			0,
			Setting.SimulationDurationPerShotSeconds
				- this.shotSimulationElapsedSeconds
				- this.simulationRunner.getRemainingSimulationSeconds()
		);
		const acceptedSeconds: number = Math.min(Math.max(0, simulationSeconds), remainingInputSeconds);
		const completedSteps: number = this.simulationRunner.advance(acceptedSeconds);
		const advancedSeconds: number = completedSteps * this.simulationRunner.physicsStepSeconds;
		this.shotSimulationElapsedSeconds += advancedSeconds;

		if (this.shotSimulationElapsedSeconds >= Setting.SimulationDurationPerShotSeconds) {
			this.shotSimulationElapsedSeconds = Setting.SimulationDurationPerShotSeconds;
			this.currentState = this.totalCompletedShots >= this.maximumTotalShots
				? MatchState.MatchFinished
				: MatchState.TurnTransition;
		}
		return advancedSeconds;
	}

	/** TurnTransitionを完了し、次プレイヤーの新しいPlanetを生成してAimingへ移ります。 */
	completeTurnTransition(): boolean {
		if (this.currentState !== MatchState.TurnTransition) {
			return false;
		}
		this.currentTurnPlayer = this.currentTurnPlayer === Player.Red ? Player.Blue : Player.Red;
		this.beginTurn();
		return true;
	}

	/** すべての投球駒と物理時間を破棄し、中央天体とRedの1投目を再生成します。 */
	newGame(): void {
		this.simulationRunner.world.clearBodies();
		this.simulationRunner.reset();
		this.stones.splice(0, this.stones.length);
		this.redCompletedShots = 0;
		this.blueCompletedShots = 0;
		this.currentTurnPlayer = Player.Red;
		this.shotSimulationElapsedSeconds = 0;
		this.currentCentralBody = this.createCentralBody();
		this.simulationRunner.world.addBody(this.currentCentralBody);
		this.beginTurn();
	}

	/** 指定プレイヤーのリリース済み投球数を返します。 */
	private getCompletedShots(player: Player): number {
		return player === Player.Red ? this.redCompletedShots : this.blueCompletedShots;
	}

	/** 現在プレイヤーの新しい駒を物理世界へ追加し、照準を開始します。 */
	private beginTurn(): void {
		const owner: Player = this.currentPlayer;
		const stone: CurlingStone = new CurlingStone(
			owner,
			this.getCompletedShots(owner) + 1,
			this.createStoneBody()
		);
		this.stones.push(stone);
		this.simulationRunner.world.addBody(stone.body);
		this.currentActiveStone = stone;
		this.currentState = MatchState.Aiming;
	}

	/** ゲーム設定から速度0の投球惑星を生成します。 */
	private createStoneBody(): Planet {
		return new Planet(
			GameBalance.StoneRadiusMetres,
			GameBalance.StoneMassKg,
			new Pos(GameBalance.ShotStartXMetres, GameBalance.ShotStartYMetres),
			new Velocity(0, 0),
			new Acceleration(0, 0)
		);
	}

	/** ゲーム設定から通常の動的Planetである中央天体を生成します。 */
	private createCentralBody(): Planet {
		return new Planet(
			GameBalance.CentralBodyRadiusMetres,
			GameBalance.CentralBodyMassKg,
			new Pos(GameBalance.CentralBodyStartXMetres, GameBalance.CentralBodyStartYMetres),
			new Velocity(0, 0),
			new Acceleration(0, 0)
		);
	}
}
