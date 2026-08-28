import {GameBalance} from "./game_balance";

/** Target Orbitと位置得点境界の意味を色以外でも識別する種類です。 */
export enum ScoringRingKind {
	/** 最終得点3点の位置誤差境界です。 */
	ThreePointBoundary = "ThreePointBoundary",
	/** 最終得点2点の位置誤差境界です。 */
	TwoPointBoundary = "TwoPointBoundary",
	/** 最終得点1点の位置誤差境界です。 */
	OnePointBoundary = "OnePointBoundary",
	/** 位置誤差0となるターゲット軌道です。 */
	Target = "Target"
}

/** 盤面リング1本の物理半径と、意味に対応した視覚表現を保持する純粋データです。 */
export class ScoringRingDefinition {
	/** 中心天体からのSI単位半径（m）です。 */
	readonly radiusMetres: number;
	/** Target / 3pt / 2pt / 1pt境界の種類です。 */
	readonly kind: ScoringRingKind;
	/** 色に依存せず意味を示す短い盤面ラベルです。 */
	readonly label: string;
	/** 既存Stone色と区別したリング色です。 */
	readonly color: string;
	/** 種類ごとに変える基準dotサイズです。 */
	readonly dotSizePixels: number;
	/** 弱い境界ほど間隔を広げるために使用するsegment間引き幅です。 */
	readonly segmentStride: number;

	/** 物理値と、色以外も含む一貫した描画styleを保持します。 */
	constructor(
		radiusMetres: number,
		kind: ScoringRingKind,
		label: string,
		color: string,
		dotSizePixels: number,
		segmentStride: number
	) {
		this.radiusMetres = radiusMetres;
		this.kind = kind;
		this.label = label;
		this.color = color;
		this.dotSizePixels = dotSizePixels;
		this.segmentStride = segmentStride;
	}
}

/** GameBalanceの現在値だけから、内側から外側へ並ぶ7本の位置ガイドを生成します。 */
export function createScoringRingDefinitions(): ScoringRingDefinition[] {
	const target: number = GameBalance.TargetOrbitRadiusMetres;
	const three: number = GameBalance.ThreePointOrbitErrorMetres;
	const two: number = GameBalance.TwoPointOrbitErrorMetres;
	const one: number = GameBalance.OnePointOrbitErrorMetres;
	return [
		new ScoringRingDefinition(target - one, ScoringRingKind.OnePointBoundary, "", "#607080", 2, 3),
		new ScoringRingDefinition(target - two, ScoringRingKind.TwoPointBoundary, "", "#7a93a8", 3, 2),
		new ScoringRingDefinition(target - three, ScoringRingKind.ThreePointBoundary, "", "#ffd166", 4, 1),
		new ScoringRingDefinition(target, ScoringRingKind.Target, "TARGET", "#8be9fd", 5, 1),
		new ScoringRingDefinition(target + three, ScoringRingKind.ThreePointBoundary, "3 PT", "#ffd166", 4, 1),
		new ScoringRingDefinition(target + two, ScoringRingKind.TwoPointBoundary, "2 PT", "#7a93a8", 3, 2),
		new ScoringRingDefinition(target + one, ScoringRingKind.OnePointBoundary, "1 PT", "#607080", 2, 3)
	];
}
