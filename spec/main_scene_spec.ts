import {GameContext} from "@akashic/headless-akashic";
import * as path from "path";

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
});
