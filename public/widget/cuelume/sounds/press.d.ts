/**
 * The `press` theme: the same fourteen cues, each one press of a premium
 * switch, built from the Subscribe press and keycaps in DawoodUI's Artasaka
 * preview. A press clicks at 4 kHz over a deep note that swells in and rings
 * for about a second; it lets go with a lighter click at 4.8 kHz, 5 dB down.
 * Quick taps walk up a chord, C, E, A, as the video's presses do.
 *
 * Keys are the video's keycaps: one lands with a click over a body that drops
 * 480 to 305 Hz, and lifts off with a quieter click over 676 to 414 Hz.
 *
 * Outcomes are not touched, so they do not click: they are the press's note
 * on its own, with a chord that says what happened. Success is major and
 * rings into a small room, error a low, spread minor over a soft thump,
 * warning a plain fifth between them, attention a high bell ringing longest,
 * and loading one soft, low note that swells in and fades.
 *
 * Arranged for emphasis like the other themes: layers marked from "normal"
 * are ornament that subtle leaves out (a note's upper partials, the release),
 * and each cue has a layer only strong plays.
 */
export declare const PRESS: {
    /** The Subscribe press: a click over a deep C that swells in and rings, and a lighter click letting go. Quick taps walk C, E, A. */
    tap: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
        release: import("./layers.js").NoiseLayer[];
        walk: number[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A keycap landing, and lifting off quieter as the key comes up. Every stroke a slightly different key. */
    type: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
        release: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A detent: only the light click, over a small, high knock. A later option knocks higher, an earlier one lower. */
    select: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
        release: import("./layers.js").NoiseLayer[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A switch thrown: the press and a firm knock over a short, deep E, letting go lighter. Switching off knocks upward. */
    toggle: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
        release: import("./layers.js").NoiseLayer[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A lid lifting: the light click, a knock, air drawn upward and an A swelling in under it. Quick opens walk. */
    open: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
        release: import("./layers.js").NoiseLayer[];
        walk: number[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A lid shutting: a lower, duller click, air pushed out and down, and a low C, damped short, as it seats. */
    close: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** No click: C, G and E struck at once, swelling in and ringing long into a small room. */
    success: {
        masterGain: number;
        layers: import("./layers.js").ToneLayer[];
        room: number;
    };
    /** No click: a low A with the C an octave and a third above, minor and spread, over a soft thump. A calm refusal. */
    error: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
    };
    /** A swipe: the light click with air sliding past it. Going back, the air falls. */
    navigate: {
        masterGain: number;
        layers: (import("./layers.js").ToneLayer | import("./layers.js").NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** No click: a plain fifth, A and E, between success and error. Heads up, nothing broke. */
    warning: {
        masterGain: number;
        layers: import("./layers.js").ToneLayer[];
    };
    /** No click: one warm, low G that swells in softly and fades within about a second. Work has begun. */
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
        } | {
            from: "normal";
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
        } | {
            from: "strong";
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
        })[];
    };
    /** No click: one long, warm G below success, ringing into a small room. A result is there. */
    ready: {
        masterGain: number;
        layers: import("./layers.js").ToneLayer[];
        room: number;
    };
    /** No click: A and E over A, high and bell-like, ringing longest. Blocked until the user answers. */
    attention: {
        masterGain: number;
        layers: import("./layers.js").ToneLayer[];
    };
    /** A number rolling: a dial spun, air rising with it for as long as the roll (falling counting down). */
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
            from?: undefined;
        } | {
            stretch: true;
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
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
        } | {
            stretch: true;
            from: "strong";
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
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
};
