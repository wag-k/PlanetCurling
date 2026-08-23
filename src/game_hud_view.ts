import {CpuTurnController, CpuTurnState} from "./cpu_turn_controller";
import {formatMatchResultForMode, TrajectoryVisibility} from "./game_presentation";
import {formatCpuDifficulty, GameMode, GameSessionConfig} from "./game_session";
import {
	CurlingStone, MatchController, MatchState, Player, StoneScoreStatus, StoneScoreStatusKind
} from "./match_controller";
import {calculateCurrentLayout, LayoutMode, LayoutRect, ResponsiveLayout} from "./responsive_layout";
import {Setting} from "./setting";

/** Akashic描画だけを担当し、得点・物理判定をMatchControllerへ委譲する右サイドHUDです。 */
export class GameHudView {
	/** HUD全体の最前面layerです。 */
	readonly entity: g.E;
	/** Rematch操作に利用する大型buttonです。 */
	readonly rematchButton: g.FilledRect;
	/** 結果画面から起動時Mode Selectionへ戻る大型buttonです。 */
	readonly changeModeButton: g.FilledRect;
	/** Prediction表示toggleに利用する大型buttonです。 */
	readonly predictionButton: g.FilledRect;
	/** Trails表示toggleに利用する大型buttonです。 */
	readonly trailsButton: g.FilledRect;
	/** 共通Rules Overlayを開く大型buttonです。 */
	readonly rulesButton: g.FilledRect;
	/** 試合状態の読み取り元です。 */
	private readonly controller: MatchController;
	/** 表示専用toggleです。 */
	private readonly visibility: TrajectoryVisibility;
	/** HUD表示とRematchで維持する対戦モード・CPU難易度です。 */
	private readonly sessionConfig: GameSessionConfig;
	/** Blue CPUのThinking進捗とPreview状態です。 */
	private readonly cpuTurnController: CpuTurnController;
	/** 1280×720内のHUD矩形・font・button寸法です。 */
	private readonly layout: ResponsiveLayout;
	/** 値が変わった時だけinvalidateするラベル群です。 */
	private readonly labels: {[key: string]: g.Label} = {};
	/** 盤面中央の結果overlay背景です。 */
	private readonly resultOverlay: g.FilledRect;
	/** ターン開始を短く示す盤面内overlayです。 */
	private readonly turnOverlay: g.Label;
	/** ターンoverlayの残りframeです。 */
	private turnOverlayFrames: number = 15;
	/** 最後にoverlayを表示したactiveStoneです。 */
	private lastActiveStone: CurlingStone | undefined;

	/** controllerの純粋状態を、盤面と分離した右HUDへ投影します。 */
	constructor(
		scene: g.Scene,
		font: g.Font,
		controller: MatchController,
		visibility: TrajectoryVisibility,
		layout: ResponsiveLayout,
		sessionConfig: GameSessionConfig,
		cpuTurnController: CpuTurnController
	) {
		this.controller = controller;
		this.visibility = visibility;
		this.layout = layout;
		this.sessionConfig = sessionConfig;
		this.cpuTurnController = cpuTurnController;
		this.entity = new g.E({scene: scene, width: layout.logicalWidth, height: layout.logicalHeight});
		scene.append(this.entity);
		this.entity.append(new g.FilledRect({
			scene: scene,
			cssColor: "#081522",
			opacity: 0.94,
			x: layout.hudRect.x,
			y: layout.hudRect.y,
			width: layout.hudRect.width,
			height: layout.hudRect.height
		}));
		this.addLabel(scene, font, "redScore", layout.scoreFontSize,
			layout.scoreRect.x, layout.scoreRect.y, "#ff6b6b");
		this.addLabel(scene, font, "blueScore", layout.scoreFontSize,
			layout.scoreRect.x + layout.scoreRect.width / 2, layout.scoreRect.y, "#64b5f6");
		this.addLabel(scene, font, "turn", layout.turnFontSize,
			layout.turnRect.x, layout.turnRect.y, "white");
		this.addLabel(scene, font, "shot", layout.bodyFontSize,
			layout.turnRect.x, layout.turnRect.y + 42, "white");
		this.addLabel(scene, font, "progress", layout.bodyFontSize,
			layout.progressRect.x, layout.progressRect.y, "#b3e5fc");
		this.addLabel(scene, font, "progressBar", layout.bodyFontSize,
			layout.progressRect.x, layout.progressRect.y + 38, "#80cbc4");
		this.addLabel(scene, font, "redStones", layout.statusFontSize,
			layout.stoneStatusRect.x, layout.stoneStatusRect.y, "#ff8a80");
		this.addLabel(scene, font, "blueStones", layout.statusFontSize,
			layout.stoneStatusRect.x, layout.stoneStatusRect.y + 44, "#80d8ff");
		this.addLabel(scene, font, "help", 19,
			layout.stoneStatusRect.x, layout.stoneStatusRect.bottom - 18, "#cfd8dc");
		this.predictionButton = this.addButton(scene, font, layout.predictionButtonRect, "predictionToggle");
		this.trailsButton = this.addButton(scene, font, layout.trailsButtonRect, "trailsToggle");
		this.rulesButton = this.addButton(scene, font, layout.rulesButtonRect, "rules");
		this.resultOverlay = new g.FilledRect({
			scene: scene,
			parent: this.entity,
			cssColor: "#07111d",
			opacity: 0.94,
			x: layout.resultOverlayRect.x,
			y: layout.resultOverlayRect.y,
			width: layout.resultOverlayRect.width,
			height: layout.resultOverlayRect.height
		});
		this.addLabel(scene, font, "result", 42,
			layout.resultOverlayRect.x + 155, layout.resultOverlayRect.y + 42, "white");
		this.addLabel(scene, font, "finalScore", 30,
			layout.resultOverlayRect.x + 118, layout.resultOverlayRect.y + 118, "white");
		this.rematchButton = this.addButton(scene, font, layout.rematchButtonRect, "rematch");
		this.changeModeButton = this.addButton(scene, font, layout.changeModeButtonRect, "changeMode");
		this.turnOverlay = new g.Label({
			scene: scene,
			parent: this.entity,
			font: font,
			text: "RED TURN",
			fontSize: 38,
			x: layout.turnOverlayRect.x,
			y: layout.turnOverlayRect.y,
			textColor: "#ffffff"
		});
		this.update();
	}

	/** 毎frame呼べますが、文字列が変化したlabelだけをinvalidateします。 */
	update(): void {
		const player: string = this.controller.currentPlayer === Player.Red ? "RED" : "BLUE";
		this.setText("redScore", "RED  " + this.controller.redScore);
		this.setText("blueScore", "BLUE  " + this.controller.blueScore);
		this.setText("turn", this.sessionConfig.gameMode === GameMode.VsCpu
			&& this.controller.currentPlayer === Player.Blue ? "BLUE CPU" : player + " TURN");
		this.setText("shot", "Shot " + this.controller.getCurrentPlayerShotNumber() + " / " + this.controller.shotsPerPlayer
			+ "   Total " + this.controller.getCurrentTotalShotNumber() + " / " + this.controller.maximumTotalShots);
		const years: number = this.controller.currentShotSimulationElapsedSeconds / Setting.SecondsPerYear;
		let progressText: string;
		let progressRatio: number;
		if (this.cpuTurnController.state === CpuTurnState.Planning) {
			progressText = "CPU THINKING  " + this.cpuTurnController.evaluatedCandidateCount
				+ " / " + this.cpuTurnController.totalCandidateCount;
			progressRatio = this.cpuTurnController.planningProgress;
		} else if (this.cpuTurnController.state === CpuTurnState.Previewing) {
			progressText = "CPU READY";
			progressRatio = 1;
		} else if (this.controller.state === MatchState.Simulating) {
			progressText = "Year " + years.toFixed(1) + " / 10.0";
			progressRatio = this.controller.simulationProgress;
		} else {
			progressText = "Aim & Release";
			progressRatio = 0;
		}
		this.setText("progress", progressText);
		const filled: number = Math.round(progressRatio * 16);
		this.setText("progressBar", "[" + this.repeat("|", filled) + this.repeat(".", 16 - filled) + "]");
		this.setText("redStones", this.formatStones(Player.Red, "R"));
		this.setText("blueStones", this.formatStones(Player.Blue, "B"));
		this.setText("help", this.sessionConfig.gameMode === GameMode.VsCpu
			? "CPU: " + formatCpuDifficulty(this.sessionConfig.cpuDifficulty) + "   Orbit score"
			: "LOCAL 2P   Orbit score");
		this.setText("predictionToggle", "PRED " + (this.visibility.predictionVisible ? "ON" : "OFF"));
		this.setText("trailsToggle", "TRAIL " + (this.visibility.trailsVisible ? "ON" : "OFF"));
		this.setText("rules", "RULES");
		this.setText("rematch", "REMATCH");
		this.setText("changeMode", "CHANGE MODE");
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
			this.resultOverlay.show();
			this.rematchButton.show();
			this.labels.result.show();
			this.labels.finalScore.show();
			this.labels.rematch.show();
			this.changeModeButton.show();
			this.labels.changeMode.show();
			this.setText("result", formatMatchResultForMode(this.controller.result!, this.sessionConfig.gameMode));
			this.setText("finalScore", this.sessionConfig.gameMode === GameMode.VsCpu
				? "YOU " + this.controller.redScore + " - " + this.controller.blueScore + " CPU"
				: "RED " + this.controller.redScore + " - " + this.controller.blueScore + " BLUE");
		} else {
			this.resultOverlay.hide();
			this.rematchButton.hide();
			this.labels.result.hide();
			this.labels.finalScore.hide();
			this.labels.rematch.hide();
			this.changeModeButton.hide();
			this.labels.changeMode.hide();
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
		} else {
			this.turnOverlay.hide();
		}
	}

	/** ラベルを生成して名前で保持します。 */
	private addLabel(scene: g.Scene, font: g.Font, key: string, size: number, x: number, y: number, color: string): void {
		const label: g.Label = new g.Label({
			scene: scene,
			parent: this.entity,
			font: font,
			text: "",
			fontSize: size,
			x: x,
			y: y,
			textColor: color
		});
		this.labels[key] = label;
	}

	/** 指定矩形全体がtouchableな背景と対応ラベルを生成します。 */
	private addButton(scene: g.Scene, font: g.Font, rect: LayoutRect, labelKey: string): g.FilledRect {
		const button: g.FilledRect = new g.FilledRect({
			scene: scene,
			parent: this.entity,
			cssColor: "#26384d",
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height,
			touchable: true
		});
		this.addLabel(scene, font, labelKey, this.layout.buttonFontSize,
			rect.x + 14, rect.y + (rect.height - this.layout.buttonFontSize) / 2, "white");
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

/** Device orientationを監視し、phone portraitでは入力を覆い、tablet portraitでは案内だけ表示します。 */
export class OrientationNoticeView {
	/** Smartphone portraitで全入力を受け止める背景です。 */
	private readonly blockingOverlay: g.FilledRect;
	/** Smartphone portrait向けの主案内です。 */
	private readonly blockingTitle: g.Label;
	/** Smartphone portrait向けの補助案内です。 */
	private readonly blockingSubtitle: g.Label;
	/** Tablet portraitで操作を残したまま表示するbannerです。 */
	private readonly tabletBanner: g.FilledRect;
	/** Tablet portrait向けの案内文です。 */
	private readonly tabletLabel: g.Label;

	/** 論理解像度上にorientation案内を生成します。 */
	constructor(scene: g.Scene, font: g.Font, layout: ResponsiveLayout) {
		this.blockingOverlay = new g.FilledRect({
			scene: scene,
			cssColor: "#040b12",
			opacity: 0.96,
			x: 0,
			y: 0,
			width: layout.logicalWidth,
			height: layout.logicalHeight,
			touchable: true
		});
		this.blockingTitle = new g.Label({
			scene: scene,
			font: font,
			text: "Please rotate your device",
			fontSize: 42,
			x: 360,
			y: 285,
			textColor: "white"
		});
		this.blockingSubtitle = new g.Label({
			scene: scene,
			font: font,
			text: "Landscape mode recommended",
			fontSize: 28,
			x: 425,
			y: 345,
			textColor: "#b3e5fc"
		});
		this.tabletBanner = new g.FilledRect({
			scene: scene,
			cssColor: "#10283c",
			opacity: 0.92,
			x: layout.hudRect.x,
			y: layout.logicalHeight - 82,
			width: layout.hudRect.width,
			height: 82
		});
		this.tabletLabel = new g.Label({
			scene: scene,
			font: font,
			text: "Landscape recommended",
			fontSize: 23,
			x: layout.hudRect.x + 38,
			y: layout.logicalHeight - 54,
			textColor: "white"
		});
		scene.append(this.blockingOverlay);
		scene.append(this.blockingTitle);
		scene.append(this.blockingSubtitle);
		scene.append(this.tabletBanner);
		scene.append(this.tabletLabel);
		this.update();
	}

	/** 現在のbrowser viewportを読み、向き変更に応じて案内を表示・非表示にします。 */
	update(): void {
		const layout: ResponsiveLayout = calculateCurrentLayout(g.game.width, g.game.height);
		const portrait: boolean = layout.mode === LayoutMode.Portrait;
		if (portrait && layout.shouldBlockForPortrait) {
			this.blockingOverlay.show();
			this.blockingTitle.show();
			this.blockingSubtitle.show();
		} else {
			this.blockingOverlay.hide();
			this.blockingTitle.hide();
			this.blockingSubtitle.hide();
		}
		if (portrait && !layout.shouldBlockForPortrait) {
			this.tabletBanner.show();
			this.tabletLabel.show();
		} else {
			this.tabletBanner.hide();
			this.tabletLabel.hide();
		}
	}
}
