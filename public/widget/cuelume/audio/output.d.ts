/**
 * The shared output stage: one boosted bus through a subsonic cut and a
 * soft clip, plus one faint stereo room every cue rings into. Built once per
 * AudioContext; also owns the shared noise buffer noise layers loop from.
 */
export declare const OUTPUT_GAIN = 5.8;
export declare const CLIP_KNEE = 0.7;
/** Below this nothing is heard, but deep notes would still spend headroom on it. */
export declare const SUBSONIC_HZ = 40;
/** Seconds of shared noise. Noise layers loop it from a random point, so none is made per play. */
export declare const NOISE_SECONDS = 2;
/** One context's output bus, room send target, cached noise buffer, and the voices sounding on it. Owned by engine.ts. */
export type OutputBus = {
    output: GainNode;
    room: AudioNode;
    noise: AudioBuffer | null;
    live: Set<GainNode>;
};
/**
 * Fades every voice sounding on `bus`, for a mute that should be heard at once.
 * ponytail: the room's own tail, a quarter of a second and 22 dB down, rings out; gate its return if that is ever heard
 */
export declare function silence(context: AudioContext, bus: OutputBus): void;
export declare function seeded(seed: number): () => number;
export declare function fillNoise(data: Float32Array): void;
export declare function getNoise(context: AudioContext, bus: OutputBus): AudioBuffer;
/**
 * The shared room: a short, dense burst of reflections that dies away over
 * ROOM_SECONDS. Reflections within the first 80 ms or so are what move a sound
 * out of the listener's head (Begault); a longer tail only adds distance. Its
 * two channels are independent noise, so the room is wide while the sound
 * itself stays centred.
 */
export declare const ROOM_SECONDS = 0.25;
/** The gap before the first reflection: a small room's nearest wall. */
export declare const ROOM_PREDELAY = 0.008;
/** Reflections are low-passed here: walls swallow the highs first. */
export declare const ROOM_LOWPASS = 3500;
/** How much of every cue reaches the room: about 22 dB down, faint enough to feel rather than hear. */
export declare const ROOM_SEND = 0.08;
/** 60 dB of decay, the conventional end of a room's tail. */
export declare const ROOM_DECAY_DB = 60;
export declare const ROOM_SEEDS: readonly [3110, 5639];
export declare function fillRoom(data: Float32Array, rate: number, seed: number): void;
/** Builds one context's output bus and room. Engine owns the result and builds it once. */
export declare function createOutput(context: AudioContext): OutputBus;
