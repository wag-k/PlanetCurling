import {RulePage, RulesContent} from "./rules_content";

/** Rules表示状態の読取だけをpause/input gateへ公開します。 */
export interface RulesVisibility {
	/** Rulesが背面のゲーム進行と入力を止める場合はtrueです。 */
	readonly isVisible: boolean;
}

/** 複数のmodal表示状態をまとめ、いずれか表示中なら背面ゲームを停止します。 */
export class ModalVisibilityGroup implements RulesVisibility {
	/** RulesやScore Detailsなど、pause方針を共有する読み取り専用状態です。 */
	readonly visibilities: RulesVisibility[];

	/** 指定したmodal状態を同じApplication gateへまとめます。 */
	constructor(visibilities: RulesVisibility[]) {
		this.visibilities = visibilities.slice();
	}

	/** 1つでも表示中のmodalがある場合にtrueを返します。 */
	get isVisible(): boolean {
		return this.visibilities.some((visibility: RulesVisibility): boolean => visibility.isVisible);
	}
}

/** 表示中pageとoverlay開閉をAkashic描画から分離して管理します。 */
export class RulesOverlayState implements RulesVisibility {
	/** 表示する翻訳可能なRulesデータです。 */
	readonly content: RulesContent;
	/** 0始まりの現在pageです。 */
	private currentIndex: number = 0;
	/** overlayが全画面入力をblockしている場合はtrueです。 */
	private visible: boolean = false;

	/** page dataを保持し、非表示の1ページ目から開始します。 */
	constructor(content: RulesContent) {
		this.content = content;
	}

	/** Rulesがgame updateと背面入力を止める場合はtrueです。 */
	get isVisible(): boolean {
		return this.visible;
	}

	/** 0始まりの現在page indexです。 */
	get pageIndex(): number {
		return this.currentIndex;
	}

	/** 現在表示するpage dataです。 */
	get currentPage(): RulePage {
		return this.content.pages[this.currentIndex];
	}

	/** `1 / 3`形式のpage indicatorです。 */
	get pageIndicator(): string {
		return (this.currentIndex + 1) + " / " + this.content.pages.length;
	}

	/** 前pageへ移動できる場合はtrueです。 */
	get canMovePrevious(): boolean {
		return this.currentIndex > 0;
	}

	/** 次pageへ移動できる場合はtrueです。 */
	get canMoveNext(): boolean {
		return this.currentIndex < this.content.pages.length - 1;
	}

	/** どの入口から開いても1ページ目を表示し、pauseを開始します。 */
	show(): void {
		this.currentIndex = 0;
		this.visible = true;
	}

	/** 現在pageを維持したままoverlayを閉じ、次frameから再開可能にします。 */
	close(): void {
		this.visible = false;
	}

	/** 最終pageを超えずに次pageへ進みます。 */
	moveNext(): void {
		if (this.canMoveNext) this.currentIndex += 1;
	}

	/** 1ページ目より前へ行かずに前pageへ戻ります。 */
	movePrevious(): void {
		if (this.canMovePrevious) this.currentIndex -= 1;
	}
}

/** Rules表示中のframe進行と人間入力を同じ条件で停止するApplication gateです。 */
export class RulesInteractionGate {
	/** Rules Overlayと共有する読取専用表示状態です。 */
	readonly visibility: RulesVisibility;

	/** Viewと同じ表示状態を参照するgateを生成します。 */
	constructor(visibility: RulesVisibility) {
		this.visibility = visibility;
	}

	/** 非表示中だけsimulation・turn・CPUを含む1frame分の処理を実行します。 */
	runFrame(action: () => void): boolean {
		if (this.visibility.isVisible) return false;
		action();
		return true;
	}

	/** 非表示中だけdrag/release等のhuman input処理を実行します。 */
	runHumanInput(action: () => void): boolean {
		if (this.visibility.isVisible) return false;
		action();
		return true;
	}
}
