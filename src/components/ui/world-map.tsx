"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import DottedMap from "dotted-map";

export type MapPoint = { lat: number; lng: number; label?: string };
export type MapDot = { id: string; start: MapPoint; end: MapPoint };

export default function WorldMap({
  dots = [],
  lineColor = "#22c55e",
  onDotClick,
}: {
  dots?: MapDot[];
  lineColor?: string;
  onDotClick: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const map = new DottedMap({ height: 100, grid: "diagonal" });
  const svgMap = map.getSVG({
    radius: 0.22,
    color: "#FFFFFF40",
    shape: "circle",
    backgroundColor: "#202020",
  });

  const projectPoint = (lat: number, lng: number) => ({
    x: (lng + 180) * (800 / 360),
    y: (90 - lat) * (400 / 180),
  });

  const createCurvedPath = (start: MapPoint, end: MapPoint) => {
    const startPoint = projectPoint(start.lat, start.lng);
    const endPoint = projectPoint(end.lat, end.lng);
    const midX = (startPoint.x + endPoint.x) / 2;
    const midY = Math.min(startPoint.y, endPoint.y) - 50;
    return `M ${startPoint.x} ${startPoint.y} Q ${midX} ${midY} ${endPoint.x} ${endPoint.y}`;
  };

  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-[18px] bg-[#202020] font-sans">
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        className="pointer-events-none h-full w-full select-none [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)]"
        alt="world map"
        height="495"
        width="1056"
        draggable={false}
      />
      <svg ref={svgRef} viewBox="0 0 800 400" className="pointer-events-none absolute inset-0 h-full w-full select-none">
        {dots.map((dot, index) => (
          <motion.path
            key={`path-${dot.id}`}
            d={createCurvedPath(dot.start, dot.end)}
            fill="none"
            stroke="url(#path-gradient)"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.15 * index, ease: "easeOut" }}
          />
        ))}
        <defs>
          <linearGradient id="path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="5%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="95%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        {dots.map((dot) => {
          const points = [projectPoint(dot.start.lat, dot.start.lng), projectPoint(dot.end.lat, dot.end.lng)];
          return (
            <g key={`points-${dot.id}`}>
              {points.map((point, index) => (
                <g key={`${dot.id}-${index}`}>
                  <circle cx={point.x} cy={point.y} r="3" fill={lineColor} />
                  <circle cx={point.x} cy={point.y} r="3" fill={lineColor} opacity="0.5">
                    <animate attributeName="r" from="3" to="10" dur="1.5s" begin={`${index * 0.25}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" begin={`${index * 0.25}s`} repeatCount="indefinite" />
                  </circle>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      {dots.map((dot) => {
        const point = projectPoint(dot.start.lat, dot.start.lng);
        return (
          <button
            key={`hit-${dot.id}`}
            type="button"
            aria-label={`Open ${dot.start.label ?? "visitor"} profile`}
            title={dot.start.label}
            onClick={() => onDotClick(dot.id)}
            className="absolute z-10 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-green-300"
            style={{ left: `${point.x / 800 * 100}%`, top: `${point.y / 400 * 100}%` }}
          />
        );
      })}
    </div>
  );
}
