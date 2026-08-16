import {formatMatchResult, TrajectoryVisibility} from "./game_presentation";
import {
	CurlingStone, MatchController, MatchState, Player, StoneScoreStatus, StoneScoreStatusKind
} from "./match_controller";
import {Setting} from "./setting";

/** Akashic描画だけを担当し、得点・物理判定をMatchControllerへ委譲するG5 HUDです。 */
export class GameHudView {
	/** HUD全体の最前面layerです。 */
	readonly entity: g.E;
	/** Rematch操作に利用するbuttonです。 */
	readonly rematchButton: g.FilledRect;
	/** 表示toggle操作に利用するbuttonです。 */
	readonly predictionButton: g.FilledRect;
	/** 表示toggle操作に利用するbuttonです。 */
	readonly trailsButton: g.FilledRect;
	/** 試合状態の読み取り元です。 */
	private readonly controller: MatchController;
	/** 表示専用toggleです。 */
	private readonly visibility: TrajectoryVisibility;
	/** 値が変わった時だけinvalidateするラベル群です。 */
	private readonly labels: {[key: string]: g.Label} = {};
	/** 結果overlay背景です。 */
	private readonly resultOverlay: g.FilledRect;
	/** ターン開始を短く示すoverlayです。 */
	private readonly turnOverlay: g.Label;
	/** ターンoverlayの残りframeです。 */
	private turnOverlayFrames: number = 15;
	/** 最後にoverlayを表示したactiveStoneです。 */
	private lastActiveStone: CurlingStone | undefined;

	/** controllerの純粋状態を英語UIへ投影します。 */
	constructor(scene: g.Scene, font: g.Font, controller: MatchController, visibility: TrajectoryVisibility) {
		this.controller = controller;
		this.visibility = visibility;
		this.entity = new g.E({scene: scene, width: g.game.width, height: g.game.height});
		scene.append(this.entity);
		this.entity.append(new g.FilledRect({scene: scene, cssColor: "#081522", opacity: 0.82,
			x: 0, y: 0, width: g.game.width, height: 138}));
		this.addLabel(scene, font, "redScore", 24, 20, 10, "#ff6b6b");
		this.addLabel(scene, font, "blueScore", 24, g.game.width - 180, 10, "#64b5f6");
		this.addLabel(scene, font, "turn", 20, 20, 45, "white");
		this.addLabel(scene, font, "shot", 18, 20, 72, "white");
		this.addLabel(scene, font, "progress", 17, 300, 45, "#b3e5fc");
		this.addLabel(scene, font, "progressBar", 18, 300, 72, "#80cbc4");
		this.addLabel(scene, font, "redStones", 16, 20, 103, "#ff8a80");
		this.addLabel(scene, font, "blueStones", 16, 300, 103, "#80d8ff");
		this.addLabel(scene, font, "help", 15, 620, 103, "#cfd8dc");
		this.predictionButton = this.addButton(scene, font, 790, 18, 180, "predictionToggle");
		this.trailsButton = this.addButton(scene, font, 980, 18, 160, "trailsToggle");
		this.resultOverlay = new g.FilledRect({scene: scene, parent: this.entity, cssColor: "#07111d",
			opacity: 0.9, x: g.game.width / 2 - 250, y: 245, width: 500, height: 230});
		this.addLabel(scene, font, "result", 38, g.game.width / 2 - 150, 275, "white");
		this.addLabel(scene, font, "finalScore", 26, g.game.width / 2 - 140, 330, "white");
		this.rematchButton = this.addButton(scene, font, g.game.width / 2 - 90, 395, 180, "rematch");
		this.turnOverlay = new g.Label({scene: scene, parent: this.entity, font: font, text: "RED TURN",
			fontSize: 34, x: g.game.width / 2 - 95, y: 170, textColor: "#ffffff"});
		this.predictionButton.onPointDown.add((): void => this.visibility.togglePrediction());
		this.trailsButton.onPointDown.add((): void => this.visibility.toggleTrails());
		this.update();
	}

	/** 毎frame呼べますが、文字列が変化したlabelだけをinvalidateします。 */
	update(): void {
		const player: string = this.controller.currentPlayer === Player.Red ? "RED" : "BLUE";
		this.setText("redScore", "RED  " + this.controller.redScore);
		this.setText("blueScore", this.controller.blueScore + "  BLUE");
		this.setText("turn", "Turn: " + player);
		this.setText("shot", "Shot " + this.controller.getCurrentPlayerShotNumber() + " / " + this.controller.shotsPerPlayer
			+ "   Total " + this.controller.getCurrentTotalShotNumber() + " / " + this.controller.maximumTotalShots);
		const years: number = this.controller.currentShotSimulationElapsedSeconds / Setting.SecondsPerYear;
		this.setText("progress", this.controller.state === MatchState.Simulating
			? "Simulation  Year " + years.toFixed(1) + " / 10.0" : "Aim & Release");
		const filled: number = Math.round(this.controller.simulationProgress * 20);
		this.setText("progressBar", "[" + this.repeat("|", filled) + this.repeat(".", 20 - filled) + "]");
		this.setText("redStones", "RED   " + this.formatStones(Player.Red, "R"));
		this.setText("blueStones", "BLUE  " + this.formatStones(Player.Blue, "B"));
		this.setText("help", "Orbit score = position + radial speed");
		this.setText("predictionToggle", "Prediction: " + (this.visibility.predictionVisible ? "ON" : "OFF"));
		this.setText("trailsToggle", "Trails: " + (this.visibility.trailsVisible ? "ON" : "OFF"));
		this.updateResultOverlay();
		this.updateTurnOverlay(player);
	}

	/** 指定playerの3 Stoneを `R1 3 / R2 ABS / R3 -` 形式へ変換します。 */
	private formatStones(player: Player, prefix: string): string {
		const values: string[] = [];
		for (let shot: number = 1; shot <= this.controller.shotsPerPlayer; shot += 1) {
			const stone: CurlingStone | undefined = this.controller.stones.filter(
				(value: CurlingStone): boolean => value.owner === player && value.shotNumber === shot
			)[0];
			const status: string = stone === undefined ? "-" : this.formatStatus(this.controller.getStoneScoreStatus(stone));
			values.push(prefix + shot + " " + status);
		}
		return values.join("   ");
	}

	/** ゲーム層の状態値をHUDの短い文言へ変換します。 */
	private formatStatus(status: StoneScoreStatus): string {
		if (status.kind === StoneScoreStatusKind.Unreleased) return "-";
		if (status.kind === StoneScoreStatusKind.Absorbed) return "ABS";
		return String(status.points);
	}

	/** MatchFinished時だけ盤面を残した中央結果overlayとRematchを表示します。 */
	private updateResultOverlay(): void {
		const visible: boolean = this.controller.state === MatchState.MatchFinished && this.controller.result !== undefined;
		if (visible) {
			this.resultOverlay.show(); this.rematchButton.show();
			this.labels.result.show(); this.labels.finalScore.show(); this.labels.rematch.show();
			this.setText("result", formatMatchResult(this.controller.result!));
			this.setText("finalScore", "RED " + this.controller.redScore + " - " + this.controller.blueScore + " BLUE");
		} else {
			this.resultOverlay.hide(); this.rematchButton.hide();
			this.labels.result.hide(); this.labels.finalScore.hide(); this.labels.rematch.hide();
		}
	}

	/** 新しいAiming Stoneへ切り替わった時だけ約0.5秒のturn overlayを開始します。 */
	private updateTurnOverlay(player: string): void {
		if (this.controller.activeStone !== undefined && this.controller.activeStone !== this.lastActiveStone) {
			this.lastActiveStone = this.controller.activeStone;
			this.turnOverlayFrames = 15;
			this.turnOverlay.text = player + " TURN";
			this.turnOverlay.invalidate();
		}
		if (this.turnOverlayFrames > 0) {
			this.turnOverlay.show();
			this.turnOverlay.opacity = this.turnOverlayFrames / 15;
			this.turnOverlay.modified();
			this.turnOverlayFrames -= 1;
		} else this.turnOverlay.hide();
	}

	/** ラベルを生成して名前で保持します。 */
	private addLabel(scene: g.Scene, font: g.Font, key: string, size: number, x: number, y: number, color: string): void {
		const label: g.Label = new g.Label({scene: scene, parent: this.entity, font: font, text: "", fontSize: size,
			x: x, y: y, textColor: color});
		this.labels[key] = label;
	}

	/** touchable背景と対応ラベルを生成します。 */
	private addButton(scene: g.Scene, font: g.Font, x: number, y: number, width: number, labelKey: string): g.FilledRect {
		const button: g.FilledRect = new g.FilledRect({scene: scene, parent: this.entity, cssColor: "#26384d",
			x: x, y: y, width: width, height: 40, touchable: true});
		this.addLabel(scene, font, labelKey, 16, x + 10, y + 10, "white");
		return button;
	}

	/** 値が変わった場合だけLabelを更新します。 */
	private setText(key: string, text: string): void {
		if (this.labels[key].text === text) return;
		this.labels[key].text = text;
		this.labels[key].invalidate();
	}

	/** ES2015互換でprogress bar文字を反復します。 */
	private repeat(value: string, count: number): string {
		let result: string = "";
		for (let index: number = 0; index < count; index += 1) result += value;
		return result;
	}
}
