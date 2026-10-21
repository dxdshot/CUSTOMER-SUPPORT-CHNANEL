/**
 * Rendering: turns one shaped recipe into Web Audio nodes — an oscillator
 * or filtered-noise source per layer, each swelling in along a straight line
 * and dying away exponentially. Every sound rings faintly into the shared
 * room (see output.ts), so it sounds placed in a space.
 *
 * A straight swell is heard from its first moment; an exponential one stays
 * silent for most of its length and then jumps in, heard as a late second hit.
 */
import { type Emphasis, type Shape } from "../sounds/context.js";
import type { SoundLayer, SoundRecipe } from "../sounds/layers.js";
import type { SoundName } from "../sounds/recipes.js";
import { type OutputBus } from "./output.js";
export declare const SOURCE_STOP_PADDING = 0.05;
export declare const fallTime: (decay: number) => number;
/**
 * Each cue's latest voice and how fast it lets go. A cue plays one voice at a
 * time, like one key under one finger: playing it again releases the last play
 * instead of stacking on it. Other cues ring on. Owned by engine.ts.
 */
export type Voices = Map<SoundName, {
    gain: GainNode;
    fade: number;
}>;
/** The Artasaka press lets go 85–95 ms after it presses; a play with no real let-go waits this long. */
export declare const RELEASE_GAP = 0.09;
/**
 * Which part of a gesture to play: the press, the release as it lets go, or
 * both, the release RELEASE_GAP later.
 */
export type Part = "press" | "release" | "both";
/** Everything one press decided, so its release sounds like the same press. */
export type Played = {
    recipe: SoundRecipe;
    volume: number;
    emphasis: Emphasis;
    shape: Shape;
    step: number;
};
/**
 * The layers `part` of one play sounds: arranged for its emphasis, bent by its
 * shape, strike and walk, the release starting as the gesture lets go. No Web
 * Audio here, so scripts/sound.mjs renders the same layers offline.
 */
export declare function layersFor({ recipe, emphasis, shape, step }: Pick<Played, "recipe" | "emphasis" | "shape" | "step">, part: Part): SoundLayer[];
export declare function renderRecipe(context: AudioContext, getBus: () => OutputBus, voices: Voices, sound: SoundName, played: Played, part: Part): void;
