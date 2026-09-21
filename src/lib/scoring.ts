/** حسابات النقاط — دوال خالصة بلا شبكة، قابلة للاختبار مباشرة. */

/**
 * نقاط «خمّن الصورة»: الصورة تبدأ مقرّبة جدًا (درجة 1) ثم تتوسّع.
 * من يخمّن والصورة ما زالت مقرّبة يأخذ نقاطًا أكثر.
 */
export function imagePoints(base: number, zoomStep: number): number {
  const factors = [1, 0.8, 0.6, 0.4, 0.2];
  const factor = factors[Math.min(factors.length - 1, Math.max(0, zoomStep - 1))];
  return Math.round(base * factor);
}
