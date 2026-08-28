import {CurlingStone, MatchController, Player} from "./match_controller";
import {OrbitEvaluation} from "./orbit_score";
import {PhysicalConstant} from "./physical_constant";

/** Score Detailsに表示する現在End Stoneの状態です。 */
export enum ScoreDetailKind {
	/** まだリリースされておらず得点評価の対象外です。 */
	Unreleased = "Unreleased",
	/** 太陽へ吸収され、内訳なしの0点です。 */
	Absorbed = "Absorbed",
	/** 現在の物理状態から得点内訳を評価できるStoneです。 */
	Scored = "Scored"
}

/** 現在EndのStone 1個について、SI単位の得点内訳を保持する読み取り専用行です。 */
export class ScoreDetailRow {
	/** R1 / B2形式の現在End内Stone IDです。 */
	readonly stoneId: string;
	/** 未投球・吸収・通常評価を区別する状態です。 */
	readonly kind: ScoreDetailKind;
	/** 通常評価Stoneだけが持つOrbitScoreEvaluator由来のSI単位内訳です。 */
	readonly evaluation?: OrbitEvaluation;

	/** Stone ID、表示状態、任意の純粋評価結果を保持します。 */
	constructor(stoneId: string, kind: ScoreDetailKind, evaluation?: OrbitEvaluation) {
		this.stoneId = stoneId;
		this.kind = kind;
		this.evaluation = evaluation;
	}

	/** 現在得点を返し、未投球だけundefined、吸収済みは0とします。 */
	get points(): number | undefined {
		if (this.kind === ScoreDetailKind.Unreleased) return undefined;
		if (this.kind === ScoreDetailKind.Absorbed) return 0;
		return this.evaluation!.points;
	}
}

/** 現在Endの6 Stoneを固定順で読み取り、Score Details用の純粋な行へ変換します。 */
export class ScoreDetailsModel {
	/** 表示対象の現在End番号です。 */
	readonly endNumber: number;
	/** R1～R3、B1～B3の順に並ぶ現在Endだけの内訳です。 */
	readonly rows: ScoreDetailRow[];

	/** MatchControllerを変更せず、現在EndのStoneだけをその場で評価します。 */
	static fromMatchController(controller: MatchController): ScoreDetailsModel {
		const rows: ScoreDetailRow[] = [];
		ScoreDetailsModel.appendPlayerRows(rows, controller, Player.Red, "R");
		ScoreDetailsModel.appendPlayerRows(rows, controller, Player.Blue, "B");
		return new ScoreDetailsModel(controller.currentEndNumber, rows);
	}

	/** 現在End番号と表示行を保持します。 */
	constructor(endNumber: number, rows: ScoreDetailRow[]) {
		this.endNumber = endNumber;
		this.rows = rows;
	}

	/** 指定プレイヤーの3投をStone番号順で内訳行へ追加します。 */
	private static appendPlayerRows(
		rows: ScoreDetailRow[],
		controller: MatchController,
		player: Player,
		prefix: string
	): void {
		for (let shotNumber: number = 1; shotNumber <= controller.shotsPerPlayerPerEnd; shotNumber += 1) {
			const stone: CurlingStone | undefined = controller.stones.filter(
				(value: CurlingStone): boolean => value.owner === player && value.shotNumber === shotNumber
			)[0];
			const stoneId: string = prefix + shotNumber;
			if (stone === undefined || !stone.isReleased) {
				rows.push(new ScoreDetailRow(stoneId, ScoreDetailKind.Unreleased));
			} else if (stone.isAbsorbed) {
				rows.push(new ScoreDetailRow(stoneId, ScoreDetailKind.Absorbed));
			} else {
				rows.push(new ScoreDetailRow(
					stoneId,
					ScoreDetailKind.Scored,
					controller.scoreEvaluator.evaluate(stone.body, controller.centralBody)
				));
			}
		}
	}
}

/** Score Detailsの距離値をSI単位から比較しやすいAU表記へ変換します。 */
export function formatScoreDistanceAu(metres: number): string {
	return (metres / PhysicalConstant.AstroUnit).toFixed(2) + " AU";
}
