import {GameBalance} from "./game_balance";
import {squareSumRoot} from "./motion";
import {Planet} from "./planet";

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

	/** 位置誤差だけを示す同心円ガイドを生成します。 */
	constructor(scene: g.Scene, centralBody: Planet, worldSpanMeters: number) {
		this.currentCentralBody = centralBody;
		this.worldSpanMeters = worldSpanMeters;
		this.viewportShortSidePixels = Math.min(g.game.width, g.game.height);
		this.entity = new g.E({scene: scene});
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres - GameBalance.OnePointOrbitErrorMetres, "#26384d", 2);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres + GameBalance.OnePointOrbitErrorMetres, "#26384d", 2);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres - GameBalance.TwoPointOrbitErrorMetres, "#36577a", 2);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres + GameBalance.TwoPointOrbitErrorMetres, "#36577a", 2);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres - GameBalance.ThreePointOrbitErrorMetres, "#4c86a8", 3);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres + GameBalance.ThreePointOrbitErrorMetres, "#4c86a8", 3);
		this.addRing(scene, GameBalance.TargetOrbitRadiusMetres, "#8be9fd", 4);
		scene.append(this.entity);
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
		);
		this.entity.y = metersToPixels(
			this.currentCentralBody.pos.y,
			this.worldSpanMeters,
			this.viewportShortSidePixels
		);
		this.entity.modified();
	}

	/** 円周上へ小さなFilledRectを並べ、外部描画ライブラリなしの点線リングを追加します。 */
	private addRing(scene: g.Scene, radiusMetres: number, cssColor: string, dotSizePixels: number): void {
		const segmentCount: number = 64;
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
				x: Math.cos(angle) * radiusPixels - dotSizePixels / 2,
				y: Math.sin(angle) * radiusPixels - dotSizePixels / 2,
				width: dotSizePixels,
				height: dotSizePixels
			}));
		}
	}
}

/**
 * SI単位の物理モデルをAkashicのSpriteへ投影する、天体1個分のViewです。
 */
export class PlanetView {
	/** 表示元となる純粋な物理モデルです。 */
	readonly model: Planet;

	/** タッチ入力にも利用する天体Spriteです。 */
	readonly entity: g.Sprite;

	/** 重力加速度の状態を可視化する既存Spriteです。 */
	private readonly gravityVector: g.Sprite;

	/** 速度の状態を可視化する既存Spriteです。 */
	private readonly velocityVector: g.Sprite;

	/** 物理世界の表示幅（m）です。 */
	private readonly worldSpanMeters: number;

	/** 物理世界の表示幅に対応する画面短辺（px）です。 */
	private readonly viewportShortSidePixels: number;

	/**
	 * 天体Viewを生成します。
	 * @param scene Spriteを配置するAkashic Scene
	 * @param model 表示対象の物理モデル
	 * @param imageAsset 天体画像
	 * @param worldSpanMeters 画面短辺に対応する物理世界の長さ（m）
	 * @param touchable 入力対象にするか
	 */
	constructor(
		scene: g.Scene,
		model: Planet,
		imageAsset: g.ImageAsset,
		worldSpanMeters: number,
		touchable: boolean
	) {
		this.model = model;
		this.worldSpanMeters = worldSpanMeters;
		this.viewportShortSidePixels = Math.min(g.game.width, g.game.height);
		this.entity = new g.Sprite({
			scene: scene,
			src: imageAsset,
			scaleX: 0.2,
			scaleY: 0.2,
			touchable: touchable
		});
		this.gravityVector = new g.Sprite({
			scene: scene,
			src: scene.asset.getImageById("gravity_vector"),
			scaleX: 0.2,
			scaleY: 0.2,
			x: 0,
			y: 100
		});
		this.velocityVector = new g.Sprite({
			scene: scene,
			src: scene.asset.getImageById("velocity_vector"),
			scaleX: 0.2,
			scaleY: 0.2,
			x: 100,
			y: 100
		});

		scene.append(this.gravityVector);
		scene.append(this.velocityVector);
		scene.append(this.entity);
		this.update();
	}

	/** 物理モデルの最新状態からSpriteと既存ベクトル表示を1回だけ同期します。 */
	update(): void {
		this.entity.x = metersToPixels(this.model.pos.x, this.worldSpanMeters, this.viewportShortSidePixels);
		this.entity.y = metersToPixels(this.model.pos.y, this.worldSpanMeters, this.viewportShortSidePixels);
		this.entity.modified();

		const accelerationMagnitude: number = squareSumRoot([
			this.model.acceleration.x,
			this.model.acceleration.y
		]);
		const gravityForceDisplayValue: number = accelerationMagnitude * this.model.mass / Math.pow(10, 4);
		this.gravityVector.height = Math.max(
			1,
			metersToPixels(gravityForceDisplayValue, this.worldSpanMeters, this.viewportShortSidePixels)
		);
		this.gravityVector.modified();

		this.velocityVector.height = Math.max(
			1,
			Math.floor(squareSumRoot([this.model.velocity.x, this.model.velocity.y]))
		);
		this.velocityVector.modified();
	}

	/** New Game時に、この天体へ対応するSpriteをSceneから破棄します。 */
	destroy(): void {
		this.gravityVector.destroy();
		this.velocityVector.destroy();
		this.entity.destroy();
	}
}

/**
 * 複数のPlanetViewを束ね、物理サブステップ完了後の描画同期を1回に集約します。
 */
export class PlanetRenderer {
	/** Spriteを所有するAkashic Sceneです。 */
	private readonly scene: g.Scene;

	/** 画面短辺に表示する物理世界の長さ（m）です。 */
	private readonly worldSpanMeters: number;

	/** 登録済みの天体Viewです。 */
	private readonly views: PlanetView[] = [];

	/** 盤面の背面で中心天体を追従するターゲット軌道Viewです。 */
	private targetOrbitView: TargetOrbitView | undefined;

	/** 描画同期先を生成します。 */
	constructor(scene: g.Scene, worldSpanMeters: number) {
		this.scene = scene;
		this.worldSpanMeters = worldSpanMeters;
	}

	/** 物理モデルに対応するViewを生成して返します。 */
	addPlanet(model: Planet, imageAssetId: string, touchable: boolean = false): PlanetView {
		const view: PlanetView = new PlanetView(
			this.scene,
			model,
			this.scene.asset.getImageById(imageAssetId),
			this.worldSpanMeters,
			touchable
		);
		this.views.push(view);
		return view;
	}

	/** ターゲット軌道を初回生成するか、New Game後の中心天体へ追従先を更新します。 */
	setTargetOrbit(centralBody: Planet): void {
		if (this.targetOrbitView === undefined) {
			this.targetOrbitView = new TargetOrbitView(this.scene, centralBody, this.worldSpanMeters);
		} else {
			this.targetOrbitView.setCentralBody(centralBody);
		}
	}

	/** 指定した物理モデルへ対応する登録済みViewを返します。 */
	findView(model: Planet): PlanetView | undefined {
		return this.views.filter((view: PlanetView): boolean => view.model === model)[0];
	}

	/** New Game時に全Viewを破棄し、動的な盤面再構築を可能にします。 */
	clear(): void {
		this.views.forEach((view: PlanetView): void => view.destroy());
		this.views.splice(0, this.views.length);
	}

	/** 全Viewを各物理モデルの最新状態へ同期します。 */
	update(): void {
		if (this.targetOrbitView !== undefined) {
			this.targetOrbitView.update();
		}
		this.views.forEach((view: PlanetView): void => view.update());
	}
}

/** SI単位の距離を指定した表示スケールのpxへ変換します。 */
export function metersToPixels(meters: number, worldSpanMeters: number, viewportPixels: number): number {
	return Math.floor(meters / worldSpanMeters * viewportPixels);
}
