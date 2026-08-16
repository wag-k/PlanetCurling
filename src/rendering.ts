import {CollisionEvent, CollisionEventKind} from "./collision";
import {GameBalance} from "./game_balance";
import {CollisionPresentationEvent, TrajectoryVisibility} from "./game_presentation";
import {CurlingStone, Player} from "./match_controller";
import {Planet} from "./planet";
import {LayoutRect, ResponsiveLayout} from "./responsive_layout";
import {TrajectoryPoint} from "./trajectory";

/** Aiming中だけactiveStoneから実際の発射方向へ伸び、速度強度を表示上だけclampするGuideです。 */
export class LaunchGuideView extends g.E {
	/** 現在のactiveStone取得関数です。ゲーム状態は変更しません。 */
	private readonly getActiveStone: () => CurlingStone | undefined;
	/** 物理世界幅（m）です。 */
	private readonly worldSpanMeters: number;
	/** Mobile向けのGuide長・太さと盤面矩形です。 */
	private readonly layout: ResponsiveLayout;

	/** 描画層専用のLaunch Guideを生成します。 */
	constructor(
		scene: g.Scene,
		parent: g.E,
		getActiveStone: () => CurlingStone | undefined,
		worldSpanMeters: number,
		layout: ResponsiveLayout
	) {
		super({scene: scene, parent: parent, width: layout.logicalWidth, height: layout.logicalHeight});
		this.getActiveStone = getActiveStone;
		this.worldSpanMeters = worldSpanMeters;
		this.layout = layout;
	}

	/** activeStoneのvelocityを変更せず、方向と強さを矢印として描きます。 */
	renderSelf(renderer: g.Renderer): boolean {
		const stone: CurlingStone | undefined = this.getActiveStone();
		if (stone === undefined) return true;
		const velocityX: number = stone.body.velocity.x;
		const velocityY: number = stone.body.velocity.y;
		const magnitude: number = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
		if (magnitude <= 0) return true;
		const viewport: number = this.layout.boardRect.width;
		const unitX: number = velocityX / magnitude;
		const unitY: number = velocityY / magnitude;
		const stoneX: number = this.layout.boardRect.x
			+ metersToPixels(stone.body.pos.x, this.worldSpanMeters, viewport);
		const stoneY: number = this.layout.boardRect.y
			+ metersToPixels(stone.body.pos.y, this.worldSpanMeters, viewport);
		const startX: number = stoneX + unitX * this.layout.launchGuideStartOffset;
		const startY: number = stoneY + unitY * this.layout.launchGuideStartOffset;
		const length: number = Math.max(
			this.layout.launchGuideMinimumLength,
			Math.min(this.layout.launchGuideMaximumLength, magnitude / 120)
		);
		const endX: number = startX + unitX * length;
		const endY: number = startY + unitY * length;
		this.drawSegment(renderer, startX, startY, endX, endY, this.layout.launchGuideWidth);
		this.drawSegment(renderer, endX, endY, endX - unitX * 18 - unitY * 12,
			endY - unitY * 18 + unitX * 12, this.layout.launchGuideWidth - 1);
		this.drawSegment(renderer, endX, endY, endX - unitX * 18 + unitY * 12,
			endY - unitY * 18 - unitX * 12, this.layout.launchGuideWidth - 1);
		const markerSize: number = this.layout.launchGuideEndpointSize;
		renderer.fillRect(endX - markerSize / 2, endY - markerSize / 2, markerSize, markerSize, "#fff59d");
		return true;
	}

	/** 2点を指定幅の回転矩形で結びます。 */
	private drawSegment(renderer: g.Renderer, startX: number, startY: number, endX: number, endY: number, width: number): void {
		const deltaX: number = endX - startX;
		const deltaY: number = endY - startY;
		const length: number = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		renderer.save();
		renderer.translate(startX, startY);
		renderer.transform([deltaX / length, deltaY / length, -deltaY / length, deltaX / length, 0, 0]);
		renderer.fillRect(0, -width / 2, length, width, "#fff59d");
		renderer.restore();
	}
}

/** 中心天体を追従し、位置誤差の得点帯を点線の同心円で示すViewです。 */
export class TargetOrbitView {
	/** すべてのリング片をまとめて移動する親Entityです。 */
	readonly entity: g.E;

	/** リングの中心として追従する動的な中心天体です。 */
	private currentCentralBody: Planet;

	/** 物理世界の表示幅（m）です。 */
	private readonly worldSpanMeters: number;

	/** 物理世界の表示幅に対応する画面短辺（px）です。 */
	private readonly viewportShortSidePixels: number;

	/** Target Orbitのmobile向けdot補正を持つレイアウトです。 */
	private readonly layout: ResponsiveLayout;

	/** 位置誤差だけを示す同心円ガイドを生成します。 */
	constructor(
		scene: g.Scene,
		parent: g.E,
		centralBody: Planet,
		worldSpanMeters: number,
		layout: ResponsiveLayout
	) {
		this.currentCentralBody = centralBody;
		this.worldSpanMeters = worldSpanMeters;
		this.layout = layout;
		this.viewportShortSidePixels = layout.boardRect.width;
		this.entity = new g.E({scene: scene});
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres - GameBalance.OnePointOrbitErrorMetres, "#26384d", 2);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres + GameBalance.OnePointOrbitErrorMetres, "#26384d", 2);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres - GameBalance.TwoPointOrbitErrorMetres, "#36577a", 2);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres + GameBalance.TwoPointOrbitErrorMetres, "#36577a", 2);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres - GameBalance.ThreePointOrbitErrorMetres, "#4c86a8", 3);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres + GameBalance.ThreePointOrbitErrorMetres, "#4c86a8", 3);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres, "#8be9fd", 4);
		parent.append(this.entity);
		this.update();
	}

	/** New Game後の新しい中心天体へ追従先を切り替えます。 */
	setCentralBody(centralBody: Planet): void {
		this.currentCentralBody = centralBody;
		this.update();
	}

	/** 中心天体の最新位置へリング群を同期します。 */
	update(): void {
		this.entity.x = metersToPixels(
			this.currentCentralBody.pos.x,
			this.worldSpanMeters,
			this.viewportShortSidePixels
		) + this.layout.boardRect.x;
		this.entity.y = metersToPixels(
			this.currentCentralBody.pos.y,
			this.worldSpanMeters,
			this.viewportShortSidePixels
		) + this.layout.boardRect.y;
		this.entity.modified();
	}

	/** 円周上へ小さなFilledRectを並べ、外部描画ライブラリなしの点線リングを追加します。 */
	private addRing(scene: g.Scene, radiusMetres: number, cssColor: string, dotSizePixels: number): void {
		const segmentCount: number = 72;
		const adjustedDotSize: number = dotSizePixels + this.layout.targetOrbitDotBoost;
		const radiusPixels: number = metersToPixels(
			radiusMetres,
			this.worldSpanMeters,
			this.viewportShortSidePixels
		);
		for (let index: number = 0; index < segmentCount; index += 1) {
			const angle: number = index / segmentCount * Math.PI * 2;
			this.entity.append(new g.FilledRect({
				scene: scene,
				cssColor: cssColor,
				x: Math.cos(angle) * radiusPixels - adjustedDotSize / 2,
				y: Math.sin(angle) * radiusPixels - adjustedDotSize / 2,
				width: adjustedDotSize,
				height: adjustedDotSize
			}));
		}
	}
}

/** 予測軌道と実軌跡を1投につき1 Entityへまとめ、数百点でもEntity数を増やさず描画します。 */
export class StoneTrajectoryView extends g.E {
	/** 表示元となるゲーム側の投球メタデータです。 */
	readonly stone: CurlingStone;

	/** 物理世界の表示幅（m）です。 */
	private readonly worldSpanMeters: number;

	/** 物理世界の表示幅に対応する画面短辺（px）です。 */
	private readonly viewportShortSidePixels: number;

	/** 所有者に対応した点線予測色です。 */
	private readonly predictionColor: string;

	/** 所有者に対応した実軌跡の線色です。 */
	private readonly actualColor: string;
	/** Rendererが共有する表示専用toggleです。 */
	private readonly visibility: TrajectoryVisibility;
	/** Prediction / Trailのmobile向け描画寸法です。 */
	private readonly layout: ResponsiveLayout;

	/** 1投分の予測・実軌跡を同じ座標変換で描くEntityを生成します。 */
	constructor(
		scene: g.Scene,
		parent: g.E,
		stone: CurlingStone,
		worldSpanMeters: number,
		visibility: TrajectoryVisibility,
		layout: ResponsiveLayout
	) {
		super({
			scene: scene,
			parent: parent,
			width: layout.logicalWidth,
			height: layout.logicalHeight
		});
		this.stone = stone;
		this.worldSpanMeters = worldSpanMeters;
		this.viewportShortSidePixels = layout.boardRect.width;
		this.predictionColor = stone.owner === Player.Red ? "#ff8a80" : "#80d8ff";
		this.actualColor = stone.owner === Player.Red ? "#d32f2f" : "#1976d2";
		this.visibility = visibility;
		this.layout = layout;
	}

	/** 点線予測を小点列、実軌跡を連結線として描き、通常の子描画も許可します。 */
	renderSelf(renderer: g.Renderer): boolean {
		if (this.visibility.trailsVisible) this.drawActualTrajectory(renderer, this.stone.actualTrajectory);
		if (this.visibility.predictionVisible) this.drawPrediction(renderer, this.stone.predictedTrajectory);
		return true;
	}

	/** 予測sample点を間隔のある3px四方の点として描画します。 */
	private drawPrediction(renderer: g.Renderer, points: TrajectoryPoint[]): void {
		points.forEach((point: TrajectoryPoint, index: number): void => {
			if (index % 2 !== 0) {
				return;
			}
			const x: number = this.layout.boardRect.x
				+ metersToPixels(point.xMetres, this.worldSpanMeters, this.viewportShortSidePixels);
			const y: number = this.layout.boardRect.y
				+ metersToPixels(point.yMetres, this.worldSpanMeters, this.viewportShortSidePixels);
			const size: number = this.layout.predictionDotSize;
			renderer.fillRect(x - size / 2, y - size / 2, size, size, this.predictionColor);
		});
	}

	/** 実軌跡の隣接sample点を2px幅の線分で接続します。 */
	private drawActualTrajectory(renderer: g.Renderer, points: TrajectoryPoint[]): void {
		for (let index: number = 1; index < points.length; index += 1) {
			const previousX: number = this.layout.boardRect.x + metersToPixels(
				points[index - 1].xMetres,
				this.worldSpanMeters,
				this.viewportShortSidePixels
			);
			const previousY: number = this.layout.boardRect.y + metersToPixels(
				points[index - 1].yMetres,
				this.worldSpanMeters,
				this.viewportShortSidePixels
			);
			const currentX: number = this.layout.boardRect.x + metersToPixels(
				points[index].xMetres,
				this.worldSpanMeters,
				this.viewportShortSidePixels
			);
			const currentY: number = this.layout.boardRect.y + metersToPixels(
				points[index].yMetres,
				this.worldSpanMeters,
				this.viewportShortSidePixels
			);
			this.drawLine(renderer, previousX, previousY, currentX, currentY);
		}
	}

	/** Rendererの座標変換を使い、2点間を回転したFilledRect 1個で結びます。 */
	private drawLine(renderer: g.Renderer, startX: number, startY: number, endX: number, endY: number): void {
		const deltaX: number = endX - startX;
		const deltaY: number = endY - startY;
		const length: number = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		if (length === 0) {
			return;
		}
		const cosine: number = deltaX / length;
		const sine: number = deltaY / length;
		renderer.save();
		renderer.translate(startX, startY);
		renderer.transform([cosine, sine, -sine, cosine, 0, 0]);
		renderer.fillRect(0, -this.layout.trailWidth / 2, length, this.layout.trailWidth, this.actualColor);
		renderer.restore();
	}
}

/** 衝突位置で短時間だけ拡大・減衰する、外部アセット不要のフラッシュ表示です。 */
export class CollisionEffectView {
	/** フラッシュと英語通知をまとめる描画Entityです。 */
	readonly entity: g.E;
	/** 表示開始後に経過した描画フレーム数です。 */
	private elapsedFrames: number = 0;
	/** エフェクトを表示する総フレーム数です。 */
	private readonly durationFrames: number = 15;

	/** 衝突種別に応じた色と衝突位置でフラッシュを生成します。 */
	constructor(
		scene: g.Scene,
		parent: g.E,
		event: CollisionEvent,
		worldSpanMeters: number,
		font: g.Font,
		layout: ResponsiveLayout
	) {
		const viewportPixels: number = layout.boardRect.width;
		const sizePixels: number = event.kind === CollisionEventKind.StoneCentralBody ? 32 : 22;
		const presentation: CollisionPresentationEvent = new CollisionPresentationEvent(event);
		this.entity = new g.E({scene: scene, parent: parent, width: 180, height: 70,
			x: layout.boardRect.x + metersToPixels(event.position.x, worldSpanMeters, viewportPixels) - sizePixels / 2,
			y: layout.boardRect.y + metersToPixels(event.position.y, worldSpanMeters, viewportPixels) - sizePixels / 2});
		this.entity.append(new g.FilledRect({
			scene: scene,
			cssColor: event.kind === CollisionEventKind.StoneCentralBody ? "#ff6ec7" : "#fff176",
			width: sizePixels,
			height: sizePixels,
			opacity: 0.9
		}));
		this.entity.append(new g.Label({scene: scene, font: font, text: presentation.text,
			fontSize: presentation.isAbsorption ? 24 : 18, x: sizePixels + 5, y: 0,
			textColor: presentation.isAbsorption ? "#ff80d5" : "#fff59d"}));
	}

	/** 1フレーム進め、表示期間を終えた場合はfalseを返します。 */
	update(): boolean {
		this.elapsedFrames += 1;
		const progress: number = this.elapsedFrames / this.durationFrames;
		this.entity.opacity = Math.max(0, 0.9 * (1 - progress));
		this.entity.scaleX = 1 + progress * 1.5;
		this.entity.scaleY = 1 + progress * 1.5;
		this.entity.modified();
		return this.elapsedFrames < this.durationFrames;
	}

	/** エフェクトEntityをSceneから破棄します。 */
	destroy(): void {
		this.entity.destroy();
	}
}

/**
 * SI単位の物理モデルをAkashicのSpriteへ投影する、天体1個分のViewです。
 */
export class PlanetView {
	/** 表示元となる純粋な物理モデルです。 */
	readonly model: Planet;

	/** 見た目だけを担当し、入力判定サイズへ影響しない天体Spriteです。 */
	readonly entity: g.Sprite;

	/** Stone用にだけ生成する、見た目と独立した透明タッチ領域です。 */
	readonly inputEntity: g.FilledRect | undefined;

	/** 物理世界の表示幅（m）です。 */
	private readonly worldSpanMeters: number;

	/** 物理世界の表示幅に対応する画面短辺（px）です。 */
	private readonly viewportShortSidePixels: number;

	/** 盤面矩形とactiveStoneタッチ寸法です。 */
	private readonly layout: ResponsiveLayout;

	/** 描画対象自体が表示中かを保持します。 */
	private visible: boolean = true;

	/**
	 * 天体Viewを生成します。
	 * @param scene Spriteを配置するAkashic Scene
	 * @param model 表示対象の物理モデル
	 * @param imageAsset 天体画像
	 * @param worldSpanMeters 画面短辺に対応する物理世界の長さ（m）
	 * @param interactiveStone 大型透明touch targetを生成するStoneか
	 */
	constructor(
		scene: g.Scene,
		parent: g.E,
		model: Planet,
		imageAsset: g.ImageAsset,
		worldSpanMeters: number,
		interactiveStone: boolean,
		layout: ResponsiveLayout
	) {
		this.model = model;
		this.worldSpanMeters = worldSpanMeters;
		this.layout = layout;
		this.viewportShortSidePixels = layout.boardRect.width;
		this.entity = new g.Sprite({
			scene: scene,
			src: imageAsset,
			scaleX: 0.2,
			scaleY: 0.2,
			touchable: false
		});
		parent.append(this.entity);
		if (interactiveStone) {
			this.inputEntity = new g.FilledRect({
				scene: scene,
				parent: parent,
				cssColor: "#000000",
				opacity: 0,
				width: layout.stoneTouchTargetSize,
				height: layout.stoneTouchTargetSize,
				touchable: true
			});
			this.inputEntity.hide();
		}
		this.update();
	}

	/** 物理モデルの最新位置からSpriteを同期します。legacy vectorは通常画面に描きません。 */
	update(): void {
		this.entity.x = this.layout.boardRect.x
			+ metersToPixels(this.model.pos.x, this.worldSpanMeters, this.viewportShortSidePixels);
		this.entity.y = this.layout.boardRect.y
			+ metersToPixels(this.model.pos.y, this.worldSpanMeters, this.viewportShortSidePixels);
		this.entity.modified();
		if (this.inputEntity !== undefined) {
			const visualCenterX: number = this.entity.x + this.entity.width * this.entity.scaleX / 2;
			const visualCenterY: number = this.entity.y + this.entity.height * this.entity.scaleY / 2;
			const touchRect: LayoutRect = this.layout.calculateStoneTouchTarget(visualCenterX, visualCenterY);
			this.inputEntity.x = touchRect.x;
			this.inputEntity.y = touchRect.y;
			this.inputEntity.modified();
		}
	}

	/** 天体Spriteと付随するベクトル表示をまとめて表示・非表示へ切り替えます。 */
	setVisible(visible: boolean): void {
		this.visible = visible;
		if (visible) {
			this.entity.show();
		} else {
			this.entity.hide();
			if (this.inputEntity !== undefined) this.inputEntity.hide();
		}
	}

	/** Aiming中のactiveStoneだけ大型透明touch targetを有効化します。 */
	setInputActive(active: boolean): void {
		if (this.inputEntity === undefined) return;
		if (active && this.visible) {
			this.inputEntity.show();
		} else {
			this.inputEntity.hide();
		}
	}

	/** New Game時に、この天体へ対応するSpriteをSceneから破棄します。 */
	destroy(): void {
		if (this.inputEntity !== undefined) this.inputEntity.destroy();
		this.entity.destroy();
	}
}

/**
 * 複数のPlanetViewを束ね、物理サブステップ完了後の描画同期を1回に集約します。
 */
export class PlanetRenderer {
	/** Prediction / Trailsの表示だけを保持する設定です。 */
	readonly trajectoryVisibility: TrajectoryVisibility = new TrajectoryVisibility();
	/** Spriteを所有するAkashic Sceneです。 */
	private readonly scene: g.Scene;

	/** 画面短辺に表示する物理世界の長さ（m）です。 */
	private readonly worldSpanMeters: number;

	/** 盤面・入力・mobile描画寸法を一元管理するレイアウトです。 */
	private readonly layout: ResponsiveLayout;

	/** 登録済みの天体Viewです。 */
	private readonly views: PlanetView[] = [];

	/** 1投あたり1 Entityで予測・実軌跡を描くViewです。 */
	private readonly trajectoryViews: StoneTrajectoryView[] = [];

	/** UIより背面でターゲット軌道を描く固定レイヤーです。 */
	private readonly targetLayer: g.E;

	/** UIより背面で全投球の予測・実軌跡を描く固定レイヤーです。 */
	private readonly trajectoryLayer: g.E;

	/** UIより背面で天体と既存ベクトルを描く固定レイヤーです。 */
	private readonly planetLayer: g.E;

	/** UIより背面、天体より前面で衝突フラッシュを描く固定レイヤーです。 */
	private readonly collisionEffectLayer: g.E;

	/** 現在表示中の短時間衝突フラッシュです。 */
	private readonly collisionEffects: CollisionEffectView[] = [];
	/** 衝突通知に使う共有fontです。 */
	private readonly effectFont: g.DynamicFont;

	/** 盤面の背面で中心天体を追従するターゲット軌道Viewです。 */
	private targetOrbitView: TargetOrbitView | undefined;

	/** 描画同期先を生成します。 */
	constructor(scene: g.Scene, worldSpanMeters: number, layout: ResponsiveLayout) {
		this.scene = scene;
		this.worldSpanMeters = worldSpanMeters;
		this.layout = layout;
		this.effectFont = new g.DynamicFont({game: g.game, fontFamily: "sans-serif", size: 28});
		this.targetLayer = new g.E({scene: scene});
		this.trajectoryLayer = new g.E({scene: scene});
		this.planetLayer = new g.E({scene: scene});
		this.collisionEffectLayer = new g.E({scene: scene});
		scene.append(this.targetLayer);
		scene.append(this.trajectoryLayer);
		scene.append(this.planetLayer);
		scene.append(this.collisionEffectLayer);
	}

	/** 物理モデルに対応するViewを生成して返します。 */
	addPlanet(model: Planet, imageAssetId: string, interactiveStone: boolean = false): PlanetView {
		const view: PlanetView = new PlanetView(
			this.scene,
			this.planetLayer,
			model,
			this.scene.asset.getImageById(imageAssetId),
			this.worldSpanMeters,
			interactiveStone,
			this.layout
		);
		this.views.push(view);
		return view;
	}

	/** 指定投球の予測線と実軌跡をまとめて描画するViewを追加します。 */
	addStoneTrajectory(stone: CurlingStone): StoneTrajectoryView {
		const view: StoneTrajectoryView = new StoneTrajectoryView(
			this.scene,
			this.trajectoryLayer,
			stone,
			this.worldSpanMeters,
			this.trajectoryVisibility,
			this.layout
		);
		this.trajectoryViews.push(view);
		return view;
	}

	/** ターゲット軌道を初回生成するか、New Game後の中心天体へ追従先を更新します。 */
	setTargetOrbit(centralBody: Planet): void {
		if (this.targetOrbitView === undefined) {
			this.targetOrbitView = new TargetOrbitView(
				this.scene,
				this.targetLayer,
				centralBody,
				this.worldSpanMeters,
				this.layout
			);
		} else {
			this.targetOrbitView.setCentralBody(centralBody);
		}
	}

	/** 指定した物理モデルへ対応する登録済みViewを返します。 */
	findView(model: Planet): PlanetView | undefined {
		return this.views.filter((view: PlanetView): boolean => view.model === model)[0];
	}

	/** 指定天体のViewが存在する場合に表示・非表示を切り替えます。 */
	setPlanetVisible(model: Planet, visible: boolean): void {
		const view: PlanetView | undefined = this.findView(model);
		if (view !== undefined) {
			view.setVisible(visible);
		}
	}

	/** 発生した衝突通知ごとに短時間のフラッシュを追加します。 */
	addCollisionEffects(events: CollisionEvent[]): void {
		events.forEach((event: CollisionEvent): void => {
			this.collisionEffects.push(new CollisionEffectView(
				this.scene,
				this.collisionEffectLayer,
				event,
				this.worldSpanMeters,
				this.effectFont,
				this.layout
			));
			// この入口はMatchControllerが確定したActual event専用で、Predictionからは呼ばれません。
			this.scene.asset.getAudioById("se").play();
		});
	}

	/** New Game時に全Viewを破棄し、動的な盤面再構築を可能にします。 */
	clear(): void {
		this.views.forEach((view: PlanetView): void => view.destroy());
		this.views.splice(0, this.views.length);
		this.trajectoryViews.forEach((view: StoneTrajectoryView): void => view.destroy());
		this.trajectoryViews.splice(0, this.trajectoryViews.length);
		this.collisionEffects.forEach((effect: CollisionEffectView): void => effect.destroy());
		this.collisionEffects.splice(0, this.collisionEffects.length);
	}

	/** 全Viewを各物理モデルの最新状態へ同期します。 */
	update(): void {
		if (this.targetOrbitView !== undefined) {
			this.targetOrbitView.update();
		}
		this.views.forEach((view: PlanetView): void => view.update());
		this.trajectoryViews.forEach((view: StoneTrajectoryView): void => view.modified());
		for (let index: number = this.collisionEffects.length - 1; index >= 0; index -= 1) {
			if (!this.collisionEffects[index].update()) {
				this.collisionEffects[index].destroy();
				this.collisionEffects.splice(index, 1);
			}
		}
	}
}

/** SI単位の距離を指定した表示スケールのpxへ変換します。 */
export function metersToPixels(meters: number, worldSpanMeters: number, viewportPixels: number): number {
	return Math.floor(meters / worldSpanMeters * viewportPixels);
}
