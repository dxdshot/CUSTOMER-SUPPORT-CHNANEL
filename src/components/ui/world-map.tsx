"use client";

import { motion, useReducedMotion } from "motion/react";

export type MapDot = { id: string; lat: number; lng: number; label: string };

const continents = [
  "M48 73 65 54 96 43 127 47 138 57 159 59 178 70 186 88 170 96 156 113 139 113 126 135 107 138 97 121 77 118 63 99 48 96Z",
  "M117 144 143 141 159 157 171 187 161 212 150 238 132 260 118 248 119 221 107 198 112 177Z",
  "M283 70 303 58 324 63 334 76 326 92 308 98 298 109 285 101Z",
  "M289 113 320 105 346 119 359 142 352 177 336 203 314 215 298 194 291 166 277 143Z",
  "M333 63 374 49 414 54 447 45 479 58 512 49 541 63 565 82 558 105 534 111 519 128 496 127 479 145 453 133 435 112 415 114 399 101 371 105 349 89Z",
  "M442 131 457 137 468 154 459 176 444 162Z M510 138 521 141 526 160 515 163Z",
  "M493 208 520 196 546 201 567 221 557 241 523 243 495 231Z",
  "M580 228 586 240 582 257 576 247Z",
];

function project(lat: number, lng: number) {
  return { x: (lng + 180) * (640 / 360), y: (90 - lat) * (280 / 180) };
}

export default function WorldMap({ dots, onDotClick }: { dots: MapDot[]; onDotClick: (id: string) => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative w-full overflow-hidden rounded-[22px] border border-white/8 bg-[#202020]" aria-label="Map of live visitors">
      <svg viewBox="0 0 640 280" role="img" aria-label="World map" className="h-auto w-full">
        <defs>
          <pattern id="world-dots" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#777" opacity=".7" />
          </pattern>
        </defs>
        <path d="M0 70H640M0 140H640M0 210H640M80 0V280M160 0V280M240 0V280M320 0V280M400 0V280M480 0V280M560 0V280" stroke="#fff" strokeOpacity=".035" />
        {continents.map((path) => <path key={path} d={path} fill="url(#world-dots)" stroke="#696969" strokeOpacity=".28" strokeWidth=".6" />)}
        {dots.map((dot) => {
          const point = project(dot.lat, dot.lng);
          return (
            <g key={dot.id} transform={`translate(${point.x} ${point.y})`}>
              <motion.circle r="9" fill="#60a5fa" fillOpacity=".16" initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.24 }} />
              <circle r="4" fill="#93c5fd" stroke="#1e293b" strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>
      {dots.map((dot) => {
        const point = project(dot.lat, dot.lng);
        return (
          <button
            key={dot.id}
            type="button"
            aria-label={`Open ${dot.label} profile`}
            title={dot.label}
            onClick={() => onDotClick(dot.id)}
            className="absolute z-10 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            style={{ left: `${point.x / 640 * 100}%`, top: `${point.y / 280 * 100}%` }}
          />
        );
      })}
    </div>
  );
}
