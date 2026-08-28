import {MatchController} from "./match_controller";
import {LayoutRect, ResponsiveLayout} from "./responsive_layout";
import {RulesVisibility} from "./rules_state";
import {
	formatScoreDistanceAu,
	ScoreDetailKind,
	ScoreDetailRow,
	ScoreDetailsModel
} from "./score_details";

/** Score Detailsの開閉だけを保持し、既存modalと同じpause方針へ接続します。 */
export class ScoreDetailsOverlayState implements RulesVisibility {
	/** modal表示中ならtrueです。 */
	private visible: boolean = false;

	/** 背面のPhysics・CPU・Turnを停止すべき表示状態を返します。 */
	get isVisible(): boolean {
		return this.visible;
	}

	/** 読み取り専用modalを表示状態にします。 */
	show(): void {
		this.visible = true;
	}

	/** modalを閉じ、背面ゲームを同じ状態から再開可能にします。 */
	close(): void {
		this.visible = false;
	}
}

/** 現在Endの6 Stoneについて、得点式を再実装せず内訳を表にするAkashic Viewです。 */
export class ScoreDetailsOverlayView implements RulesVisibility {
	/** 全画面背景を含み、背面入力を受け止めるmodal rootです。 */
	readonly entity: g.E;
	/** Score Detailsを閉じる大型touch targetです。 */
	readonly closeButton: g.FilledRect;
	/** 描画とApplication pauseで共有する開閉状態です。 */
	readonly state: ScoreDetailsOverlayState;
	/** 現在End Stoneの読み取り元です。 */
	private readonly controller: MatchController;
	/** Score Details専用の配置とfont寸法です。 */
	private readonly layout: ResponsiveLayout;
	/** 開くたびに更新する題名labelです。 */
	private readonly titleLabel: g.Label;
	/** 6行×5列を固定再利用するStone内訳labelです。 */
	private readonly rowLabels: g.Label[][] = [];

	/** 現在Endを変更しない読み取り専用Score Details modalを生成します。 */
	constructor(scene: g.Scene, font: g.Font, layout: ResponsiveLayout, controller: MatchController) {
		this.controller = controller;
		this.layout = layout;
		this.state = new ScoreDetailsOverlayState();
		this.entity = new g.E({scene: scene, width: layout.logicalWidth, height: layout.logicalHeight});
		scene.append(this.entity);
		this.entity.append(new g.FilledRect({
			scene: scene,
			cssColor: "#01050a",
			opacity: 0.94,
			x: 0,
			y: 0,
			width: layout.logicalWidth,
			height: layout.logicalHeight,
			touchable: true
		}));
		this.entity.append(new g.FilledRect({
			scene: scene,
			cssColor: "#0b2033",
			x: layout.scoreDetailsOverlayRect.x,
			y: layout.scoreDetailsOverlayRect.y,
			width: layout.scoreDetailsOverlayRect.width,
			height: layout.scoreDetailsOverlayRect.height
		}));
		this.entity.append(new g.FilledRect({
			scene: scene,
			cssColor: "#102b42",
			x: layout.scoreDetailsTableRect.x,
			y: layout.scoreDetailsTableRect.y,
			width: layout.scoreDetailsTableRect.width,
			height: layout.scoreDetailsTableRect.height
		}));
		this.titleLabel = this.addLabel(scene, font, "", layout.rulesTitleFontSize,
			layout.scoreDetailsOverlayRect.x + 40, layout.scoreDetailsOverlayRect.y + 24, "#ffffff");
		this.closeButton = this.addButton(scene, font, layout.scoreDetailsCloseButtonRect, "CLOSE");
		this.addLabel(scene, font, "STONE", layout.rulesHeadingFontSize,
			layout.scoreDetailsTableRect.x + 24, layout.scoreDetailsTableRect.y + 18, "#80d8ff");
		this.addLabel(scene, font, "POS ERR", layout.rulesHeadingFontSize,
			layout.scoreDetailsTableRect.x + 170, layout.scoreDetailsTableRect.y + 18, "#80d8ff");
		this.addLabel(scene, font, "SPEED PEN. (AU eq.)", layout.rulesHeadingFontSize,
			layout.scoreDetailsTableRect.x + 360, layout.scoreDetailsTableRect.y + 18, "#80d8ff");
		this.addLabel(scene, font, "EFFECTIVE", layout.rulesHeadingFontSize,
			layout.scoreDetailsTableRect.x + 690, layout.scoreDetailsTableRect.y + 18, "#80d8ff");
		this.addLabel(scene, font, "PTS", layout.rulesHeadingFontSize,
			layout.scoreDetailsTableRect.x + 925, layout.scoreDetailsTableRect.y + 18, "#80d8ff");
		const columnOffsets: number[] = [24, 170, 360, 690, 925];
		for (let rowIndex: number = 0; rowIndex < 6; rowIndex += 1) {
			const rowLabels: g.Label[] = [];
			columnOffsets.forEach((offset: number): void => {
				rowLabels.push(this.addLabel(scene, font, "", layout.rulesBodyFontSize,
					layout.scoreDetailsTableRect.x + offset,
					layout.scoreDetailsTableRect.y + 66 + rowIndex * 54 + (rowIndex >= 3 ? 12 : 0),
					rowIndex < 3 ? "#ffb3b3" : "#b3e5fc"));
			});
			this.rowLabels.push(rowLabels);
		}
		this.addLabel(scene, font, "Final score = position error + radial-speed penalty.",
			layout.rulesBodyFontSize, layout.scoreDetailsOverlayRect.x + 48,
			layout.scoreDetailsOverlayRect.bottom - 136, "#ffd180");
		this.addLabel(scene, font, "Rings show POSITION guides; radial speed can reduce the final score.",
			layout.rulesDetailFontSize, layout.scoreDetailsOverlayRect.x + 48,
			layout.scoreDetailsOverlayRect.bottom - 98, "#b0bec5");
		this.closeButton.onPointDown.add((): void => this.close());
		this.entity.hide();
	}

	/** Score Detailsが背面のgame updateと入力を止める場合にtrueを返します。 */
	get isVisible(): boolean {
		return this.state.isVisible;
	}

	/** 現在Endの最新物理状態を読み取り、modalを最前面表示します。 */
	show(): void {
		const model: ScoreDetailsModel = ScoreDetailsModel.fromMatchController(this.controller);
		this.titleLabel.text = "SCORE DETAILS  —  END " + model.endNumber;
		this.titleLabel.invalidate();
		model.rows.forEach((row: ScoreDetailRow, index: number): void => {
			const cells: string[] = this.formatRow(row);
			this.rowLabels[index].forEach((label: g.Label, columnIndex: number): void => {
				label.text = cells[columnIndex];
				label.invalidate();
			});
		});
		this.state.show();
		this.entity.show();
	}

	/** modalを閉じ、ControllerやTrajectoryへ変更を加えません。 */
	close(): void {
		this.state.close();
		this.entity.hide();
	}

	/** 1 StoneのSI単位内訳を固定列のAU表記へ変換します。 */
	private formatRow(row: ScoreDetailRow): string[] {
		if (row.kind === ScoreDetailKind.Unreleased) return [row.stoneId, "-", "-", "-", "-"];
		if (row.kind === ScoreDetailKind.Absorbed) return [row.stoneId, "ABS", "-", "-", "0"];
		return [
			row.stoneId,
			formatScoreDistanceAu(row.evaluation!.radialDistanceErrorMetres),
			formatScoreDistanceAu(row.evaluation!.radialVelocityPenaltyMetres),
			formatScoreDistanceAu(row.evaluation!.effectiveOrbitErrorMetres),
			String(row.points)
		];
	}

	/** Score Details rootへ単一行labelを生成します。 */
	private addLabel(
		scene: g.Scene,
		font: g.Font,
		text: string,
		fontSize: number,
		x: number,
		y: number,
		color: string
	): g.Label {
		return new g.Label({
			scene: scene,
			parent: this.entity,
			font: font,
			text: text,
			fontSize: fontSize,
			x: x,
			y: y,
			textColor: color
		});
	}

	/** 大型touch targetと中央寄せlabelを生成し、buttonを返します。 */
	private addButton(scene: g.Scene, font: g.Font, rect: LayoutRect, text: string): g.FilledRect {
		const button: g.FilledRect = new g.FilledRect({
			scene: scene,
			parent: this.entity,
			cssColor: "#69404a",
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height,
			touchable: true
		});
		this.addLabel(scene, font, text, this.layout.buttonFontSize,
			rect.x + 24, rect.y + (rect.height - this.layout.buttonFontSize) / 2, "#ffffff");
		return button;
	}
}
