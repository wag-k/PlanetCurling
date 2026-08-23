import {CpuDifficulty, GameMode, GameSessionConfig} from "./game_session";
import {LayoutRect, ResponsiveLayout} from "./responsive_layout";

/** 起動時とChange Mode時に、対戦モードとCPU難易度を選択するoverlayです。 */
export class GameModeSelectionView {
	/** 画面全体の入力を受け止める最前面rootです。 */
	readonly entity: g.E;
	/** Vs CPU / 現在難易度で試合を開始するbuttonです。 */
	readonly vsCpuButton: g.FilledRect;
	/** Local 2Pで試合を開始するbuttonです。 */
	readonly localTwoPlayerButton: g.FilledRect;
	/** Easyを選ぶbuttonです。 */
	readonly easyButton: g.FilledRect;
	/** Normalを選ぶbuttonです。 */
	readonly normalButton: g.FilledRect;
	/** Hardを選ぶbuttonです。 */
	readonly hardButton: g.FilledRect;
	/** ゲーム開始前に共通Rules Overlayを開くbuttonです。 */
	readonly howToPlayButton: g.FilledRect;
	/** Rematchでも共有する選択設定です。 */
	private readonly sessionConfig: GameSessionConfig;
	/** 選択確定後にNew Gameを開始するcallbackです。 */
	private readonly onStart: () => void;
	/** 難易度選択表示を更新するlabelです。 */
	private readonly difficultyLabel: g.Label;
	/** 現在overlayが人間入力をblockしている場合はtrueです。 */
	private visible: boolean = true;

	/** ResponsiveLayoutの論理矩形上へ、簡潔なMode Selectionを生成します。 */
	constructor(
		scene: g.Scene,
		font: g.Font,
		layout: ResponsiveLayout,
		sessionConfig: GameSessionConfig,
		onStart: () => void
	) {
		this.sessionConfig = sessionConfig;
		this.onStart = onStart;
		this.entity = new g.E({scene: scene, width: layout.logicalWidth, height: layout.logicalHeight});
		scene.append(this.entity);
		this.entity.append(new g.FilledRect({
			scene: scene,
			cssColor: "#02070d",
			opacity: 0.9,
			x: 0,
			y: 0,
			width: layout.logicalWidth,
			height: layout.logicalHeight,
			touchable: true
		}));
		this.entity.append(new g.FilledRect({
			scene: scene,
			cssColor: "#0b2033",
			x: layout.modeSelectionOverlayRect.x,
			y: layout.modeSelectionOverlayRect.y,
			width: layout.modeSelectionOverlayRect.width,
			height: layout.modeSelectionOverlayRect.height
		}));
		this.addLabel(scene, font, "PLANET CURLING", 48, 421, 78, "#ffffff");
		this.addLabel(scene, font, "ONE PLAYER", 24, 559, 143, "#80d8ff");
		this.vsCpuButton = this.addButton(scene, font, layout.vsCpuButtonRect, "VS CPU", "#175d79");
		this.addLabel(scene, font, "DIFFICULTY", 24, 555, 292, "#b3e5fc");
		this.easyButton = this.addButton(scene, font, layout.easyDifficultyButtonRect, "EASY", "#26384d");
		this.normalButton = this.addButton(scene, font, layout.normalDifficultyButtonRect, "NORMAL", "#2b6c54");
		this.hardButton = this.addButton(scene, font, layout.hardDifficultyButtonRect, "HARD", "#26384d");
		this.difficultyLabel = this.addLabel(scene, font, "Selected: NORMAL", 22, 526, 424, "#a5d6a7");
		this.addLabel(scene, font, "TWO PLAYERS", 24, 549, 452, "#ffccbc");
		this.localTwoPlayerButton = this.addButton(
			scene, font, layout.localTwoPlayerButtonRect, "LOCAL 2P", "#63435b"
		);
		this.howToPlayButton = this.addButton(
			scene, font, layout.howToPlayButtonRect, "HOW TO PLAY", "#34516d"
		);
		this.easyButton.onPointDown.add((): void => this.selectDifficulty(CpuDifficulty.Easy));
		this.normalButton.onPointDown.add((): void => this.selectDifficulty(CpuDifficulty.Normal));
		this.hardButton.onPointDown.add((): void => this.selectDifficulty(CpuDifficulty.Hard));
		this.vsCpuButton.onPointDown.add((): void => this.start(GameMode.VsCpu));
		this.localTwoPlayerButton.onPointDown.add((): void => this.start(GameMode.LocalTwoPlayer));
		this.updateDifficultyAppearance();
	}

	/** overlayが表示中で盤面入力をblockすべき場合はtrueを返します。 */
	get isVisible(): boolean {
		return this.visible;
	}

	/** 結果overlayのChange Modeから同じ選択画面を再表示します。 */
	show(): void {
		this.visible = true;
		this.updateDifficultyAppearance();
		this.entity.show();
	}

	/** 指定CPU難易度を設定へ保存し、選択色と文言を更新します。 */
	private selectDifficulty(difficulty: CpuDifficulty): void {
		this.sessionConfig.cpuDifficulty = difficulty;
		this.updateDifficultyAppearance();
	}

	/** 選択モードを保存してoverlayを閉じ、同じ設定でNew Gameを開始します。 */
	private start(gameMode: GameMode): void {
		this.sessionConfig.gameMode = gameMode;
		this.visible = false;
		this.entity.hide();
		this.onStart();
	}

	/** 現在難易度をlabelと3buttonの背景色へ反映します。 */
	private updateDifficultyAppearance(): void {
		const difficulty: CpuDifficulty = this.sessionConfig.cpuDifficulty;
		this.easyButton.cssColor = difficulty === CpuDifficulty.Easy ? "#2b6c54" : "#26384d";
		this.normalButton.cssColor = difficulty === CpuDifficulty.Normal ? "#2b6c54" : "#26384d";
		this.hardButton.cssColor = difficulty === CpuDifficulty.Hard ? "#2b6c54" : "#26384d";
		this.easyButton.modified();
		this.normalButton.modified();
		this.hardButton.modified();
		this.difficultyLabel.text = "Selected: " + difficulty.toUpperCase();
		this.difficultyLabel.invalidate();
	}

	/** 指定矩形全体をtouchableにした大型buttonと中央寄せlabelを生成します。 */
	private addButton(
		scene: g.Scene,
		font: g.Font,
		rect: LayoutRect,
		text: string,
		color: string
	): g.FilledRect {
		const button: g.FilledRect = new g.FilledRect({
			scene: scene,
			parent: this.entity,
			cssColor: color,
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height,
			touchable: true
		});
		this.addLabel(scene, font, text, 30, rect.x + rect.width / 2 - text.length * 9, rect.y + 23, "white");
		return button;
	}

	/** Mode Selection内へ静的labelを追加して返します。 */
	private addLabel(
		scene: g.Scene,
		font: g.Font,
		text: string,
		fontSize: number,
		x: number,
		y: number,
		textColor: string
	): g.Label {
		return new g.Label({
			scene: scene,
			parent: this.entity,
			font: font,
			text: text,
			fontSize: fontSize,
			x: x,
			y: y,
			textColor: textColor
		});
	}
}
