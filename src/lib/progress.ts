/** Una lección de vídeo se considera completada al ver el 90 %. */
export const COMPLETE_RATIO = 0.9;

export function shouldComplete(position: number, duration: number | null | undefined) {
  return !!duration && duration > 0 && position / duration >= COMPLETE_RATIO;
}

/** Posición de reanudación: si casi terminó, vuelve al inicio. */
export function resumePosition(position: number, duration: number | null | undefined) {
  if (!duration) return Math.max(0, position);
  return duration - position < 15 ? 0 : Math.max(0, position);
}
