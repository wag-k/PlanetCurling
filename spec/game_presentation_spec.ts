import {CollisionEvent, CollisionEventKind} from "../src/collision";
import {
	calculateSimulationProgress, CollisionPresentationEvent, formatMatchResult, formatMatchResultForMode,
	TrajectoryVisibility
} from "../src/game_presentation";
import {GameMode} from "../src/game_session";
import {MatchResult} from "../src/match_controller";
import {Pos} from "../src/motion";
import {Planet} from "../src/planet";

describe("G5 presentation pure logic", (): void => {
	it("0年・5年・10年を0%・50%・100%へ変換する", (): void => {
		expect(calculateSimulationProgress(0, 10)).toBe(0);
		expect(calculateSimulationProgress(5, 10)).toBe(0.5);
		expect(calculateSimulationProgress(10, 10)).toBe(1);
	});

	it("RedWin・BlueWin・Drawを英語overlay文言へ変換する", (): void => {
		expect(formatMatchResult(MatchResult.RedWin)).toBe("RED WINS");
		expect(formatMatchResult(MatchResult.BlueWin)).toBe("BLUE WINS");
		expect(formatMatchResult(MatchResult.Draw)).toBe("DRAW");
	});

	it("Vs CPUだけYOU / CPU文言にし、Local 2Pは従来の色名を維持する", (): void => {
		expect(formatMatchResultForMode(MatchResult.RedWin, GameMode.VsCpu)).toBe("YOU WIN");
		expect(formatMatchResultForMode(MatchResult.BlueWin, GameMode.VsCpu)).toBe("CPU WINS");
		expect(formatMatchResultForMode(MatchResult.Draw, GameMode.VsCpu)).toBe("DRAW");
		expect(formatMatchResultForMode(MatchResult.BlueWin, GameMode.LocalTwoPlayer)).toBe("BLUE WINS");
	});

	it("trajectory toggleは独立した表示状態だけを変更する", (): void => {
		const visibility: TrajectoryVisibility = new TrajectoryVisibility();
		visibility.togglePrediction();
		expect(visibility.predictionVisible).toBe(false);
		expect(visibility.trailsVisible).toBe(true);
		visibility.toggleTrails();
		expect(visibility.trailsVisible).toBe(false);
	});

	it("Actual collision eventだけを音付き演出へ明示変換する", (): void => {
		const first: Planet = new Planet();
		const second: Planet = new Planet();
		const hit = new CollisionPresentationEvent(new CollisionEvent(
			CollisionEventKind.StoneStone, first, second, new Pos(1, 2), 3
		));
		const absorbed = new CollisionPresentationEvent(new CollisionEvent(
			CollisionEventKind.StoneCentralBody, first, second, new Pos(1, 2), 3
		));
		expect(hit.text).toBe("HIT!");
		expect(hit.shouldPlaySound).toBe(true);
		expect(absorbed.text).toBe("ABSORBED!");
		expect(absorbed.isAbsorption).toBe(true);
	});
});
