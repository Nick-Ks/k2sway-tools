/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ToolType = 'metronome' | 'tuner' | 'pitch' | 'settings';

export interface MetronomeSettings {
  bpm: number;
  timeSignature: number; // Numerator (4 in 4/4)
  subdivision: 1 | 2 | 3 | 4;
  accentFirstBeat: boolean;
  flashMode: boolean;
}

export interface TunerSettings {
  referencePitch: number; // e.g. 440, 442, 443
  mode: 'chromatic' | 'instrument';
}

export interface PitchCheckSettings {
  targetPart?: 'S' | 'A' | 'T' | 'B';
  referencePitch: number;
}
