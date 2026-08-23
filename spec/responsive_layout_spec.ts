import {LayoutMode, LayoutRect, ResponsiveLayout} from "../src/responsive_layout";

describe("ResponsiveLayout", (): void => {
	it("1280×720論理解像度を720×720盤面と右560px HUDへ分離する", (): void => {
		const layout: ResponsiveLayout = ResponsiveLayout.calculate(1280, 720, 1920, 1080);

		expect(layout.mode).toBe(LayoutMode.DesktopLandscape);
		expect(layout.logicalWidth).toBe(1280);
		expect(layout.logicalHeight).toBe(720);
		expect(layout.boardRect).toEqual(new LayoutRect(0, 0, 720, 720));
		expect(layout.hudRect).toEqual(new LayoutRect(720, 0, 560, 720));
	});

	it.each([
		[800, 450],
		[844, 390],
		[915, 412]
	])("%d×%dのsmartphone landscapeをCompact Landscapeにする", (
		viewportWidth: number,
		viewportHeight: number
	): void => {
		const layout: ResponsiveLayout = ResponsiveLayout.calculate(
			1280,
			720,
			viewportWidth,
			viewportHeight
		);

		expect(layout.mode).toBe(LayoutMode.CompactLandscape);
		expect(layout.predictionButtonRect.height).toBeGreaterThanOrEqual(64);
		expect(layout.trailsButtonRect.height).toBeGreaterThanOrEqual(64);
		expect(layout.rulesButtonRect.height).toBeGreaterThanOrEqual(64);
		expect(layout.rulesCloseButtonRect.height).toBeGreaterThanOrEqual(64);
		expect(layout.rulesPreviousButtonRect.height).toBeGreaterThanOrEqual(64);
		expect(layout.rulesNextButtonRect.height).toBeGreaterThanOrEqual(64);
		expect(layout.buttonFontSize).toBeGreaterThanOrEqual(22);
		expect(layout.stoneTouchTargetSize).toBeGreaterThanOrEqual(100);
	});

	it.each([
		[1024, 768],
		[1366, 1024]
	])("%d×%dのtablet landscapeをDesktop layoutにする", (
		viewportWidth: number,
		viewportHeight: number
	): void => {
		const layout: ResponsiveLayout = ResponsiveLayout.calculate(
			1280,
			720,
			viewportWidth,
			viewportHeight
		);

		expect(layout.mode).toBe(LayoutMode.DesktopLandscape);
		expect(layout.screenRect.contains(layout.boardRect)).toBe(true);
		expect(layout.screenRect.contains(layout.hudRect)).toBe(true);
	});

	it("smartphone portraitは回転案内で入力をblockする", (): void => {
		const layout: ResponsiveLayout = ResponsiveLayout.calculate(1280, 720, 390, 844);

		expect(layout.mode).toBe(LayoutMode.Portrait);
		expect(layout.shouldBlockForPortrait).toBe(true);
	});

	it.each([
		[720, 1280],
		[1024, 1366]
	])("%d×%dのtablet portraitは案内中も最低限の操作を残す", (
		viewportWidth: number,
		viewportHeight: number
	): void => {
		const layout: ResponsiveLayout = ResponsiveLayout.calculate(
			1280,
			720,
			viewportWidth,
			viewportHeight
		);

		expect(layout.mode).toBe(LayoutMode.Portrait);
		expect(layout.shouldBlockForPortrait).toBe(false);
	});

	it.each([
		[1920, 1080],
		[844, 390],
		[1024, 768],
		[720, 1280]
	])("%d×%d相当でも必須HUDとResult操作が論理画面外へ出ない", (
		viewportWidth: number,
		viewportHeight: number
	): void => {
		const layout: ResponsiveLayout = ResponsiveLayout.calculate(
			1280,
			720,
			viewportWidth,
			viewportHeight
		);

		expect(layout.hudRect.contains(layout.scoreRect)).toBe(true);
		expect(layout.hudRect.contains(layout.turnRect)).toBe(true);
		expect(layout.hudRect.contains(layout.progressRect)).toBe(true);
		expect(layout.hudRect.contains(layout.stoneStatusRect)).toBe(true);
		expect(layout.hudRect.contains(layout.predictionButtonRect)).toBe(true);
		expect(layout.hudRect.contains(layout.trailsButtonRect)).toBe(true);
		expect(layout.hudRect.contains(layout.rulesButtonRect)).toBe(true);
		expect(layout.boardRect.contains(layout.resultOverlayRect)).toBe(true);
		expect(layout.resultOverlayRect.contains(layout.rematchButtonRect)).toBe(true);
		expect(layout.resultOverlayRect.contains(layout.changeModeButtonRect)).toBe(true);
		expect(layout.resultOverlayRect.contains(layout.nextEndButtonRect)).toBe(true);
		expect(layout.screenRect.contains(layout.modeSelectionOverlayRect)).toBe(true);
		expect(layout.modeSelectionOverlayRect.contains(layout.vsCpuButtonRect)).toBe(true);
		expect(layout.modeSelectionOverlayRect.contains(layout.easyDifficultyButtonRect)).toBe(true);
		expect(layout.modeSelectionOverlayRect.contains(layout.normalDifficultyButtonRect)).toBe(true);
		expect(layout.modeSelectionOverlayRect.contains(layout.hardDifficultyButtonRect)).toBe(true);
		expect(layout.modeSelectionOverlayRect.contains(layout.localTwoPlayerButtonRect)).toBe(true);
		expect(layout.modeSelectionOverlayRect.contains(layout.howToPlayButtonRect)).toBe(true);
		expect(layout.screenRect.contains(layout.rulesOverlayRect)).toBe(true);
		expect(layout.rulesOverlayRect.contains(layout.rulesContentRect)).toBe(true);
		expect(layout.rulesOverlayRect.contains(layout.rulesCloseButtonRect)).toBe(true);
		expect(layout.rulesOverlayRect.contains(layout.rulesPreviousButtonRect)).toBe(true);
		expect(layout.rulesOverlayRect.contains(layout.rulesNextButtonRect)).toBe(true);
		expect(layout.rulesOverlayRect.contains(layout.rulesPageIndicatorRect)).toBe(true);
	});

	it("activeStoneの透明touch targetを見た目より大きくして盤面内へclampする", (): void => {
		const layout: ResponsiveLayout = ResponsiveLayout.calculate(1280, 720, 844, 390);
		const visualStoneSize: number = 34;
		const centerTarget: LayoutRect = layout.calculateStoneTouchTarget(300, 300);
		const edgeTarget: LayoutRect = layout.calculateStoneTouchTarget(5, 715);

		expect(centerTarget.width).toBeGreaterThan(visualStoneSize);
		expect(centerTarget.height).toBeGreaterThan(visualStoneSize);
		expect(layout.boardRect.contains(centerTarget)).toBe(true);
		expect(layout.boardRect.contains(edgeTarget)).toBe(true);
	});

	it("activeStone中心が変わると透明touch targetも追従する", (): void => {
		const layout: ResponsiveLayout = ResponsiveLayout.calculate(1280, 720, 844, 390);
		const first: LayoutRect = layout.calculateStoneTouchTarget(200, 200);
		const second: LayoutRect = layout.calculateStoneTouchTarget(500, 400);

		expect(second.x).not.toBe(first.x);
		expect(second.y).not.toBe(first.y);
	});

	it("0以下の論理解像度・viewportを拒否する", (): void => {
		expect((): ResponsiveLayout => ResponsiveLayout.calculate(0, 720, 844, 390)).toThrow();
		expect((): ResponsiveLayout => ResponsiveLayout.calculate(1280, 720, 0, 390)).toThrow();
	});
});
