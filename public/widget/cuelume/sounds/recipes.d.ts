/**
 * The sound palette — the fourteen canonical cues, built from layers.ts.
 * Each cue names an interface job, not a synthesis style, and has its own
 * distinct shape rather than being a volume/EQ tweak on the same click.
 * Retired v0.2 names live on as aliases until 1.0.
 */
export declare const RECIPES: {
    /**
     * A small glassy tap — buttons, links, nav. A nail's tick, a soft knock of
     * body, then the glass ringing briefly: the fundamental is two near-identical modes that beat
     * slowly, as real glass shimmers, and the upper mode sits at the glass-bar
     * ratio 2.76x, dying faster than the fundamental.
     */
    tap: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | {
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
        })[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /**
     * One keyboard keystroke — the switch's click, the keycap's clack, and the
     * thock of bottoming out, all in one strike. Every stroke
     * lands at a slightly different pitch and weight, like different keys.
     */
    type: {
        masterGain: number;
        layers: ({
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            from?: undefined;
        } | {
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
        } | {
            from: "strong";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
        })[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A crisp detent over a small wooden knock — dropdowns, menus, lists. */
    select: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | {
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
        })[];
    };
    /** A switch snapping over: one crisp click with a small knock of body. Switching off knocks upward. */
    toggle: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | {
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            from?: undefined;
        } | {
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
        })[];
    };
    /** Air drawing upward with a light note swelling inside it: one breath as a panel opens — menus, drawers, dialogs. */
    open: {
        masterGain: number;
        layers: ({
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            waveform?: undefined;
            frequency?: undefined;
            from?: undefined;
        } | {
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            glideTo?: undefined;
            glideTime?: undefined;
            filterQ?: undefined;
            from?: undefined;
        } | {
            from: "normal";
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            glideTo?: undefined;
            glideTime?: undefined;
            filterQ?: undefined;
        } | {
            from: "strong";
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
            waveform?: undefined;
            frequency?: undefined;
        })[];
    };
    /** The same air falling shut over a low, damped mallet note — closing and dismissing. */
    close: {
        masterGain: number;
        layers: ({
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            waveform?: undefined;
            frequency?: undefined;
            from?: undefined;
        } | {
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            glideTo?: undefined;
            glideTime?: undefined;
            filterQ?: undefined;
            from?: undefined;
        } | {
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
            waveform?: undefined;
            frequency?: undefined;
        } | {
            from: "strong";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
            waveform?: undefined;
            frequency?: undefined;
        })[];
    };
    /** One soft mallet chord, C, G and E spread wide so no two notes rub, struck with felt in a small room — confirmed completion. */
    success: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
        room: number;
    };
    /** One muted low mallet chord, D with the F a tenth above, spread so it never rubs, short — a calm, recoverable refusal. */
    error: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
    };
    /** A soft whoosh whose air rises as it passes — routes, pages, galleries, carousels. */
    navigate: {
        masterGain: number;
        layers: ({
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            from?: undefined;
        } | {
            from: "normal";
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
        } | {
            from: "strong";
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
        })[];
    };
    /** One mallet fifth, A and E, neither bright nor low: between success and error. */
    warning: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
    };
    /** One low, muted note that swells in and fades away over about a second, never struck: work has begun, nothing has landed. */
    loading: {
        masterGain: number;
        layers: ({
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            from?: undefined;
            filterType?: undefined;
            filterFrequency?: undefined;
            filterQ?: undefined;
        } | {
            from: "normal";
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            waveform?: undefined;
            frequency?: undefined;
        } | {
            from: "strong";
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            filterQ?: undefined;
        })[];
    };
    /**
     * One warm glass note, G, below success, in its small room: a result is
     * there. A second mode a hertz sharp lets the glass shimmer once as it
     * rings, too slow to be heard as a wobble.
     */
    ready: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
        room: number;
    };
    /**
     * One high glass bell, A and E struck together, ringing longest: blocked
     * until the user answers. The A's twin sits 2 Hz sharp, so the bell swells
     * once rather than warbling.
     */
    attention: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
    };
    /**
     * A number rolling to a new value: one breath of air that rises with the
     * count (and falls counting down) over a soft glass note, lasting as long
     * as the roll.
     */
    count: {
        masterGain: number;
        layers: ({
            stretch: true;
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            waveform?: undefined;
            frequency?: undefined;
            from?: undefined;
        } | {
            stretch: true;
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            glideTo?: undefined;
            glideTime?: undefined;
            filterQ?: undefined;
            from?: undefined;
        } | {
            stretch: true;
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            waveform?: undefined;
            frequency?: undefined;
        } | {
            stretch: true;
            from: "strong";
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            glideTo?: undefined;
            glideTime?: undefined;
            filterQ?: undefined;
        })[];
        vary: {
            pitch: number;
            level: number;
        };
    };
};
export type SoundName = keyof typeof RECIPES;
/** All canonical cue names, derived from the recipe palette. */
export declare const sounds: readonly SoundName[];
/** The v0.2 palette, mapped to the cue that now does each job. Removed in 1.0. */
declare const ALIASES: {
    readonly chime: "success";
    readonly sparkle: "success";
    readonly droplet: "close";
    readonly bloom: "open";
    readonly whisper: "select";
    readonly tick: "select";
    readonly press: "tap";
    readonly release: "tap";
    readonly page: "navigate";
    readonly pulse: "tap";
    readonly scan: "select";
    readonly arrival: "navigate";
};
export type LegacySoundName = keyof typeof ALIASES;
/** Maps a canonical or deprecated name to its canonical cue; anything else is `null`. */
export declare function resolveSound(value: unknown): SoundName | null;
export {};
