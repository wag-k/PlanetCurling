import {CollisionEvent, CollisionEventKind, CollisionSystem} from "./collision";
import {GameBalance} from "./game_balance";
import {Acceleration, Pos, Velocity} from "./motion";
import {OrbitScoreEvaluator} from "./orbit_score";
import {Planet} from "./planet";
import {Setting} from "./setting";
import {SimulationRunner} from "./simulation_runner";
import {TrajectoryPoint, TrajectoryRecorder} from "./trajectory";

/** ローカル対戦を行うプレイヤーです。物理モデルへ所有者情報を混在させないため独立させます。 */
export enum Player {
	Red = "Red",
	Blue = "Blue"
}

/** 照準・物理進行・Turn切替・End切替・終了を明確に分ける試合状態です。 */
export enum MatchState {
	Aiming = "Aiming",
	Simulating = "Simulating",
	TurnTransition = "TurnTransition",
	/** End得点を確定済みの盤面を表示し、次End開始操作を待つ状態です。 */
	EndTransition = "EndTransition",
	MatchFinished = "MatchFinished"
}

/** 全End合計得点による赤勝利・青勝利・引き分けを表します。 */
export enum MatchResult {
	RedWin = "RedWin",
	BlueWin = "BlueWin",
	Draw = "Draw"
}

/** 1つのEnd終了時に確定し、後続Endの物理から独立して残る純粋な成績です。 */
export class EndResult {
	/** 1始まりのEnd番号です。 */
	readonly endNumber: number;
	/** このEndの第1投を担当したプレイヤーです。 */
	readonly startingPlayer: Player;
	/** このEndの第6投を担当したプレイヤーです。 */
	readonly lastPlayer: Player;
	/** End終了時に固定したRed得点です。 */
	readonly redScore: number;
	/** End終了時に固定したBlue得点です。 */
	readonly blueScore: number;

	/** End単位の先後と確定得点を、PhysicsWorldを参照しない履歴として生成します。 */
	constructor(
		endNumber: number,
		startingPlayer: Player,
		lastPlayer: Player,
		redScore: number,
		blueScore: number
	) {
		this.endNumber = endNumber;
		this.startingPlayer = startingPlayer;
		this.lastPlayer = lastPlayer;
		this.redScore = redScore;
		this.blueScore = blueScore;
	}
}

/** 投球駒が物理世界へ参加中か、中央天体へ吸収済みかを表します。 */
export enum CurlingStoneState {
	/** 通常どおり物理世界へ参加している状態です。 */
	Active = "Active",
	/** 中央天体へ吸収され、物理世界から除外された状態です。 */
	Absorbed = "Absorbed"
}

/** HUDへ渡す未投球・得点・吸収済みの純粋な表示状態です。 */
export enum StoneScoreStatusKind {
	Unreleased = "Unreleased",
	Scored = "Scored",
	Absorbed = "Absorbed"
}

/** HUDが物理計算をせずStone状態を描ける読み取り値です。 */
export class StoneScoreStatus {
	/** 状態種別です。 */
	readonly kind: StoneScoreStatusKind;
	/** リリース済みかつ未吸収の場合の0～3点です。 */
	readonly points?: number;

	/** 表示状態を生成します。 */
	constructor(kind: StoneScoreStatusKind, points?: number) {
		this.kind = kind;
		this.points = points;
	}
}

/**
 * ゲーム上の投球駒と純粋な物理天体を関連付けます。
 * 所有者や投球番号をPlanetへ追加せず、物理層をゲームルールから分離します。
 */
export class CurlingStone {
	/** この駒を投げるプレイヤーです。 */
	readonly owner: Player;

	/** 所有プレイヤーにとって現在Endの何投目かを表す1始まりの番号です。 */
	readonly shotNumber: number;

	/** Newton重力と積分器が扱う純粋な物理天体です。 */
	readonly body: Planet;

	/** リリース済みならtrueになるゲーム進行上の状態です。 */
	private released: boolean = false;

	/** 現在の物理参加・吸収状態です。 */
	private currentState: CurlingStoneState = CurlingStoneState.Active;

	/** 投球確定時に保存する、その投球時点の予測軌道です。Planet物理モデルには保持しません。 */
	private savedPredictedTrajectory: TrajectoryPoint[] = [];

	/** 実際に物理時間が進んだときだけ位置をsampleする記録器です。 */
	private readonly actualTrajectoryRecorder: TrajectoryRecorder;

	/** ゲーム上のメタデータと物理天体の関連を生成します。 */
	constructor(
		owner: Player,
		shotNumber: number,
		body: Planet,
		trajectorySampleIntervalSeconds: number = Setting.TrajectorySampleIntervalSeconds
	) {
		this.owner = owner;
		this.shotNumber = shotNumber;
		this.body = body;
		this.actualTrajectoryRecorder = new TrajectoryRecorder(trajectorySampleIntervalSeconds);
	}

	/** この駒が照準を終えてリリース済みかを返します。 */
	get isReleased(): boolean {
		return this.released;
	}

	/** 中央天体へ吸収済みならtrueを返します。 */
	get isAbsorbed(): boolean {
		return this.currentState === CurlingStoneState.Absorbed;
	}

	/** 現在の物理参加・吸収状態を返します。 */
	get state(): CurlingStoneState {
		return this.currentState;
	}

	/** 照準中の最新予測、またはリリース時に確定保存した予測軌道を返します。 */
	get predictedTrajectory(): TrajectoryPoint[] {
		return this.savedPredictedTrajectory.slice();
	}

	/** リリース後に実際に通過したsample済み軌跡を返します。 */
	get actualTrajectory(): TrajectoryPoint[] {
		return this.actualTrajectoryRecorder.getPoints();
	}

	/** 照準中に表示する予測軌道をゲーム側メタデータへコピーして保存します。 */
	setPredictedTrajectory(points: TrajectoryPoint[]): void {
		if (this.released) {
			return;
		}
		this.savedPredictedTrajectory = points.slice();
	}

	/** この駒をリリース済みにします。 */
	markReleased(): void {
		this.released = true;
		this.actualTrajectoryRecorder.start(this.body);
	}

	/** 完了した物理ステップ分だけ実軌跡時刻を進め、sample境界なら現在位置を追加します。 */
	recordActualTrajectoryStep(physicsStepSeconds: number): boolean {
		return this.released && !this.isAbsorbed
			&& this.actualTrajectoryRecorder.recordStep(this.body, physicsStepSeconds);
	}

	/** 中央天体への吸収を確定し、接触位置を実軌跡の最終点として残します。 */
	markAbsorbed(): void {
		if (this.isAbsorbed) {
			return;
		}
		this.currentState = CurlingStoneState.Absorbed;
		if (this.released) {
			this.actualTrajectoryRecorder.recordFinal(this.body);
		}
	}

	/** 6時間step内部の衝突位置を、step開始からの秒時刻付きで実軌跡へ追加します。 */
	recordCollisionPoint(event: CollisionEvent): boolean {
		return this.released && this.actualTrajectoryRecorder.recordEventPoint(
			this.body, event.timeFromStepStartSeconds, event.position
		);
	}
}

/**
 * Red/Blueのターン、activeStone、投球後タイマーを管理するAkashic非依存のゲーム進行層です。
 * 物理計算はSimulationRunnerへ委譲し、Planet配列のindexへゲーム上の意味を持たせません。
 */
export class MatchController {
	/** 物理世界を6時間固定dtで進める既存実行器です。 */
	readonly simulationRunner: SimulationRunner;

	/** 現在Endで生成済みの投球駒です。同じEndの過去の駒も重力源として保持します。 */
	readonly stones: CurlingStone[] = [];

	/** リリース済み投球駒を現在の物理状態から採点する評価器です。 */
	readonly scoreEvaluator: OrbitScoreEvaluator;

	/** 現在の試合状態です。 */
	private currentState: MatchState = MatchState.Aiming;

	/** 照準から投球後シミュレーション完了までを担当する現在プレイヤーです。 */
	private currentTurnPlayer: Player = Player.Red;

	/** 現在ターンだけが入力対象であることを明示する駒です。 */
	private currentActiveStone: CurlingStone | undefined;

	/** 固定物体化せずPhysicsWorldへ登録する中央天体です。 */
	private currentCentralBody: Planet;

	/** 現在Endの1始まり番号です。Match全体の進行と盤面寿命を区切ります。 */
	private currentEndNumberValue: number = 1;

	/** 現在Endの第1投を担当するプレイヤーです。End 1はRed、End 2はBlueです。 */
	private currentEndStartingPlayerValue: Player = Player.Red;

	/** 現在End内でRedがリリース済みの投球数です。過去End分は含みません。 */
	private redCompletedShotsInCurrentEnd: number = 0;

	/** 現在End内でBlueがリリース済みの投球数です。過去End分は含みません。 */
	private blueCompletedShotsInCurrentEnd: number = 0;

	/** 終了済みEndの先後と得点を、現在PhysicsWorldから独立して保持します。 */
	private readonly completedEndResults: EndResult[] = [];

	/** 現在の投球で完了した固定物理ステップ相当のゲーム内時間（s）です。 */
	private shotSimulationElapsedSeconds: number = 0;

	/** 試合終了時に確定した勝敗です。終了前は存在しません。 */
	private confirmedResult: MatchResult | undefined;

	/** 描画層が次回取得するまで保持する衝突通知です。 */
	private readonly pendingCollisionEvents: CollisionEvent[] = [];

	/** 既存物理実行器へゲーム進行を接続し、Redの1投目を開始します。 */
	constructor(simulationRunner: SimulationRunner, scoreEvaluator: OrbitScoreEvaluator = new OrbitScoreEvaluator()) {
		this.simulationRunner = simulationRunner;
		this.scoreEvaluator = scoreEvaluator;
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

	/** 現在の1始まりEnd番号を返します。 */
	get currentEndNumber(): number {
		return this.currentEndNumberValue;
	}

	/** 現在Endの先手を返します。End内のcurrentPlayerとは別の固定値です。 */
	get currentEndStartingPlayer(): Player {
		return this.currentEndStartingPlayerValue;
	}

	/** 現在End内でRedがリリース済みの投球数を返します。 */
	get redCompletedShotsThisEnd(): number {
		return this.redCompletedShotsInCurrentEnd;
	}

	/** 現在End内でBlueがリリース済みの投球数を返します。 */
	get blueCompletedShotsThisEnd(): number {
		return this.blueCompletedShotsInCurrentEnd;
	}

	/** 現在End内で両プレイヤーが完了した投球数を返します。 */
	get completedShotsInCurrentEnd(): number {
		return this.redCompletedShotsInCurrentEnd + this.blueCompletedShotsInCurrentEnd;
	}

	/** 1人が1つのEndで投げる最大投球数を返します。 */
	get shotsPerPlayerPerEnd(): number {
		return Setting.ShotsPerPlayerPerEnd;
	}

	/** 1つのEndで両プレイヤーが投げる最大投球数を返します。 */
	get maximumShotsPerEnd(): number {
		return Setting.ShotsPerPlayerPerEnd * 2;
	}

	/** 1試合で行うEnd数を返します。 */
	get endsPerMatch(): number {
		return Setting.EndsPerMatch;
	}

	/** 終了済みEndの確定履歴を呼び出し側から変更できない配列で返します。 */
	get endResults(): EndResult[] {
		return this.completedEndResults.slice();
	}

	/** 現在の投球で固定ステップにより進んだゲーム内時間（s）を返します。 */
	get currentShotSimulationElapsedSeconds(): number {
		return this.shotSimulationElapsedSeconds;
	}

	/** 現在PhysicsWorldだけから再計算するRedの暫定End得点を返します。 */
	get currentEndRedScore(): number {
		return this.calculatePlayerScore(Player.Red);
	}

	/** 現在PhysicsWorldだけから再計算するBlueの暫定End得点を返します。 */
	get currentEndBlueScore(): number {
		return this.calculatePlayerScore(Player.Blue);
	}

	/** 終了済みEndResultだけを合計したRedのMatch Totalを返します。 */
	get totalRedScore(): number {
		return this.completedEndResults.reduce(
			(total: number, endResult: EndResult): number => total + endResult.redScore, 0
		);
	}

	/** 終了済みEndResultだけを合計したBlueのMatch Totalを返します。 */
	get totalBlueScore(): number {
		return this.completedEndResults.reduce(
			(total: number, endResult: EndResult): number => total + endResult.blueScore, 0
		);
	}

	/** 試合終了時に確定した勝敗を返します。終了前はundefinedです。 */
	get result(): MatchResult | undefined {
		return this.confirmedResult;
	}

	/** 0～10ゲーム年の現在値を0～1へclampしたHUD用simulation進捗です。 */
	get simulationProgress(): number {
		return Math.max(0, Math.min(1,
			this.shotSimulationElapsedSeconds / Setting.SimulationDurationPerShotSeconds
		));
	}

	/** 指定Stoneの未投球・0～3点・吸収状態をゲーム層で評価してHUDへ返します。 */
	getStoneScoreStatus(stone: CurlingStone): StoneScoreStatus {
		if (!stone.isReleased) {
			return new StoneScoreStatus(StoneScoreStatusKind.Unreleased);
		}
		if (stone.isAbsorbed) {
			return new StoneScoreStatus(StoneScoreStatusKind.Absorbed);
		}
		return new StoneScoreStatus(StoneScoreStatusKind.Scored,
			this.scoreEvaluator.evaluate(stone.body, this.centralBody).points);
	}

	/** 未取得の衝突通知を返し、内部キューを空にします。 */
	consumeCollisionEvents(): CollisionEvent[] {
		const events: CollisionEvent[] = this.pendingCollisionEvents.slice();
		this.pendingCollisionEvents.splice(0, this.pendingCollisionEvents.length);
		return events;
	}

	/** 表示用に、現在プレイヤーがこれから投げる番号を返します。 */
	getCurrentPlayerShotNumber(): number {
		if (this.currentState === MatchState.MatchFinished) {
			return Setting.ShotsPerPlayerPerEnd;
		}
		return this.currentState === MatchState.Aiming
			? this.getCompletedShots(this.currentPlayer) + 1
			: this.getCompletedShots(this.currentPlayer);
	}

	/** 表示用に、現在End内で進行中の総投球番号を1始まりで返します。 */
	getCurrentEndShotNumber(): number {
		if (this.currentState === MatchState.MatchFinished) {
			return this.maximumShotsPerEnd;
		}
		return this.currentState === MatchState.Aiming
			? this.completedShotsInCurrentEnd + 1
			: this.completedShotsInCurrentEnd;
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

	/** activeStoneだけへ照準中の予測軌道を保存し、リリース後の変更を防ぎます。 */
	setActiveStonePredictedTrajectory(points: TrajectoryPoint[]): boolean {
		if (this.currentState !== MatchState.Aiming || this.currentActiveStone === undefined) {
			return false;
		}
		this.currentActiveStone.setPredictedTrajectory(points);
		return true;
	}

	/** activeStoneの投球を確定し、物理シミュレーション状態へ移ります。 */
	releaseActiveStone(): boolean {
		if (this.currentState !== MatchState.Aiming || this.currentActiveStone === undefined) {
			return false;
		}
		this.currentActiveStone.markReleased();
		if (this.currentActiveStone.owner === Player.Red) {
			this.redCompletedShotsInCurrentEnd += 1;
		} else {
			this.blueCompletedShotsInCurrentEnd += 1;
		}
		this.currentActiveStone = undefined;
		this.shotSimulationElapsedSeconds = 0;
		this.simulationRunner.clearRemainingSimulationSeconds();
		this.currentState = MatchState.Simulating;
		return true;
	}

	/**
	 * 指定時間のうち10年の境界までだけを固定dtで進め、実際に進んだ時間（s）を返します。
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
		const completedSteps: number = this.simulationRunner.advance(
			acceptedSeconds,
			(_world, physicsStepSeconds: number, events: CollisionEvent[]): void => {
				this.processCollisionEvents(events);
				this.recordActualTrajectories(physicsStepSeconds);
			}
		);
		const advancedSeconds: number = completedSteps * this.simulationRunner.physicsStepSeconds;
		this.shotSimulationElapsedSeconds += advancedSeconds;

		if (this.shotSimulationElapsedSeconds >= Setting.SimulationDurationPerShotSeconds) {
			this.shotSimulationElapsedSeconds = Setting.SimulationDurationPerShotSeconds;
			if (this.completedShotsInCurrentEnd >= this.maximumShotsPerEnd) {
				this.confirmCurrentEndResult();
				if (this.currentEndNumber >= this.endsPerMatch) {
					this.confirmMatchResult();
					this.currentState = MatchState.MatchFinished;
				} else {
					this.currentState = MatchState.EndTransition;
				}
			} else {
				this.currentState = MatchState.TurnTransition;
			}
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

	/** EndTransitionを完了し、過去盤面を破棄して先手を交代した新しいEndを開始します。 */
	completeEndTransition(): boolean {
		if (this.currentState !== MatchState.EndTransition) {
			return false;
		}
		this.currentEndNumberValue += 1;
		this.currentEndStartingPlayerValue = this.getStartingPlayerForEnd(this.currentEndNumberValue);
		this.resetCurrentEndBoard();
		return true;
	}

	/** 全End履歴と盤面を破棄し、End 1・Red先手の新しい試合を開始します。 */
	newGame(): void {
		this.currentEndNumberValue = 1;
		this.currentEndStartingPlayerValue = Player.Red;
		this.completedEndResults.splice(0, this.completedEndResults.length);
		this.confirmedResult = undefined;
		this.resetCurrentEndBoard();
	}

	/** 現在EndのStone・軌跡・衝突参照・中央天体を破棄し、完全な初期盤面を生成します。 */
	private resetCurrentEndBoard(): void {
		this.simulationRunner.world.clearBodies();
		this.simulationRunner.reset();
		this.stones.splice(0, this.stones.length);
		this.redCompletedShotsInCurrentEnd = 0;
		this.blueCompletedShotsInCurrentEnd = 0;
		this.currentTurnPlayer = this.currentEndStartingPlayerValue;
		this.currentActiveStone = undefined;
		this.shotSimulationElapsedSeconds = 0;
		this.pendingCollisionEvents.splice(0, this.pendingCollisionEvents.length);
		this.currentCentralBody = this.createCentralBody();
		this.simulationRunner.world.addBody(this.currentCentralBody);
		this.simulationRunner.setCollisionSystem(new CollisionSystem(
			this.currentCentralBody,
			[],
			GameBalance.StoneCollisionRadiusMetres,
			GameBalance.CentralBodyCollisionRadiusMetres,
			GameBalance.StoneCollisionRestitution
		));
		this.beginTurn();
	}

	/** 指定プレイヤーのリリース済み投球数を返します。 */
	private getCompletedShots(player: Player): number {
		return player === Player.Red
			? this.redCompletedShotsInCurrentEnd
			: this.blueCompletedShotsInCurrentEnd;
	}

	/** 現在の中心天体に対して、指定プレイヤーのリリース済み投球だけを合計します。 */
	private calculatePlayerScore(player: Player): number {
		return this.stones.reduce((total: number, stone: CurlingStone): number => {
			if (stone.owner !== player || !stone.isReleased || stone.isAbsorbed) {
				return total;
			}
			return total + this.scoreEvaluator.evaluate(stone.body, this.centralBody).points;
		}, 0);
	}

	/** 現在リリース済みの全投球について、後続ターン中も実軌跡を継続して延長します。 */
	private recordActualTrajectories(physicsStepSeconds: number): void {
		this.stones.forEach((stone: CurlingStone): void => {
			stone.recordActualTrajectoryStep(physicsStepSeconds);
		});
	}

	/** 衝突通知をゲーム側状態へ反映し、描画用キューへ保存します。 */
	private processCollisionEvents(events: CollisionEvent[]): void {
		events.forEach((event: CollisionEvent): void => {
			this.stones.forEach((stone: CurlingStone): void => {
				if (stone.body === event.firstBody || stone.body === event.secondBody) {
					stone.recordCollisionPoint(event);
				}
			});
			if (event.kind === CollisionEventKind.StoneCentralBody) {
				const absorbedStone: CurlingStone | undefined = this.stones.filter(
					(stone: CurlingStone): boolean => stone.body === event.firstBody
				)[0];
				if (absorbedStone !== undefined) {
					absorbedStone.markAbsorbed();
				}
			}
			this.pendingCollisionEvents.push(event);
		});
	}

	/** 現在Endの6投終了時に盤面得点を固定し、物理から独立したEndResultへ追加します。 */
	private confirmCurrentEndResult(): void {
		this.completedEndResults.push(new EndResult(
			this.currentEndNumber,
			this.currentEndStartingPlayer,
			this.currentTurnPlayer,
			this.calculatePlayerScore(Player.Red),
			this.calculatePlayerScore(Player.Blue)
		));
	}

	/** 全End確定後のMatch TotalからRed勝利・Blue勝利・引き分けを決定します。 */
	private confirmMatchResult(): void {
		if (this.totalRedScore > this.totalBlueScore) {
			this.confirmedResult = MatchResult.RedWin;
		} else if (this.totalBlueScore > this.totalRedScore) {
			this.confirmedResult = MatchResult.BlueWin;
		} else {
			this.confirmedResult = MatchResult.Draw;
		}
	}

	/** 1始まりEnd番号に対応し、奇数EndはRed、偶数EndはBlueを先手として返します。 */
	private getStartingPlayerForEnd(endNumber: number): Player {
		return endNumber % 2 === 1 ? Player.Red : Player.Blue;
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
		const collisionSystem: CollisionSystem | undefined = this.simulationRunner.getCollisionSystem();
		if (collisionSystem !== undefined) {
			collisionSystem.addStone(stone.body);
		}
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
