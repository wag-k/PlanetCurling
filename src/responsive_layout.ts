/** ブラウザ環境で参照する最小限のviewport情報です。headless実行では存在しません。 */
declare const window: {innerWidth: number; innerHeight: number};

/** 物理device viewportに応じたG5.1の表示モードです。論理解像度自体は変更しません。 */
export enum LayoutMode {
	/** PCや大きな横持ちtablet向けです。 */
	DesktopLandscape = "DesktopLandscape",
	/** Smartphoneや小型tabletの横持ち向けです。 */
	CompactLandscape = "CompactLandscape",
	/** 縦持ち端末向けです。 */
	Portrait = "Portrait"
}

/** Akashic非依存の論理座標矩形です。 */
export class LayoutRect {
	/** 左端の論理x座標です。 */
	readonly x: number;
	/** 上端の論理y座標です。 */
	readonly y: number;
	/** 論理幅です。 */
	readonly width: number;
	/** 論理高さです。 */
	readonly height: number;

	/** 位置と大きさから矩形を生成します。 */
	constructor(x: number, y: number, width: number, height: number) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}

	/** 右端の論理x座標を返します。 */
	get right(): number {
		return this.x + this.width;
	}

	/** 下端の論理y座標を返します。 */
	get bottom(): number {
		return this.y + this.height;
	}

	/** 指定矩形がこの矩形内へ収まる場合にtrueを返します。 */
	contains(other: LayoutRect): boolean {
		return other.x >= this.x && other.y >= this.y
			&& other.right <= this.right && other.bottom <= this.bottom;
	}
}

/** CSS pixel単位の実ブラウザviewportです。1280×720論理画面とは別の値です。 */
export class DeviceViewport {
	/** 実viewport幅（CSS px）です。 */
	readonly width: number;
	/** 実viewport高さ（CSS px）です。 */
	readonly height: number;

	/** 有効な正のviewportを生成します。 */
	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
	}

	/** 縦持ちの場合にtrueを返します。 */
	get isPortrait(): boolean {
		return this.height > this.width;
	}
}

/**
 * 1280×720の論理解像度内で盤面・HUD・入力・描画寸法を一元管理します。
 * device viewportはモード選択だけに使用し、物理座標やゲームバランスへ影響させません。
 */
export class ResponsiveLayout {
	/** Akashic Gameの固定論理幅です。 */
	readonly logicalWidth: number;
	/** Akashic Gameの固定論理高さです。 */
	readonly logicalHeight: number;
	/** レイアウト選択に使用した実device viewportです。 */
	readonly deviceViewport: DeviceViewport;
	/** 判定済みの表示モードです。 */
	readonly mode: LayoutMode;
	/** 物理世界を描く正方形の盤面領域です。 */
	readonly boardRect: LayoutRect;
	/** 得点・ターン・操作をまとめる右側HUD領域です。 */
	readonly hudRect: LayoutRect;
	/** 論理画面全体です。 */
	readonly screenRect: LayoutRect;
	/** HUD内側の共通余白です。 */
	readonly margin: number;
	/** Red / Blue得点を配置する領域です。 */
	readonly scoreRect: LayoutRect;
	/** TurnとShotを配置する領域です。 */
	readonly turnRect: LayoutRect;
	/** Simulation進捗を配置する領域です。 */
	readonly progressRect: LayoutRect;
	/** 各Stone状態を配置する領域です。 */
	readonly stoneStatusRect: LayoutRect;
	/** Prediction切替のタッチ領域です。 */
	readonly predictionButtonRect: LayoutRect;
	/** Trails切替のタッチ領域です。 */
	readonly trailsButtonRect: LayoutRect;
	/** 試合終了時に盤面中央へ置くoverlay領域です。 */
	readonly resultOverlayRect: LayoutRect;
	/** Result overlay内のRematchタッチ領域です。 */
	readonly rematchButtonRect: LayoutRect;
	/** Result overlay内のMode変更タッチ領域です。 */
	readonly changeModeButtonRect: LayoutRect;
	/** 起動時Mode Selectionの中央panel領域です。 */
	readonly modeSelectionOverlayRect: LayoutRect;
	/** Mode SelectionのVs CPU開始タッチ領域です。 */
	readonly vsCpuButtonRect: LayoutRect;
	/** Mode SelectionのEasy難易度タッチ領域です。 */
	readonly easyDifficultyButtonRect: LayoutRect;
	/** Mode SelectionのNormal難易度タッチ領域です。 */
	readonly normalDifficultyButtonRect: LayoutRect;
	/** Mode SelectionのHard難易度タッチ領域です。 */
	readonly hardDifficultyButtonRect: LayoutRect;
	/** Mode SelectionのLocal 2P開始タッチ領域です。 */
	readonly localTwoPlayerButtonRect: LayoutRect;
	/** 短時間のTurn通知を置く盤面内領域です。 */
	readonly turnOverlayRect: LayoutRect;
	/** Score表示の論理font sizeです。 */
	readonly scoreFontSize: number;
	/** Turn表示の論理font sizeです。 */
	readonly turnFontSize: number;
	/** Shot・進捗表示の論理font sizeです。 */
	readonly bodyFontSize: number;
	/** Stone状態表示の論理font sizeです。 */
	readonly statusFontSize: number;
	/** Button表示の論理font sizeです。 */
	readonly buttonFontSize: number;
	/** activeStoneだけに使う透明タッチ領域の一辺です。 */
	readonly stoneTouchTargetSize: number;
	/** Launch GuideをStoneから離して開始する距離です。 */
	readonly launchGuideStartOffset: number;
	/** Launch Guideの最小長です。 */
	readonly launchGuideMinimumLength: number;
	/** Launch Guideの最大長です。 */
	readonly launchGuideMaximumLength: number;
	/** Launch Guide本線の描画幅です。 */
	readonly launchGuideWidth: number;
	/** Launch Guide終端markerの一辺です。 */
	readonly launchGuideEndpointSize: number;
	/** Prediction点の一辺です。sampling間隔は変更しません。 */
	readonly predictionDotSize: number;
	/** Actual Trailの線幅です。 */
	readonly trailWidth: number;
	/** Target Orbitの基準dot sizeへ加算する値です。 */
	readonly targetOrbitDotBoost: number;
	/** Smartphone portraitで入力を覆う案内が必要な場合にtrueです。 */
	readonly shouldBlockForPortrait: boolean;

	/** 判定済み値から不変のレイアウトを生成します。 */
	private constructor(
		logicalWidth: number,
		logicalHeight: number,
		deviceViewport: DeviceViewport,
		mode: LayoutMode
	) {
		this.logicalWidth = logicalWidth;
		this.logicalHeight = logicalHeight;
		this.deviceViewport = deviceViewport;
		this.mode = mode;
		this.screenRect = new LayoutRect(0, 0, logicalWidth, logicalHeight);
		const boardSize: number = Math.min(logicalWidth, logicalHeight);
		this.boardRect = new LayoutRect(0, 0, boardSize, boardSize);
		this.hudRect = new LayoutRect(boardSize, 0, logicalWidth - boardSize, logicalHeight);
		const compact: boolean = mode !== LayoutMode.DesktopLandscape;
		this.margin = compact ? 24 : 28;
		const contentX: number = this.hudRect.x + this.margin;
		const contentWidth: number = this.hudRect.width - this.margin * 2;
		this.scoreRect = new LayoutRect(contentX, 24, contentWidth, 52);
		this.turnRect = new LayoutRect(contentX, 92, contentWidth, 82);
		this.progressRect = new LayoutRect(contentX, 190, contentWidth, 76);
		this.stoneStatusRect = new LayoutRect(contentX, 286, contentWidth, 116);
		const buttonGap: number = 20;
		const buttonWidth: number = (contentWidth - buttonGap) / 2;
		const buttonHeight: number = compact ? 80 : 72;
		this.predictionButtonRect = new LayoutRect(contentX, 438, buttonWidth, buttonHeight);
		this.trailsButtonRect = new LayoutRect(contentX + buttonWidth + buttonGap, 438, buttonWidth, buttonHeight);
		this.resultOverlayRect = new LayoutRect(
			this.boardRect.x + (this.boardRect.width - 580) / 2,
			this.boardRect.y + (this.boardRect.height - 340) / 2,
			580,
			340
		);
		this.rematchButtonRect = new LayoutRect(
			this.resultOverlayRect.x + 35,
			this.resultOverlayRect.y + 225,
			240,
			80
		);
		this.changeModeButtonRect = new LayoutRect(
			this.resultOverlayRect.x + 305,
			this.resultOverlayRect.y + 225,
			240,
			80
		);
		this.modeSelectionOverlayRect = new LayoutRect(160, 50, logicalWidth - 320, logicalHeight - 100);
		this.vsCpuButtonRect = new LayoutRect(430, 178, 420, 82);
		const difficultyWidth: number = 180;
		const difficultyGap: number = 24;
		const difficultyStartX: number = (logicalWidth - (difficultyWidth * 3 + difficultyGap * 2)) / 2;
		this.easyDifficultyButtonRect = new LayoutRect(difficultyStartX, 334, difficultyWidth, 76);
		this.normalDifficultyButtonRect = new LayoutRect(
			difficultyStartX + difficultyWidth + difficultyGap, 334, difficultyWidth, 76
		);
		this.hardDifficultyButtonRect = new LayoutRect(
			difficultyStartX + (difficultyWidth + difficultyGap) * 2, 334, difficultyWidth, 76
		);
		this.localTwoPlayerButtonRect = new LayoutRect(430, 488, 420, 82);
		this.turnOverlayRect = new LayoutRect(this.boardRect.x + 210, 48, 300, 56);
		this.scoreFontSize = compact ? 34 : 32;
		this.turnFontSize = compact ? 30 : 28;
		this.bodyFontSize = compact ? 25 : 23;
		this.statusFontSize = compact ? 23 : 21;
		this.buttonFontSize = compact ? 25 : 23;
		this.stoneTouchTargetSize = compact ? 128 : 112;
		this.launchGuideStartOffset = compact ? 30 : 22;
		this.launchGuideMinimumLength = compact ? 72 : 52;
		this.launchGuideMaximumLength = compact ? 220 : 180;
		this.launchGuideWidth = compact ? 7 : 5;
		this.launchGuideEndpointSize = compact ? 14 : 10;
		this.predictionDotSize = compact ? 6 : 4;
		this.trailWidth = compact ? 4 : 3;
		this.targetOrbitDotBoost = compact ? 2 : 1;
		this.shouldBlockForPortrait = mode === LayoutMode.Portrait
			&& Math.min(deviceViewport.width, deviceViewport.height) < 600;
	}

	/** 論理解像度と実viewportから3種類のレイアウトモードを計算します。 */
	static calculate(
		logicalWidth: number,
		logicalHeight: number,
		viewportWidth: number,
		viewportHeight: number
	): ResponsiveLayout {
		if (logicalWidth <= 0 || logicalHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
			throw new Error("layout dimensions must be positive.");
		}
		const viewport: DeviceViewport = new DeviceViewport(viewportWidth, viewportHeight);
		let mode: LayoutMode;
		if (viewport.isPortrait) {
			mode = LayoutMode.Portrait;
		} else if (viewportWidth < 1024 || viewportHeight < 600) {
			mode = LayoutMode.CompactLandscape;
		} else {
			mode = LayoutMode.DesktopLandscape;
		}
		return new ResponsiveLayout(logicalWidth, logicalHeight, viewport, mode);
	}

	/** activeStone中心から、盤面内へclampした大型透明タッチ矩形を返します。 */
	calculateStoneTouchTarget(centerX: number, centerY: number): LayoutRect {
		const halfSize: number = this.stoneTouchTargetSize / 2;
		const x: number = Math.max(
			this.boardRect.x,
			Math.min(this.boardRect.right - this.stoneTouchTargetSize, centerX - halfSize)
		);
		const y: number = Math.max(
			this.boardRect.y,
			Math.min(this.boardRect.bottom - this.stoneTouchTargetSize, centerY - halfSize)
		);
		return new LayoutRect(x, y, this.stoneTouchTargetSize, this.stoneTouchTargetSize);
	}
}

/** headlessでは論理解像度、browserではCSS viewportを読み、現在のレイアウトを返します。 */
export function calculateCurrentLayout(logicalWidth: number, logicalHeight: number): ResponsiveLayout {
	const browserAvailable: boolean = typeof window !== "undefined"
		&& window.innerWidth > 0 && window.innerHeight > 0;
	return ResponsiveLayout.calculate(
		logicalWidth,
		logicalHeight,
		browserAvailable ? window.innerWidth : logicalWidth,
		browserAvailable ? window.innerHeight : logicalHeight
	);
}
