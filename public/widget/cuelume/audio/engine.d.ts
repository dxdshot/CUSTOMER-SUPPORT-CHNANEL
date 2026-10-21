/**
 * The audio engine — the public playback API (`play`, `press`, `release`,
 * settings) and the shared `AudioContext` lifecycle. It decides what to
 * play; render.ts decides how it sounds, output.ts where it goes.
 * No audio files, no dependencies: synthesis happens live in render.ts.
 */
import { type LegacySoundName, type SoundName } from "../sounds/recipes.js";
import { type Context, type Emphasis, type InputMethod, type KeyRole } from "../sounds/context.js";
import { type ThemeName } from "../sounds/themes.js";
import { type Part } from "./render.js";
export type { Part } from "./render.js";
/**
 * Turns sound on or off. Off is heard at once: whatever is ringing fades
 * within a few milliseconds, and a press waiting for its release is forgotten.
 * Preference storage stays with the app.
 */
export declare function setEnabled(value: boolean): void;
/**
 * Switches the material of future playback. Sounds already playing finish as
 * they started; unknown names are ignored. Preference storage stays with the app.
 */
export declare function setTheme(theme: ThemeName): void;
/** Sets the volume multiplier for future playback. Preference storage stays with the app. */
export declare function setVolume(value: number): void;
/**
 * Starts audio now rather than on the first cue. Call it from a user gesture,
 * such as the click that turns sound on: some browsers only start audio
 * there, and a cue played later from code would stay silent. Resolves `true`
 * once cues can sound, `false` while the browser still blocks audio or has no
 * Web Audio. Never rejects.
 */
export declare function unlock(): Promise<boolean>;
export type PlayOptions = {
    /** Multiplier for this play only, clamped to 0–1. */
    volume?: number;
    /** How much the action matters. Invalid values play as "normal". */
    emphasis?: Emphasis;
    /** Which way the interaction moved. Shapes `select`; `back` plays `navigate`, `toggle` and `count` backwards. */
    direction?: "forward" | "back";
    /** Which key was typed. Shapes `type`. */
    key?: KeyRole;
    /** What did the activating. Shapes `tap`. */
    input?: InputMethod;
    /** How long a `count` runs, in milliseconds, clamped to 300–2000. Other cues ignore it. */
    duration?: number;
    /** The material for this play only; the active theme is unchanged. Unknown names play the active theme. */
    theme?: ThemeName;
};
/**
 * Plays a sound immediately. Safe to call from anywhere — lazily creates
 * the shared `AudioContext` on first use, resumes it if the browser
 * started it suspended (e.g. before any user gesture), and is a no-op
 * when Web Audio is unavailable (SSR, old browsers).
 */
export declare function play(sound?: SoundName, options?: PlayOptions): void;
/** @deprecated Renamed in v0.3 and removed in 1.0. See the migration table in the README. */
export declare function play(sound: LegacySoundName, options?: PlayOptions): void;
/**
 * Plays the press of a gesture that lets go later: call `release` with the
 * same cue when it lifts. For custom controls that don't use `bind()`, such as
 * a key that presses on pointerdown and lets go on pointerup.
 */
export declare function press(sound?: SoundName, options?: PlayOptions): void;
/** Lets go of the cue's last `press`. Plays nothing if that press already let go, or the theme has no release. */
export declare function release(sound?: SoundName): void;
/**
 * `play`, plus what a binding knows about the interaction. Internal to cuelume.
 * A binding plays the press as the gesture goes down and the release as it
 * lifts; a release with no press waiting plays nothing. `options` and
 * `interaction` are the press's: a release sounds like its press. `gesture`
 * names what is pressing, a key's code, so keys that overlap each let go of
 * their own press; without it a cue holds one press.
 */
export declare function playInContext(sound: unknown, options: PlayOptions | undefined, interaction: Context, part?: Part, gesture?: string): void;
