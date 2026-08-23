import {LayoutRect, ResponsiveLayout} from "./responsive_layout";
import {RuleLine, RuleLineStyle, RuleSection} from "./rules_content";
import {RulesOverlayState} from "./rules_state";

/** Mode SelectionとGame HUDが共有する3ページのAkashic Rules Overlayです。 */
export class RulesOverlayView {
	/** 全画面背景を含み、背面へpoint eventを通さない最前面rootです。 */
	readonly entity: g.E;
	/** CLOSE操作へ使う大型touch targetです。 */
	readonly closeButton: g.FilledRect;
	/** 前page操作へ使う大型touch targetです。 */
	readonly previousButton: g.FilledRect;
	/** 次page操作へ使う大型touch targetです。 */
	readonly nextButton: g.FilledRect;
	/** 描画とApplication pauseが共有するoverlay/page状態です。 */
	readonly state: RulesOverlayState;
	/** Rules用の矩形・font基準です。 */
	private readonly layout: ResponsiveLayout;
	/** Page titleを表示するlabelです。 */
	private readonly titleLabel: g.Label;
	/** `1 / 3`形式の現在page labelです。 */
	private readonly pageIndicatorLabel: g.Label;
	/** PREV buttonのlabelです。 */
	private readonly previousLabel: g.Label;
	/** NEXT buttonのlabelです。 */
	private readonly nextLabel: g.Label;
	/** Page切替時に再利用する本文label poolです。 */
	private readonly contentLabels: g.Label[] = [];

	/** 一度だけ生成したoverlayへ、Viewから分離済みのRules dataを描画します。 */
	constructor(scene: g.Scene, font: g.Font, layout: ResponsiveLayout, state: RulesOverlayState) {
		this.layout = layout;
		this.state = state;
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
			x: layout.rulesOverlayRect.x,
			y: layout.rulesOverlayRect.y,
			width: layout.rulesOverlayRect.width,
			height: layout.rulesOverlayRect.height
		}));
		this.entity.append(new g.FilledRect({
			scene: scene,
			cssColor: "#102b42",
			x: layout.rulesContentRect.x,
			y: layout.rulesContentRect.y,
			width: layout.rulesContentRect.width,
			height: layout.rulesContentRect.height
		}));
		this.titleLabel = this.addLabel(
			scene,
			font,
			"",
			layout.rulesTitleFontSize,
			layout.rulesOverlayRect.x + 40,
			layout.rulesOverlayRect.y + 24,
			"#ffffff"
		);
		this.closeButton = this.addButton(scene, font, layout.rulesCloseButtonRect, "CLOSE", "#69404a").button;
		const previous = this.addButton(scene, font, layout.rulesPreviousButtonRect, "< PREV", "#34516d");
		this.previousButton = previous.button;
		this.previousLabel = previous.label;
		const next = this.addButton(scene, font, layout.rulesNextButtonRect, "NEXT >", "#34516d");
		this.nextButton = next.button;
		this.nextLabel = next.label;
		this.pageIndicatorLabel = this.addLabel(
			scene,
			font,
			"",
			layout.rulesHeadingFontSize,
			layout.rulesPageIndicatorRect.x + 53,
			layout.rulesPageIndicatorRect.y + 8,
			"#b3e5fc"
		);
		for (let index: number = 0; index < 28; index += 1) {
			const label: g.Label = this.addLabel(scene, font, "", layout.rulesBodyFontSize, 0, 0, "#ffffff");
			label.hide();
			this.contentLabels.push(label);
		}
		this.closeButton.onPointDown.add((): void => this.close());
		this.previousButton.onPointDown.add((): void => {
			this.state.movePrevious();
			this.renderCurrentPage();
		});
		this.nextButton.onPointDown.add((): void => {
			this.state.moveNext();
			this.renderCurrentPage();
		});
		this.entity.hide();
	}

	/** Rules表示中でgame updateと背面入力を止める場合はtrueです。 */
	get isVisible(): boolean {
		return this.state.isVisible;
	}

	/** 1ページ目を描画してoverlayを最前面表示します。 */
	show(): void {
		this.state.show();
		this.renderCurrentPage();
		this.entity.show();
	}

	/** overlayを非表示にして、同じgame/CPU stateから再開可能にします。 */
	close(): void {
		this.state.close();
		this.entity.hide();
	}

	/** 現在page dataをlabel poolへ反映し、navigationの境界状態も更新します。 */
	private renderCurrentPage(): void {
		this.contentLabels.forEach((label: g.Label): void => label.hide());
		this.titleLabel.text = "PLANET CURLING  —  " + this.state.currentPage.title;
		this.titleLabel.invalidate();
		this.pageIndicatorLabel.text = this.state.pageIndicator;
		this.pageIndicatorLabel.invalidate();
		let labelIndex: number = 0;
		let y: number = this.layout.rulesContentRect.y + 12;
		this.state.currentPage.sections.forEach((section: RuleSection): void => {
			labelIndex = this.renderLabel(
				labelIndex,
				section.title,
				this.layout.rulesHeadingFontSize,
				this.layout.rulesContentRect.x + 22,
				y,
				"#80d8ff"
			);
			y += this.layout.rulesHeadingFontSize + 4;
			section.lines.forEach((line: RuleLine): void => {
				const detail: boolean = line.style === RuleLineStyle.Detail;
				const fontSize: number = detail ? this.layout.rulesDetailFontSize : this.layout.rulesBodyFontSize;
				const color: string = line.style === RuleLineStyle.Emphasis
					? "#ffd180"
					: detail ? "#b0bec5" : "#ffffff";
				labelIndex = this.renderLabel(
					labelIndex,
					line.text,
					fontSize,
					this.layout.rulesContentRect.x + 38,
					y,
					color
				);
				y += fontSize + 4;
			});
			y += 5;
		});
		this.updateNavigationAppearance();
	}

	/** label poolの1要素へtext/style/positionを設定して次indexを返します。 */
	private renderLabel(index: number, text: string, fontSize: number, x: number, y: number, color: string): number {
		if (index >= this.contentLabels.length) throw new Error("rules page exceeds the reusable label pool.");
		const label: g.Label = this.contentLabels[index];
		label.text = text;
		label.fontSize = fontSize;
		label.textColor = color;
		label.x = x;
		label.y = y;
		label.invalidate();
		label.modified();
		label.show();
		return index + 1;
	}

	/** Page境界のbutton色とlabel opacityを更新し、範囲外操作が無効であることを示します。 */
	private updateNavigationAppearance(): void {
		this.previousButton.cssColor = this.state.canMovePrevious ? "#34516d" : "#202c38";
		this.nextButton.cssColor = this.state.canMoveNext ? "#34516d" : "#202c38";
		this.previousLabel.opacity = this.state.canMovePrevious ? 1 : 0.45;
		this.nextLabel.opacity = this.state.canMoveNext ? 1 : 0.45;
		this.previousButton.modified();
		this.nextButton.modified();
		this.previousLabel.modified();
		this.nextLabel.modified();
	}

	/** Rules root内へ単一行labelを追加して返します。 */
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

	/** 大型touch targetと中央寄せlabelをRules rootへ追加します。 */
	private addButton(
		scene: g.Scene,
		font: g.Font,
		rect: LayoutRect,
		text: string,
		color: string
	): {button: g.FilledRect; label: g.Label} {
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
		const fontSize: number = this.layout.buttonFontSize;
		const label: g.Label = this.addLabel(
			scene,
			font,
			text,
			fontSize,
			rect.x + (rect.width - text.length * fontSize * 0.58) / 2,
			rect.y + (rect.height - fontSize) / 2,
			"#ffffff"
		);
		return {button: button, label: label};
	}
}
