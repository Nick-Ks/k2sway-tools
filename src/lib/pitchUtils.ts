/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const CHROMATIC_FREQUENCIES: Record<string, number> = {
  'A': 440, 'A#': 466.16, 'B': 493.88, 'C': 523.25, 'C#': 554.37, 'D': 587.33, 'D#': 622.25, 'E': 659.25, 'F': 698.46, 'F#': 739.99, 'G': 783.99, 'G#': 830.61
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function getNoteFromFrequency(frequency: number, referenceA4: number = 440) {
  // Formula: n = 12 * log2(f / f0)
  // Shift to MIDI: 69 is A4
  const semitonesFromA4 = 12 * Math.log2(frequency / referenceA4);
  const midi = Math.round(semitonesFromA4) + 69;
  
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  const name = NOTE_NAMES[noteIndex];
  
  // Calculate expected freq for cents
  const expectedFrequency = referenceA4 * Math.pow(2, (midi - 69) / 12);
  const cents = Math.round(1200 * Math.log2(frequency / expectedFrequency));
  
  return {
    name,
    octave,
    cents,
    frequency
  };
}
