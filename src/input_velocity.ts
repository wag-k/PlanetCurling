import {Velocity} from "./motion";
import {Setting} from "./setting";

/**
 * 画面上のドラッグ量を物理モデルの初速度へ変換します。
 * 物理dtを引数にも参照先にも含めず、積分精度の変更から操作感を分離します。
 */
export function calculateLaunchVelocity(
	dragXPixels: number,
	dragYPixels: number,
	worldWidthMeters: number,
	viewportWidthPixels: number,
	velocityReferenceSeconds: number = Setting.InputVelocityReferenceSeconds,
	dragVelocityDivisor: number = Setting.DragVelocityDivisor
): Velocity {
	const velocityPerPixel: number =
		-worldWidthMeters / velocityReferenceSeconds / viewportWidthPixels / dragVelocityDivisor;
	return new Velocity(velocityPerPixel * dragXPixels, velocityPerPixel * dragYPixels);
}
