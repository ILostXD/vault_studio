"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { memo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";

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

type ColorFormatTab = "hex" | "rgb" | "hsl";

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

function hsvToHex(h: number, s: number, v: number): string {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
  } else if (h >= 120 && h < 180) {
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    b = c;
  } else if (h >= 300 && h <= 360) {
    r = c;
    b = x;
  }

  return (
    "#" +
    [r, g, b]
      .map((val) => Math.round((val + m) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const cleaned = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
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
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hex = hsvToHex(h, s, v);
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
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
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

function hsvToHsl(h: number, s: number, v: number): { h: number; s: number; l: number } {
  s /= 100;
  v /= 100;
  const l = v * (1 - s / 2);
  let sl = 0;

  if (l > 0 && l < 1) {
    sl = (v - l) / Math.min(l, 1 - l);
  }

  return {
    h,
    s: Math.round(sl * 100),
    l: Math.round(l * 100),
  };
}

function hslToHsv(h: number, s: number, l: number): { h: number; s: number; v: number } {
  s /= 100;
  l /= 100;
  const v = l + s * Math.min(l, 1 - l);
  const sv = v === 0 ? 0 : 2 * (1 - l / v);

  return {
    h,
    s: Math.round(sv * 100),
    v: Math.round(v * 100),
  };
}

function ColorFormatToggle({
  value,
  onValueChange,
}: {
  value: ColorFormatTab;
  onValueChange: (tab: ColorFormatTab) => void;
}) {
  return (
    <ToggleGroup
      size="sm"
      options={[
        { label: "HEX", value: "hex" },
        { label: "RGB", value: "rgb" },
        { label: "HSL", value: "hsl" },
      ]}
      value={value}
      onValueChange={(tab) => onValueChange(tab as ColorFormatTab)}
    />
  );
}

function ColorPresetSwatches({ onSelect }: { onSelect: (color: string) => void }) {
  return (
    <div className="space-y-1.5 pt-2 border-t border-(--control-border-subtle)">
      <span className="text-[10px] text-(--text-0)/40 font-mono font-medium">DEFAULTS</span>
      <div className="flex flex-wrap gap-1.5">
        {DEFAULT_COLORS.map((presetColor) => (
          <button
            key={presetColor}
            type="button"
            onClick={() => onSelect(presetColor)}
            className="size-7 rounded-[10px] border border-(--button-border) shadow-sm hover:scale-105 hover:brightness-110 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-[3px] focus:ring-[color-mix(in_oklab,var(--accent-blue)_35%,transparent)]"
            style={{ backgroundColor: presetColor }}
            title={presetColor}
          />
        ))}
      </div>
    </div>
  );
}

interface ColorPickerPopoverProps {
  color: string;
  onChange: (newColor: string) => void;
  onCommit: (newColor: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

function ColorPickerPopover({
  color,
  onChange,
  onCommit,
  onRemove,
  disabled = false,
}: ColorPickerPopoverProps) {
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [hexInput, setHexInput] = useState("");
  const [rInput, setRInput] = useState("");
  const [gInput, setGInput] = useState("");
  const [bInput, setBInput] = useState("");
  const [hInput, setHInput] = useState("");
  const [sInput, setSInput] = useState("");
  const [lInput, setLInput] = useState("");
  const [activeTab, setActiveTab] = useState<ColorFormatTab>("hex");

  useEffect(() => {
    setHsv(hexToHsv(color));
  }, [color]);

  useEffect(() => {
    const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const hslVal = hsvToHsl(hsv.h, hsv.s, hsv.v);

    setHexInput(hex);
    setRInput(String(rgb.r));
    setGInput(String(rgb.g));
    setBInput(String(rgb.b));
    setHInput(String(hslVal.h));
    setSInput(String(hslVal.s));
    setLInput(String(hslVal.l));
  }, [hsv]);

  const hueTrack = "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)";
  const svBackground = "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)";

  const commitHsv = (nextHsv: { h: number; s: number; v: number }) => {
    const hex = hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v);
    setHsv(nextHsv);
    onChange(hex);
    onCommit(hex);
  };

  const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value);
    const nextHsv = { ...hsv, h };
    setHsv(nextHsv);
    onChange(hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v));
  };

  const handleHueCommit = () => {
    onCommit(hsvToHex(hsv.h, hsv.s, hsv.v));
  };

  const updateColorFromPointer = (e: React.PointerEvent<HTMLDivElement>, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = Math.round(Math.max(0, Math.min(100, (x / rect.width) * 100)));
    const v = Math.round(Math.max(0, Math.min(100, (1 - y / rect.height) * 100)));
    const nextHsv = { h: hsv.h, s, v };
    setHsv(nextHsv);
    onChange(hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    updateColorFromPointer(e, el);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      updateColorFromPointer(e, e.currentTarget);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = Math.round(Math.max(0, Math.min(100, (x / rect.width) * 100)));
    const v = Math.round(Math.max(0, Math.min(100, (1 - y / rect.height) * 100)));
    onCommit(hsvToHex(hsv.h, s, v));
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    let hex = val.trim();
    if (!hex.startsWith("#")) hex = "#" + hex;

    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      commitHsv(hexToHsv(hex));
    }
  };

  const handleHexInputBlur = () => {
    let hex = hexInput.trim();
    if (!hex.startsWith("#")) hex = "#" + hex;

    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      commitHsv(hexToHsv(hex));
    } else {
      setHexInput(hsvToHex(hsv.h, hsv.s, hsv.v));
    }
  };

  const handleRgbInputChange = (channel: "r" | "g" | "b", val: string) => {
    if (channel === "r") setRInput(val);
    else if (channel === "g") setGInput(val);
    else setBInput(val);

    const rNum = channel === "r" ? Number(val) : Number(rInput);
    const gNum = channel === "g" ? Number(val) : Number(gInput);
    const bNum = channel === "b" ? Number(val) : Number(bInput);

    if (
      !isNaN(rNum) && rNum >= 0 && rNum <= 255 &&
      !isNaN(gNum) && gNum >= 0 && gNum <= 255 &&
      !isNaN(bNum) && bNum >= 0 && bNum <= 255 &&
      val !== ""
    ) {
      commitHsv(rgbToHsv(rNum, gNum, bNum));
    }
  };

  const handleRgbInputBlur = () => {
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    setRInput(String(rgb.r));
    setGInput(String(rgb.g));
    setBInput(String(rgb.b));
  };

  const handleHslInputChange = (channel: "h" | "s" | "l", val: string) => {
    if (channel === "h") setHInput(val);
    else if (channel === "s") setSInput(val);
    else setLInput(val);

    const hNum = channel === "h" ? Number(val) : Number(hInput);
    const sNum = channel === "s" ? Number(val) : Number(sInput);
    const lNum = channel === "l" ? Number(val) : Number(lInput);

    if (
      !isNaN(hNum) && hNum >= 0 && hNum <= 360 &&
      !isNaN(sNum) && sNum >= 0 && sNum <= 100 &&
      !isNaN(lNum) && lNum >= 0 && lNum <= 100 &&
      val !== ""
    ) {
      commitHsv(hslToHsv(hNum, sNum, lNum));
    }
  };

  const handleHslInputBlur = () => {
    const hslVal = hsvToHsl(hsv.h, hsv.s, hsv.v);
    setHInput(String(hslVal.h));
    setSInput(String(hslVal.s));
    setLInput(String(hslVal.l));
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`group relative size-8 rounded-full border border-white/10 shrink-0 ${!disabled ? "cursor-pointer hover:scale-105 transition-transform" : "cursor-default"}`}
          style={{ backgroundColor: color }}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[1100] overlay-surface backdrop-blur-xl border border-(--card-border) rounded-2xl p-4 shadow-2xl text-(--text-0) w-64 space-y-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 font-sans"
          sideOffset={8}
          align="start"
        >
          <ColorFormatToggle value={activeTab} onValueChange={setActiveTab} />

          <div className="flex rounded-lg overflow-hidden border border-(--control-border) h-5">
            <div className="flex-1" style={{ backgroundColor: color }} title={`Original: ${color}`} />
            <div className="w-px bg-(--control-border)" />
            <div className="flex-1" style={{ backgroundColor: hsvToHex(hsv.h, hsv.s, hsv.v) }} title={`Current: ${hsvToHex(hsv.h, hsv.s, hsv.v)}`} />
          </div>

          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative w-full h-36 rounded-xl overflow-hidden cursor-crosshair select-none touch-none border border-white/10"
            style={{
              background: svBackground,
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
            }}
          >
            <div
              className="absolute size-3 -translate-x-1.5 -translate-y-1.5 rounded-full border border-white bg-transparent pointer-events-none shadow-[0_0_2px_rgba(0,0,0,0.8),inset_0_0_2px_rgba(0,0,0,0.8)]"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
              }}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-(--text-0)/40 font-mono">
              <span>HUE</span>
              <span>{hsv.h}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={hsv.h}
              onChange={handleHueChange}
              onMouseUp={handleHueCommit}
              onTouchEnd={handleHueCommit}
              className="w-full h-2 rounded-full appearance-none cursor-pointer outline-none transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
              style={{ background: hueTrack }}
            />
          </div>

          <div className="pt-2 border-t border-(--control-border-subtle)">
            {activeTab === "hex" && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-(--text-0)/40 font-mono font-medium w-8 shrink-0">HEX</span>
                <input
                  type="text"
                  value={hexInput}
                  onChange={handleHexInputChange}
                  onBlur={handleHexInputBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleHexInputBlur()}
                  className="themed-control rounded-lg px-2 py-1 text-xs font-mono w-full outline-none focus:border-accent-blue text-center"
                />
              </div>
            )}

            {activeTab === "rgb" && (
              <div className="flex gap-2">
                {[
                  ["r", rInput, "R"],
                  ["g", gInput, "G"],
                  ["b", bInput, "B"],
                ].map(([channel, value, label]) => (
                  <div key={channel} className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleRgbInputChange(channel as "r" | "g" | "b", e.target.value)}
                      onBlur={handleRgbInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleRgbInputBlur()}
                      className="themed-control rounded-lg py-1 text-xs font-mono w-full text-center outline-none focus:border-accent-blue"
                    />
                    <span className="text-[9px] text-(--text-0)/30 font-mono font-medium">{label}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "hsl" && (
              <div className="flex gap-2">
                {[
                  ["h", hInput, "H"],
                  ["s", sInput, "S%"],
                  ["l", lInput, "L%"],
                ].map(([channel, value, label]) => (
                  <div key={channel} className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleHslInputChange(channel as "h" | "s" | "l", e.target.value)}
                      onBlur={handleHslInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleHslInputBlur()}
                      className="themed-control rounded-lg py-1 text-xs font-mono w-full text-center outline-none focus:border-accent-blue"
                    />
                    <span className="text-[9px] text-(--text-0)/30 font-mono font-medium">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!disabled && onRemove && (
            <Button
              type="button"
              onClick={onRemove}
              variant="outline"
              size="sm"
              className="w-full mt-2 text-xs font-mono text-[rgb(235,94,94)] border-red-500/25 hover:bg-red-500/10 hover:text-[rgb(235,94,94)]"
            >
              <Trash2 className="size-3.5" />
              Remove Color
            </Button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface ColorWheelPickerProps {
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

type ColorPickerProps =
  | (ColorWheelPickerProps & { variant?: "wheel" })
  | (ColorPickerPopoverProps & { variant: "popover" });

const ColorPicker = memo(
  (props: ColorPickerProps) => {
    if (props.variant === "popover") {
      return <ColorPickerPopover {...props} />;
    }

    const {
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
  } = props;
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
            <ColorFormatToggle value={activeTab} onValueChange={setActiveTab} />

            {/* Input Fields */}
            <div>
              {activeTab === "hex" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-(--text-0)/40 font-mono font-medium w-8 shrink-0">HEX</span>
                  <input
                    type="text"
                    value={hexInput}
                    onChange={(e) => setHexInput(e.target.value)}
                    onBlur={handleHexInputBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleHexInputBlur()}
                    className="themed-control rounded-lg px-2 py-1.5 text-xs font-mono w-full outline-none focus:border-accent-blue text-center transition-colors"
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
                      className="themed-control rounded-lg py-1.5 text-xs font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-(--text-0)/30 font-mono font-medium">R</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={gInput}
                      onChange={(e) => setGInput(e.target.value)}
                      onBlur={handleRgbInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleRgbInputBlur()}
                      className="themed-control rounded-lg py-1.5 text-xs font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-(--text-0)/30 font-mono font-medium">G</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={bInput}
                      onChange={(e) => setBInput(e.target.value)}
                      onBlur={handleRgbInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleRgbInputBlur()}
                      className="themed-control rounded-lg py-1.5 text-xs font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-(--text-0)/30 font-mono font-medium">B</span>
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
                      className="themed-control rounded-lg py-1.5 text-xs font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-(--text-0)/30 font-mono font-medium">H</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={sInput}
                      onChange={(e) => setSInput(e.target.value)}
                      onBlur={handleHslInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleHslInputBlur()}
                      className="themed-control rounded-lg py-1.5 text-xs font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-(--text-0)/30 font-mono font-medium">S%</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={lInput}
                      onChange={(e) => setLInput(e.target.value)}
                      onBlur={handleHslInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleHslInputBlur()}
                      className="themed-control rounded-lg py-1.5 text-xs font-mono w-full text-center outline-none focus:border-accent-blue transition-colors"
                    />
                    <span className="text-[9px] text-(--text-0)/30 font-mono font-medium">L%</span>
                  </div>
                </div>
              )}
            </div>

            <ColorPresetSwatches onSelect={applyColor} />
          </div>
        )}
      </div>
    );
  },
);

ColorPicker.displayName = "ColorPicker";

export default ColorPicker;
export { hexToHsl };
