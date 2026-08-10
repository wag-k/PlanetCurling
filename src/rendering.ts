import {squareSumRoot} from "./motion";
import {Planet} from "./planet";

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

	/** 全Viewを各物理モデルの最新状態へ同期します。 */
	update(): void {
		this.views.forEach((view: PlanetView): void => view.update());
	}
}

/** SI単位の距離を指定した表示スケールのpxへ変換します。 */
export function metersToPixels(meters: number, worldSpanMeters: number, viewportPixels: number): number {
	return Math.floor(meters / worldSpanMeters * viewportPixels);
}
