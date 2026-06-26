"use client";

import { useEffect, useRef, useState } from "react";
import { memo } from "react";

function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  s /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1));
  return (
    "#" +
    [f(0), f(8), f(4)]
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;

  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    case b:
      h = (r - g) / d + 4;
      break;
  }
  h /= 6;

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hex = hslToHex(h, s, l);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

interface ColorPickerProps {
  size?: number;
  padding?: number;
  bulletRadius?: number;
  spreadFactor?: number;
  minSpread?: number;
  maxSpread?: number;
  minLight?: number;
  maxLight?: number;
  showColorWheel?: boolean;
  numPoints?: number;
  initialAngle?: number;
  initialRadius?: number;
  onColorChange?: (colors: string[]) => void;
}

const ColorPicker = memo(
  ({
    size = 280,
    padding = 20,
    bulletRadius = 24,
    spreadFactor = 0.4,
    minSpread = Math.PI / 1.5,
    maxSpread = Math.PI / 3,
    minLight = 15,
    maxLight = 90,
    showColorWheel = false,
    numPoints = 1,
    initialAngle,
    initialRadius,
    onColorChange,
  }: ColorPickerProps) => {
    const RADIUS = size / 2 - padding;

    const [angle, setAngle] = useState(initialAngle ?? -Math.PI / 2);
    const [radius, setRadius] = useState(initialRadius ?? RADIUS * 0.7);
    const [drag, setDrag] = useState(false);

    const ref = useRef<HTMLCanvasElement>(null);

    const hue = (angle * 180) / Math.PI;
    const light = maxLight * (radius / RADIUS);
    const color = hslToHex(hue, 100, light);

    const normalizedRadius = radius / RADIUS;
    const spread =
      (minSpread + (maxSpread - minSpread) * Math.pow(normalizedRadius, 3)) *
      spreadFactor;

    const bx1 = size / 2 + Math.cos(angle - spread) * radius;
    const by1 = size / 2 + Math.sin(angle - spread) * radius;
    const bx2 = size / 2 + Math.cos(angle + spread) * radius;
    const by2 = size / 2 + Math.sin(angle + spread) * radius;

    const angle1 = angle - spread;
    const angle2 = angle + spread;
    const hue1 = (angle1 * 180) / Math.PI;
    const hue2 = (angle2 * 180) / Math.PI;
    const light1 = maxLight * (radius / RADIUS);
    const light2 = maxLight * (radius / RADIUS);
    const color1 = hslToHex(hue1, 100, light1);
    const color2 = hslToHex(hue2, 100, light2);

    useEffect(() => {
      const ctx = ref.current!.getContext("2d")!;
      ctx.clearRect(0, 0, size, size);

      ctx.beginPath();
      ctx.arc(size / 2, size / 2, RADIUS, 0, Math.PI * 2);
      ctx.clip();

      for (let r = 0; r <= RADIUS; r++) {
        for (let a = 0; a < 360; a += 1) {
          const rad = (a * Math.PI) / 180;
          const x = size / 2 + Math.cos(rad) * r;
          const y = size / 2 + Math.sin(rad) * r;
          const lightness = minLight + (maxLight - minLight) * (r / RADIUS);
          ctx.beginPath();
          ctx.strokeStyle = hslToHex(a, 100, lightness);
          ctx.moveTo(x, y);
          ctx.lineTo(x + 1, y + 1);
          ctx.stroke();
        }
      }
    }, [size, RADIUS, minLight, maxLight]);

    const onColorChangeRef = useRef(onColorChange);
    onColorChangeRef.current = onColorChange;

    useEffect(() => {
      const colors =
        numPoints === 1
          ? [color]
          : numPoints === 2
            ? [color2, color]
            : [color2, color, color1];
      onColorChangeRef.current?.(colors);
    }, [color, color1, color2, numPoints]);

    const DEFAULT_COLORS = [
      "#ffba00", // Vault Yellow
      "#00d4ff", // Cyan
      "#ff007f", // Neon Pink
      "#8a2be2", // Purple
      "#00e676", // Green
      "#ff3d00", // Red
      "#ff9100", // Orange
      "#e0e0e0", // Silver
    ];

    const [hexInput, setHexInput] = useState("");
    const [rInput, setRInput] = useState("");
    const [gInput, setGInput] = useState("");
    const [bInput, setBInput] = useState("");
    const [hInput, setHInput] = useState("");
    const [sInput, setSInput] = useState("");
    const [lInput, setLInput] = useState("");
    const [activeTab, setActiveTab] = useState<"hex" | "rgb" | "hsl">("hex");

    // Sync inputs when color changes via drag
    useEffect(() => {
      if (drag) return; // Don't sync while dragging to avoid lag
      const hslVal = hexToHsl(color);
      const rgbVal = hslToRgb(hslVal.h, hslVal.s, hslVal.l);
      setHexInput(color);
      setRInput(String(rgbVal.r));
      setGInput(String(rgbVal.g));
      setBInput(String(rgbVal.b));
      setHInput(String(Math.round(hslVal.h)));
      setSInput(String(Math.round(hslVal.s)));
      setLInput(String(Math.round(hslVal.l)));
    }, [color, drag]);

    const applyColor = (hex: string) => {
      const hslVal = hexToHsl(hex);
      const newRadius = (hslVal.l / maxLight) * RADIUS;
      const newAngle = (hslVal.h * Math.PI) / 180;
      setRadius(Math.max(0, Math.min(RADIUS, newRadius)));
      setAngle(newAngle);
    };

    const handleHexInputBlur = () => {
      let cleaned = hexInput.trim();
      if (!cleaned.startsWith("#")) cleaned = "#" + cleaned;
      if (/^#[0-9A-F]{6}$/i.test(cleaned)) {
        applyColor(cleaned);
      } else {
        setHexInput(color);
      }
    };

    const handleRgbInputBlur = () => {
      const rNum = Number(rInput);
      const gNum = Number(gInput);
      const bNum = Number(bInput);
      if (
        !isNaN(rNum) && rNum >= 0 && rNum <= 255 &&
        !isNaN(gNum) && gNum >= 0 && gNum <= 255 &&
        !isNaN(bNum) && bNum >= 0 && bNum <= 255
      ) {
        const hex = "#" + [rNum, gNum, bNum].map(x => Math.round(x).toString(16).padStart(2, "0")).join("");
        applyColor(hex);
      } else {
        const hslVal = hexToHsl(color);
        const rgbVal = hslToRgb(hslVal.h, hslVal.s, hslVal.l);
        setRInput(String(rgbVal.r));
        setGInput(String(rgbVal.g));
        setBInput(String(rgbVal.b));
      }
    };

    const handleHslInputBlur = () => {
      const hNum = Number(hInput);
      const sNum = Number(sInput);
      const lNum = Number(lInput);
      if (
        !isNaN(hNum) && hNum >= 0 && hNum <= 360 &&
        !isNaN(sNum) && sNum >= 0 && sNum <= 100 &&
        !isNaN(lNum) && lNum >= 0 && lNum <= 100
      ) {
        const hex = hslToHex(hNum, sNum, lNum);
        applyColor(hex);
      } else {
        const hslVal = hexToHsl(color);
        setHInput(String(Math.round(hslVal.h)));
        setSInput(String(Math.round(hslVal.s)));
        setLInput(String(Math.round(hslVal.l)));
      }
    };

    function setFromPointer(e: React.PointerEvent) {
      const rect = ref.current!.getBoundingClientRect();
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      let r = Math.sqrt(x * x + y * y);
      let a = Math.atan2(y, x);
      if (a < 0) a += 2 * Math.PI;
      r = Math.max(0, Math.min(RADIUS, r));
      setAngle(a);
      setRadius(r);
    }

    function onPointerDown(e: React.PointerEvent) {
      setDrag(true);
      setFromPointer(e);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: React.PointerEvent) {
      if (!drag) return;
      setFromPointer(e);
    }
    function onPointerUp() {
      if (drag) {
        setDrag(false);
      }
    }

    const bx = size / 2 + Math.cos(angle) * radius;
    const by = size / 2 + Math.sin(angle) * radius;

    return (
      <div className="flex flex-col items-center gap-4 w-full">
        <div
          style={{
            width: size,
            height: size,
          }}
          className="select-none relative"
        >
          <canvas
            ref={ref}
            width={size}
            height={size}
            className={`rounded-full ${!showColorWheel && "opacity-0"}`}
          />

          {numPoints >= 2 && (
            <div
              className="absolute rounded-full border-2 border-white/80 shadow pointer-events-none opacity-90 z-20"
              style={{
                left: bx2 - bulletRadius / 1.7,
                top: by2 - bulletRadius / 1.7,
                width: bulletRadius * 1.2,
                height: bulletRadius * 1.2,
                background: color2,
              }}
            />
          )}

          <div
            className="absolute rounded-full border-[3px] border-white shadow-lg cursor-grab touch-none z-30"
            style={{
              left: bx - bulletRadius * 0.7,
              top: by - bulletRadius * 0.7,
              width: bulletRadius * 1.4,
              height: bulletRadius * 1.4,
              background: color,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />

          {numPoints >= 3 && (
            <div
              className="absolute rounded-full border-2 border-white/80 shadow pointer-events-none opacity-90 z-20"
              style={{
                left: bx1 - bulletRadius / 1.7,
                top: by1 - bulletRadius / 1.7,
                width: bulletRadius * 1.2,
                height: bulletRadius * 1.2,
                background: color1,
              }}
            />
          )}
        </div>

        {showColorWheel && (
          <div className="w-full max-w-[280px] space-y-4">
            {/* Header tabs */}
            <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/5">
              {(["hex", "rgb", "hsl"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 text-[10px] uppercase font-mono font-medium rounded-md transition-all cursor-pointer ${
                    activeTab === tab
                      ? "bg-white/10 text-white shadow-xs"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Input Fields */}
            <div>
              {activeTab === "hex" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 font-mono font-medium w-8 shrink-0">HEX</span>
                  <input
                    type="text"
                    value={hexInput}
                    onChange={(e) => setHexInput(e.target.value)}
                    onBlur={handleHexInputBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleHexInputBlur()}
                    className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono w-full outline-none focus:border-accent-blue text-center transition-colors"
                  />
                </div>
              )}

              {activeTab === "rgb" && (
                <div className="flex gap-2">
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={rInput}
                      onChange={(e) => setRInput(e.target.value)}
                      onBlur={handleRgbInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleRgbInputBlur()}
                      className="bg-black/40 border border-white/10 rounded-lg py-1.5 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-white/30 font-mono font-medium">R</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={gInput}
                      onChange={(e) => setGInput(e.target.value)}
                      onBlur={handleRgbInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleRgbInputBlur()}
                      className="bg-black/40 border border-white/10 rounded-lg py-1.5 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-white/30 font-mono font-medium">G</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={bInput}
                      onChange={(e) => setBInput(e.target.value)}
                      onBlur={handleRgbInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleRgbInputBlur()}
                      className="bg-black/40 border border-white/10 rounded-lg py-1.5 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-white/30 font-mono font-medium">B</span>
                  </div>
                </div>
              )}

              {activeTab === "hsl" && (
                <div className="flex gap-2">
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={hInput}
                      onChange={(e) => setHInput(e.target.value)}
                      onBlur={handleHslInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleHslInputBlur()}
                      className="bg-black/40 border border-white/10 rounded-lg py-1.5 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-white/30 font-mono font-medium">H</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={sInput}
                      onChange={(e) => setSInput(e.target.value)}
                      onBlur={handleHslInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleHslInputBlur()}
                      className="bg-black/40 border border-white/10 rounded-lg py-1.5 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-white/30 font-mono font-medium">S%</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={lInput}
                      onChange={(e) => setLInput(e.target.value)}
                      onBlur={handleHslInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleHslInputBlur()}
                      className="bg-black/40 border border-white/10 rounded-lg py-1.5 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-white/30 font-mono font-medium">L%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Default Colors */}
            <div className="space-y-1.5 pt-2 border-t border-white/5">
              <span className="text-[10px] text-white/40 font-mono font-medium">DEFAULTS</span>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_COLORS.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyColor(c)}
                    className="size-6 rounded-md border border-white/10 hover:scale-110 hover:border-white/30 active:scale-95 transition-all cursor-pointer"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

ColorPicker.displayName = "ColorPicker";

export default ColorPicker;
export { hexToHsl };
