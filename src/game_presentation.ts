import {CollisionEvent, CollisionEventKind} from "./collision";
import {MatchResult} from "./match_controller";

/** 描画だけを切り替え、物理・予測計算・得点状態を変更しない表示設定です。 */
export class TrajectoryVisibility {
	/** 予測線を描く場合はtrueです。 */
	predictionVisible: boolean = true;
	/** 実軌跡を描く場合はtrueです。 */
	trailsVisible: boolean = true;

	/** 予測線表示を反転します。 */
	togglePrediction(): void {
		this.predictionVisible = !this.predictionVisible;
	}

	/** 実軌跡表示を反転します。 */
	toggleTrails(): void {
		this.trailsVisible = !this.trailsVisible;
	}
}

/** 実ゲーム衝突だけから生成し、Predictionに音や演出副作用を持たせない通知です。 */
export class CollisionPresentationEvent {
	/** 画面へ短時間表示する英語文言です。 */
	readonly text: string;
	/** 既存SEを一度再生する対象ならtrueです。 */
	readonly shouldPlaySound: boolean;
	/** 吸収をStone反発より強く描く場合はtrueです。 */
	readonly isAbsorption: boolean;

	/** ActualのCollisionEventを描画向けの値へ変換します。 */
	constructor(event: CollisionEvent) {
		this.isAbsorption = event.kind === CollisionEventKind.StoneCentralBody;
		this.text = this.isAbsorption ? "ABSORBED!" : "HIT!";
		this.shouldPlaySound = true;
	}
}

/** MatchResultを中央overlay向けの簡潔な英語文言へ変換します。 */
export function formatMatchResult(result: MatchResult): string {
	if (result === MatchResult.RedWin) return "RED WINS";
	if (result === MatchResult.BlueWin) return "BLUE WINS";
	return "DRAW";
}

/** 経過秒を0～1へclampし、HUD以外の物理状態を変更せず進捗率を返します。 */
export function calculateSimulationProgress(elapsedSeconds: number, durationSeconds: number): number {
	if (durationSeconds <= 0) return 0;
	return Math.max(0, Math.min(1, elapsedSeconds / durationSeconds));
}
