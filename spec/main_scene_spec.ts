import {GameContext} from "@akashic/headless-akashic";
import * as path from "path";

/** 異なるheadless engine型でも共通して参照できるScene treeの最小構造です。 */
interface SceneEntityNode {
	/** 子Entityです。 */
	readonly children?: SceneEntityNode[];
	/** Labelだけが持つ表示文字列です。 */
	readonly text?: string;
}

/** Scene配下を再帰走査し、生成済みLabelの文字列を収集します。 */
function collectLabelTexts(entity: SceneEntityNode): string[] {
	const ownText: string[] = typeof entity.text === "string" ? [entity.text] : [];
	return (entity.children || []).reduce((texts: string[], child: SceneEntityNode): string[] => {
		return texts.concat(collectLabelTexts(child));
	}, ownText);
}

describe("PlanetCurling scene", (): void => {
	it("現在のアセットを読み込みSceneを構築できる", async (): Promise<void> => {
		const context: GameContext = new GameContext({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		context.step();

		expect(client.type).toBe("active");
		expect(client.game).toBeDefined();
		expect(client.game!.width).toBe(1280);
		expect(client.game!.height).toBe(720);
		expect(client.game!.fps).toBe(30);
		expect(client.game!.scene()).toBeDefined();

		await context.destroy();
	});

	it("Score Detailsと識別可能なTarget / 得点リングlabelをSceneへ構築する", async (): Promise<void> => {
		const context: GameContext = new GameContext({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		context.step();
		const sceneRoot: SceneEntityNode = client.game!.scene()! as unknown as SceneEntityNode;
		const texts: string[] = collectLabelTexts(sceneRoot);

		expect(texts).toContain("SCORE DETAILS");
		expect(texts).toContain("POS ERR");
		expect(texts).toContain("SPEED PEN. (AU eq.)");
		expect(texts).toContain("EFFECTIVE");
		expect(texts).toContain("TARGET");
		expect(texts).toContain("3 PT");
		expect(texts).toContain("2 PT");
		expect(texts).toContain("1 PT");

		await context.destroy();
	});
});
