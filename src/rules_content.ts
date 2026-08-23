import {OrbitScoreEvaluator} from "./orbit_score";
import {PhysicalConstant} from "./physical_constant";
import {Setting} from "./setting";

/** Rules UI内の一行へ適用する意味上の表示styleです。 */
export enum RuleLineStyle {
	/** 通常の説明文です。 */
	Body = "Body",
	/** PlanetCurling固有の重要ルールです。 */
	Emphasis = "Emphasis",
	/** 初心者向け説明より弱く表示する数式・閾値です。 */
	Detail = "Detail"
}

/** 翻訳可能な一行の文言と表示上の意味を保持します。 */
export class RuleLine {
	/** 表示する英語文です。 */
	readonly text: string;
	/** 見出し以外の表示styleです。 */
	readonly style: RuleLineStyle;

	/** 一行の文言と表示styleを保持します。 */
	constructor(text: string, style: RuleLineStyle = RuleLineStyle.Body) {
		this.text = text;
		this.style = style;
	}
}

/** 1ページ内の小見出しと複数行をまとめます。 */
export class RuleSection {
	/** 小見出しです。 */
	readonly title: string;
	/** 小見出しに属する説明行です。 */
	readonly lines: RuleLine[];

	/** 小見出しと表示順を保持します。 */
	constructor(title: string, lines: RuleLine[]) {
		this.title = title;
		this.lines = lines;
	}
}

/** Rules Overlayの1ページ分をAkashic非依存データとして保持します。 */
export class RulePage {
	/** ページ最上部の題名です。 */
	readonly title: string;
	/** ページ内の表示順付きsectionです。 */
	readonly sections: RuleSection[];

	/** 題名とsectionを保持します。 */
	constructor(title: string, sections: RuleSection[]) {
		this.title = title;
		this.sections = sections;
	}
}

/** 現在のゲーム設定から生成した3ページの英語Rulesデータです。 */
export class RulesContent {
	/** Rules Overlayへ表示する3ページです。 */
	readonly pages: RulePage[];

	/** 得点定数を重複定義せず、現在のGameBalance / Settingに一致する既定Rulesを生成します。 */
	static createDefault(scoreEvaluator: OrbitScoreEvaluator = new OrbitScoreEvaluator()): RulesContent {
		const targetAu: string = RulesContent.formatAu(scoreEvaluator.targetRadiusMetres, 0);
		const threePointAu: string = RulesContent.formatAu(scoreEvaluator.threePointErrorMetres, 2);
		const twoPointAu: string = RulesContent.formatAu(scoreEvaluator.twoPointErrorMetres, 2);
		const onePointAu: string = RulesContent.formatAu(scoreEvaluator.onePointErrorMetres, 2);
		const velocityYears: string = RulesContent.formatYears(scoreEvaluator.velocityReferenceSeconds);
		const simulationYears: string = RulesContent.formatYears(Setting.SimulationDurationPerShotSeconds);
		return new RulesContent([
			new RulePage("GOAL & SCORE", [
				new RuleSection("GOAL", [
					new RuleLine("Red and Blue throw " + Setting.ShotsPerPlayer + " planets each."),
					new RuleLine("The player with the higher total score wins.")
				]),
				new RuleSection("SCORE", [
					new RuleLine("3 pts   Excellent orbit"),
					new RuleLine("2 pts   Good orbit"),
					new RuleLine("1 pt    Near the target orbit"),
					new RuleLine("0 pt    Outside the scoring range"),
					new RuleLine("Aim for the rings around the Sun.", RuleLineStyle.Emphasis)
				]),
				new RuleSection("POSITION + MOTION", [
					new RuleLine("Score depends on both distance from the target orbit", RuleLineStyle.Emphasis),
					new RuleLine("and radial speed toward or away from the Sun.", RuleLineStyle.Emphasis),
					new RuleLine("Fast motion inward or outward can lower the score.", RuleLineStyle.Emphasis)
				]),
				new RuleSection("DETAILS", [
					new RuleLine("Target orbit: " + targetAu + " from the Sun", RuleLineStyle.Detail),
					new RuleLine("Effective error = distance error + radial speed x " + velocityYears, RuleLineStyle.Detail),
					new RuleLine("3 points: <= " + threePointAu, RuleLineStyle.Detail),
					new RuleLine("2 points: <= " + twoPointAu, RuleLineStyle.Detail),
					new RuleLine("1 point: <= " + onePointAu + "   otherwise: 0 points", RuleLineStyle.Detail)
				])
			]),
			new RulePage("HOW TO PLAY", [
				new RuleSection("THROW A PLANET", [
					new RuleLine("1. Drag your active planet."),
					new RuleLine("2. The arrow shows launch direction and power."),
					new RuleLine("3. The dotted line predicts its trajectory."),
					new RuleLine("4. Release to launch."),
					new RuleLine("5. The universe then advances " + simulationYears + ".")
				]),
				new RuleSection("THE GRAVITY FIELD", [
					new RuleLine("Placed planets stay in the game.", RuleLineStyle.Emphasis),
					new RuleLine("They keep moving and their gravity changes future shots.", RuleLineStyle.Emphasis),
					new RuleLine("EVERY SHOT CHANGES THE GRAVITY FIELD.", RuleLineStyle.Emphasis)
				]),
				new RuleSection("PREDICTION / TRAIL", [
					new RuleLine("DOTTED   Predicted trajectory at the moment of launch"),
					new RuleLine("SOLID      Actual trajectory"),
					new RuleLine("Future planets can change the gravity field."),
					new RuleLine("The actual path may later differ from the prediction.", RuleLineStyle.Emphasis)
				])
			]),
			new RulePage("COLLISIONS & TACTICS", [
				new RuleSection("PLANETS CAN COLLIDE", [
					new RuleLine("Hit an opponent to knock it out of a scoring orbit,"),
					new RuleLine("change its trajectory, or send it toward the Sun.")
				]),
				new RuleSection("SUN", [
					new RuleLine("A planet that hits the Sun is absorbed.", RuleLineStyle.Emphasis),
					new RuleLine("ABSORBED: 0 points and removed from the gravity field.", RuleLineStyle.Emphasis)
				]),
				new RuleSection("CHOOSE YOUR TACTIC", [
					new RuleLine("You do not always need to aim directly for points."),
					new RuleLine("Score, defend, or attack your opponent.", RuleLineStyle.Emphasis)
				]),
				new RuleSection("VS CPU", [
					new RuleLine("You are RED. CPU is BLUE."),
					new RuleLine("Easy / Normal / Hard change shot-search precision."),
					new RuleLine("CPU plays by the same physics and scoring rules.", RuleLineStyle.Emphasis)
				])
			])
		]);
	}

	/** 既に生成済みの翻訳可能なpage dataを保持します。 */
	constructor(pages: RulePage[]) {
		if (pages.length === 0) throw new Error("rules content requires at least one page.");
		this.pages = pages;
	}

	/** metre値を現在の天文単位定数で割り、UI向けAU表記へ変換します。 */
	private static formatAu(metres: number, fractionDigits: number): string {
		return (metres / PhysicalConstant.AstroUnit).toFixed(fractionDigits) + " AU";
	}

	/** 秒数を現在の1ゲーム年設定で割り、単数・複数を含む英語表記へ変換します。 */
	private static formatYears(seconds: number): string {
		const years: number = seconds / Setting.SecondsPerYear;
		return years.toFixed(years % 1 === 0 ? 0 : 1) + (years === 1 ? " game year" : " game years");
	}
}
