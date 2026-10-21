/**
 * Layers — the building blocks every cue is made of: one tone or one burst
 * of filtered noise, shaped by an attack/decay envelope. The builders below
 * (`knock`, `struck`, `click`, …) are how themes spell real materials —
 * a struck bar, a switch click, a breath of air — out of those layers.
 */
type BaseLayer = {
    /** Seconds after the trigger that this layer starts. */
    offset?: number;
    /** Fade-in time, in seconds. */
    attack: number;
    /** Ring time: the seconds the layer takes to fall 60 dB once the attack ends. */
    decay: number;
    /** Peak volume reached at the end of the attack. */
    peak: number;
    /** If set, the layer's pitch (a tone's frequency, a noise layer's filter) glides to this value. */
    glideTo?: number;
    /** How long the glide takes, in seconds. Defaults to attack + decay. */
    glideTime?: number;
    /**
     * The lowest emphasis this layer plays at. Unset plays at every level;
     * "normal" drops out of subtle; "strong" plays only when strong.
     */
    from?: "normal" | "strong";
    /** For `count`: this layer lasts as long as the count, not only starts in step with it. */
    stretch?: true;
    /** A pitched note: it moves with the cue's walk, and lets go slowly when the cue plays again. */
    note?: true;
};
/** A single note — the building block for chimes, arpeggios, and pads. */
export type ToneLayer = BaseLayer & {
    kind: "tone";
    waveform: "sine" | "square" | "sawtooth" | "triangle";
    frequency: number;
    /** Detune in cents, for a gentle chorus/beating effect between layers. */
    detune?: number;
};
/** Filtered noise — clicks, knocks, and air. */
export type NoiseLayer = BaseLayer & {
    kind: "noise";
    filterType: "lowpass" | "highpass" | "bandpass";
    filterFrequency: number;
    filterQ?: number;
};
export type SoundLayer = ToneLayer | NoiseLayer;
/** Per-play randomness, as fractions: each layer's pitch and level move by up to ± these. */
export type Variation = {
    pitch: number;
    level: number;
};
export type SoundRecipe = {
    masterGain: number;
    layers: SoundLayer[];
    /**
     * How strongly this cue rings into the shared room, as a multiple of every
     * cue's faint send. Results that land ring in it more.
     */
    room?: number;
    vary?: Variation;
    /**
     * What the gesture sounds like as it lets go: pointer up, key up. A binding
     * plays these when the gesture lifts; `play()` plays them RELEASE_GAP after
     * the press. Outcomes have none: nothing was pressed.
     */
    release?: SoundLayer[];
    /**
     * Semitones above the note that quick repeats of the cue step through, on
     * its `note` layers only. A pause starts the walk again from the first.
     */
    walk?: number[];
};
/**
 * Success and ready ring into the room 6 dB more than the rest, about 16 dB
 * under the sound itself: a result lands in the space without sounding far.
 */
export declare const LANDED = 2;
/**
 * A knock's body: a sine struck sharp that drops to `frequency` in 18 ms, the
 * way a small hollow part answers a tap. Heard as a soft "tok", never as a
 * slide. Measured from the keycap sounds in DawoodUI's Artasaka preview.
 */
export declare const knock: (frequency: number, decay: number, peak: number, more?: Partial<ToneLayer>) => ToneLayer;
/**
 * A struck object's modes as [ratio to the fundamental, level] pairs. The
 * ratios are what tells the ear "bar" rather than "synth": real bars are
 * inharmonic.
 */
type Material = readonly (readonly [ratio: number, level: number])[];
/** A free bar, glass or metal: modes at 1, 2.76 and 5.40 times the fundamental (euphonics.org, free-free bar). */
export declare const BAR: Material;
/** A marimba bar, undercut so its second mode sits at 3.99x (STK ModalBar's marimba). Rounder than a free bar. */
export declare const MALLET: Material;
/**
 * A struck note: one sine per mode of `material`. A higher mode dies sooner,
 * so the highs go first as on any real bar, though more gently than the 1/f
 * of van den Doel and Pai's model. Upper modes are ornament that
 * subtle leaves out; `from` moves the whole note to a higher emphasis.
 */
export declare function struck(frequency: number, decay: number, peak: number, material: Material, { from }?: {
    from?: "normal" | "strong";
}): ToneLayer[];
/** Lowpass Q in dB that gives a flat, unresonant corner. Web Audio reads a lowpass Q in dB. */
export declare const FLAT_Q = -3;
/**
 * The mallet meeting the bar: 3 ms of noise, low-passed at the mallet's
 * hardness. A soft felt mallet sits near 1 kHz, a hard one near 3 kHz. It
 * makes a chord a struck object rather than a test tone.
 */
export declare const contact: (hardness: number, peak: number, more?: Partial<NoiseLayer>) => NoiseLayer;
/**
 * One resonance of a switch's click: a narrow ring that dies in about 5 ms.
 * Measured from the Subscribe press in DawoodUI's Artasaka preview.
 */
export declare const ring: (frequency: number, peak: number, more?: Partial<NoiseLayer>) => NoiseLayer;
/**
 * A click: a tight ring over a softer, wider body below it, so the energy
 * spreads the way a real switch's does. The Artasaka press rings at 4 kHz and
 * lets go at 4.8 kHz, 5 dB quieter.
 */
export declare const click: (frequency: number, peak: number, more?: Partial<NoiseLayer>) => NoiseLayer[];
/** Air moved by a part: filtered noise that sweeps from `from` to `to` Hz. */
export declare const air: (from: number, to: number, decay: number, peak: number, more?: Partial<NoiseLayer>) => NoiseLayer;
/** A dull thud: a part hitting its stop. */
export declare const thud: (frequency: number, decay: number, peak: number, more?: Partial<NoiseLayer>) => NoiseLayer;
/**
 * A deep note that swells in under a click and rings on, as the Artasaka
 * press does. With a `decay` of 1.36 s it falls about 45 dB a second, as the
 * video's does.
 * Upper partials are ornament that subtle leaves out; `from` moves the whole
 * note to a higher emphasis.
 */
export declare function note(frequency: number, decay: number, peak: number, { from }?: {
    from?: "normal" | "strong";
}): ToneLayer[];
export {};
