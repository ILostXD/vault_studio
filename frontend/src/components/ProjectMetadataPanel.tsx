import { useState, useEffect, useRef, useCallback } from "react";
import type React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Filter as ProgressFilter } from "virtual:refractionFilter?width=14&height=24&radius=8&bezelWidth=10&glassThickness=50&refractiveIndex=1.48&bezelType=convex_squircle";
import * as Popover from "@radix-ui/react-popover";
import { Star, Calendar, Percent, Music, Link, Info, Palette, Clock, X, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useUpdateProject } from "@/hooks/useProjects";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "@/routes/__root";
import type { Project } from "@/types/api";
import { usePreferences } from "@/contexts/PreferencesContext";

import spotifyLogo from "../../assets/Spotify_icon.svg.png";
import appleMusicLogo from "../../assets/Apple_Music_icon.svg.png";
import youtubeMusicLogo from "../../assets/Youtube_Music_icon.svg.png";
import tidalLogo from "../../assets/Tidal_(service)_logo_only.svg";
import deezerLogo from "../../assets/Deezer_New_Icon.svg.png";
import bandcampLogo from "../../assets/bandcamp-button-circle-aqua-512-DR-rk-YT.png";
import soundcloudLogo from "../../assets/145809.png";

interface ProjectMetadataPanelProps {
  project: Project;
  canEdit: boolean;
  onClose?: () => void;
}


const PLATFORMS = ["Spotify", "Apple Music", "YouTube Music", "Tidal", "Deezer", "Bandcamp", "SoundCloud"];

// HSV <-> RGB <-> HSL <-> Hex color conversion helpers
function hsvToHex(h: number, s: number, v: number): string {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h <= 360) {
    r = c; g = 0; b = x;
  }
  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);
  return (
    "#" +
    [red, green, blue]
      .map((val) => val.toString(16).padStart(2, "0"))
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
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h <= 360) {
    r = c; g = 0; b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
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
    h: h,
    s: Math.round(sl * 100),
    l: Math.round(l * 100)
  };
}

function hslToHsv(h: number, s: number, l: number): { h: number; s: number; v: number } {
  s /= 100;
  l /= 100;
  const v = l + s * Math.min(l, 1 - l);
  const sv = v === 0 ? 0 : 2 * (1 - l / v);
  return {
    h: h,
    s: Math.round(sv * 100),
    v: Math.round(v * 100)
  };
}



interface ColorPickerDropdownProps {
  color: string;
  onChange: (newColor: string) => void;
  onCommit: (newColor: string) => void;
  onRemove?: () => void;
  disabled: boolean;
}

function ColorPickerDropdown({ color, onChange, onCommit, onRemove, disabled }: ColorPickerDropdownProps) {
  const [hsv, setHsv] = useState(() => hexToHsv(color));

  useEffect(() => {
    setHsv(hexToHsv(color));
  }, [color]);

  const [hexInput, setHexInput] = useState("");
  const [rInput, setRInput] = useState("");
  const [gInput, setGInput] = useState("");
  const [bInput, setBInput] = useState("");
  const [hInput, setHInput] = useState("");
  const [sInput, setSInput] = useState("");
  const [lInput, setLInput] = useState("");

  const [activeTab, setActiveTab] = useState<"hex" | "rgb" | "hsl">("hex");

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



  const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value);
    const newHsv = { ...hsv, h };
    setHsv(newHsv);
    onChange(hsvToHex(h, hsv.s, hsv.v));
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
    setHsv({ h: hsv.h, s, v });
    onChange(hsvToHex(hsv.h, s, v));
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
      const newHsv = hexToHsv(hex);
      setHsv(newHsv);
      onChange(hex);
      onCommit(hex);
    }
  };

  const handleHexInputBlur = () => {
    let hex = hexInput.trim();
    if (!hex.startsWith("#")) hex = "#" + hex;
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      const newHsv = hexToHsv(hex);
      setHsv(newHsv);
      onChange(hex);
      onCommit(hex);
    } else {
      setHexInput(hsvToHex(hsv.h, hsv.s, hsv.v));
    }
  };

  const handleRgbInputChange = (channel: "r" | "g" | "b", val: string) => {
    if (channel === "r") setRInput(val);
    else if (channel === "g") setGInput(val);
    else if (channel === "b") setBInput(val);

    const rNum = channel === "r" ? Number(val) : Number(rInput);
    const gNum = channel === "g" ? Number(val) : Number(gInput);
    const bNum = channel === "b" ? Number(val) : Number(bInput);

    if (
      !isNaN(rNum) && rNum >= 0 && rNum <= 255 &&
      !isNaN(gNum) && gNum >= 0 && gNum <= 255 &&
      !isNaN(bNum) && bNum >= 0 && bNum <= 255 &&
      val !== ""
    ) {
      const newHsv = rgbToHsv(rNum, gNum, bNum);
      setHsv(newHsv);
      const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
      onChange(hex);
      onCommit(hex);
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
    else if (channel === "l") setLInput(val);

    const hNum = channel === "h" ? Number(val) : Number(hInput);
    const sNum = channel === "s" ? Number(val) : Number(sInput);
    const lNum = channel === "l" ? Number(val) : Number(lInput);

    if (
      !isNaN(hNum) && hNum >= 0 && hNum <= 360 &&
      !isNaN(sNum) && sNum >= 0 && sNum <= 100 &&
      !isNaN(lNum) && lNum >= 0 && lNum <= 100 &&
      val !== ""
    ) {
      const newHsv = hslToHsv(hNum, sNum, lNum);
      setHsv(newHsv);
      const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
      onChange(hex);
      onCommit(hex);
    }
  };

  const handleHslInputBlur = () => {
    const hslVal = hsvToHsl(hsv.h, hsv.s, hsv.v);
    setHInput(String(hslVal.h));
    setSInput(String(hslVal.s));
    setLInput(String(hslVal.l));
  };

  const hueTrack = "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)";
  const svBackground = "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`group relative size-8 rounded-full border border-white/10 shrink-0 ${!disabled ? "cursor-pointer hover:scale-105 transition-transform" : "cursor-default"
            }`}
          style={{ backgroundColor: color }}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[1100] bg-[#191919]/95 backdrop-blur-xl border border-[#353333] rounded-2xl p-4 shadow-2xl text-white w-64 space-y-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 font-sans"
          sideOffset={8}
          align="start"
        >
          {/* Header tabs */}
          <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/5">
            {(["hex", "rgb", "hsl"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1 text-[10px] uppercase font-mono font-medium rounded-md transition-all cursor-pointer ${activeTab === tab
                    ? "bg-white/10 text-white shadow-xs"
                    : "text-white/40 hover:text-white/60"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Color preview: original vs current */}
          <div className="flex rounded-lg overflow-hidden border border-white/10 h-5">
            <div className="flex-1" style={{ backgroundColor: color }} title={`Original: ${color}`} />
            <div className="w-px bg-white/10" />
            <div className="flex-1" style={{ backgroundColor: hsvToHex(hsv.h, hsv.s, hsv.v) }} title={`Current: ${hsvToHex(hsv.h, hsv.s, hsv.v)}`} />
          </div>

          {/* S/V Coordinates Area */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative w-full h-36 rounded-xl overflow-hidden cursor-crosshair select-none touch-none border border-white/10"
            style={{
              background: svBackground,
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`
            }}
          >
            <div
              className="absolute size-3 -translate-x-1.5 -translate-y-1.5 rounded-full border border-white bg-transparent pointer-events-none shadow-[0_0_2px_rgba(0,0,0,0.8),inset_0_0_2px_rgba(0,0,0,0.8)]"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`
              }}
            />
          </div>

          {/* Rainbow Hue Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-white/40 font-mono">
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

          {/* Input Fields */}
          <div className="pt-2 border-t border-white/5">
            {activeTab === "hex" && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 font-mono font-medium w-8 shrink-0">HEX</span>
                <input
                  type="text"
                  value={hexInput}
                  onChange={handleHexInputChange}
                  onBlur={handleHexInputBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleHexInputBlur()}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono w-full outline-none focus:border-accent-blue text-center"
                />
              </div>
            )}

            {activeTab === "rgb" && (
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col items-center gap-1">
                  <input
                    type="text"
                    value={rInput}
                    onChange={(e) => handleRgbInputChange("r", e.target.value)}
                    onBlur={handleRgbInputBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleRgbInputBlur()}
                    className="bg-black/40 border border-white/10 rounded-lg py-1 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue"
                  />
                  <span className="text-[9px] text-white/30 font-mono font-medium">R</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <input
                    type="text"
                    value={gInput}
                    onChange={(e) => handleRgbInputChange("g", e.target.value)}
                    onBlur={handleRgbInputBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleRgbInputBlur()}
                    className="bg-black/40 border border-white/10 rounded-lg py-1 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue"
                  />
                  <span className="text-[9px] text-white/30 font-mono font-medium">G</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <input
                    type="text"
                    value={bInput}
                    onChange={(e) => handleRgbInputChange("b", e.target.value)}
                    onBlur={handleRgbInputBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleRgbInputBlur()}
                    className="bg-black/40 border border-white/10 rounded-lg py-1 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue"
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
                    onChange={(e) => handleHslInputChange("h", e.target.value)}
                    onBlur={handleHslInputBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleHslInputBlur()}
                    className="bg-black/40 border border-white/10 rounded-lg py-1 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue"
                  />
                  <span className="text-[9px] text-white/30 font-mono font-medium">H</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <input
                    type="text"
                    value={sInput}
                    onChange={(e) => handleHslInputChange("s", e.target.value)}
                    onBlur={handleHslInputBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleHslInputBlur()}
                    className="bg-black/40 border border-white/10 rounded-lg py-1 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue"
                  />
                  <span className="text-[9px] text-white/30 font-mono font-medium">S%</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <input
                    type="text"
                    value={lInput}
                    onChange={(e) => handleHslInputChange("l", e.target.value)}
                    onBlur={handleHslInputBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleHslInputBlur()}
                    className="bg-black/40 border border-white/10 rounded-lg py-1 text-xs text-white font-mono w-full text-center outline-none focus:border-accent-blue"
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
                  onClick={() => {
                    const newHsv = hexToHsv(c);
                    setHsv(newHsv);
                    onChange(c);
                    onCommit(c);
                  }}
                  className="size-6 rounded-md border border-white/10 hover:scale-110 hover:border-white/30 active:scale-95 transition-all cursor-pointer"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Remove Button */}
          {!disabled && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="w-full mt-2 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/25 active:scale-95 transition-all text-xs font-mono font-medium cursor-pointer"
            >
              Remove Color
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function CustomDatePicker({ value, onChange, disabled }: CustomDatePickerProps) {
  const initialDate = value ? new Date(value) : new Date();
  const [viewMonth, setViewMonth] = useState(() => isNaN(initialDate.getTime()) ? new Date().getMonth() : initialDate.getMonth());
  const [viewYear, setViewYear] = useState(() => isNaN(initialDate.getTime()) ? new Date().getFullYear() : initialDate.getFullYear());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const d = value ? new Date(value) : null;
    if (d && !isNaN(d.getTime())) {
      setViewMonth(d.getMonth());
      setViewYear(d.getFullYear());
    }
  }, [value]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDay = new Date(viewYear, viewMonth, 1).getDay();

  const handleDaySelect = (dayNum: number) => {
    const selected = new Date(viewYear, viewMonth, dayNum);
    const yyyy = selected.getFullYear();
    const mm = String(selected.getMonth() + 1).padStart(2, '0');
    const dd = String(selected.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "Select release date...";
    const [y, m, d] = dateStr.split("-");
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(parsed.getTime())) return "Select release date...";
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const isSelected = (dayNum: number) => {
    if (!value) return false;
    const [y, m, d] = value.split("-");
    return Number(y) === viewYear && Number(m) - 1 === viewMonth && Number(d) === dayNum;
  };

  const isToday = (dayNum: number) => {
    const today = new Date();
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === dayNum;
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center justify-between w-full h-12 rounded-2xl px-5 border border-[#353333]/50 text-white text-sm bg-transparent cursor-pointer select-none text-left focus:border-accent-blue focus:ring-[color-mix(in_oklab,var(--accent-blue)_40%,transparent)] focus:ring-[3px] transition-[border-color,box-shadow]"
          style={{
            background: "linear-gradient(0deg, #1D1D1D 0%, rgba(40, 40, 40, 0.22) 100%)",
          }}
        >
          <span className={value ? "text-white" : "text-white/40"}>
            {value ? formatDateDisplay(value) : "Select release date..."}
          </span>
          <Calendar className="size-4 text-white/40" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[1100] bg-[#191919]/95 backdrop-blur-xl border border-[#353333] rounded-2xl p-4 shadow-2xl text-white w-72 space-y-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 font-sans"
          sideOffset={8}
          align="start"
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="size-4.5" />
            </button>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-white/80">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-white/40 font-mono font-medium">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDay }).map((_, idx) => (
              <div key={`spacer-${idx}`} className="size-8" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const selected = isSelected(dayNum);
              const today = isToday(dayNum);
              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => handleDaySelect(dayNum)}
                  className={`size-8 rounded-lg text-xs font-mono transition-all flex items-center justify-center cursor-pointer ${selected
                      ? "bg-accent-blue text-white font-bold"
                      : today
                        ? "border border-accent-blue/50 text-accent-blue hover:bg-accent-blue/10"
                        : "text-white/80 hover:bg-white/5 hover:text-white"
                    }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-2 text-xs font-mono">
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-accent-blue hover:underline cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-white/40 hover:text-white/80 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function getPlatformIcon(platform: string) {
  let logoSrc = "";
  switch (platform.toLowerCase()) {
    case "spotify":
      logoSrc = spotifyLogo;
      break;
    case "apple music":
      logoSrc = appleMusicLogo;
      break;
    case "youtube music":
      logoSrc = youtubeMusicLogo;
      break;
    case "tidal":
      logoSrc = tidalLogo;
      break;
    case "deezer":
      logoSrc = deezerLogo;
      break;
    case "bandcamp":
      logoSrc = bandcampLogo;
      break;
    case "soundcloud":
      logoSrc = soundcloudLogo;
      break;
    default:
      return null;
  }
  return <img src={logoSrc} alt={platform} className="size-4 object-contain shrink-0" />;
}

export default function ProjectMetadataPanel({ project, canEdit, onClose }: ProjectMetadataPanelProps) {
  const updateProject = useUpdateProject();
  const { preferences } = usePreferences();

  // Local state for immediate UI feedback (text fields are saved on blur, sliders/ratings immediately)
  const [releaseDate, setReleaseDate] = useState(project.estimated_release_date || "");
  const [preSaveUrl, setPreSaveUrl] = useState(project.pre_save_url || "");
  const [distributorNotes, setDistributorNotes] = useState(project.distributor_notes || "");
  const [completionPercentage, setCompletionPercentage] = useState(project.completion_percentage || 0);
  const [rating, setRating] = useState(project.rating || 0);
  const [localColors, setLocalColors] = useState<string[]>([]);

  // === Progress slider state & motion values (replicating volume slider behavior) ===
  const [isProgressDragging, setIsProgressDragging] = useState(false);
  const progressContainerRef = useRef<HTMLDivElement>(null);
  const progressThumbRef = useRef<HTMLDivElement>(null);
  const PROGRESS_THUMB_WIDTH = 32;
  const PROGRESS_THUMB_HEIGHT = 20;
  const PROGRESS_TRACK_HEIGHT = 6;
  const PROGRESS_SCALE_REST = 0.6;
  const PROGRESS_SCALE_DRAG = 1;

  const progressPointerDown = useMotionValue(0);
  const progressThumbX = useMotionValue(0);
  const progressIsActive = useTransform(
    () => (progressPointerDown.get() > 0.5 ? 1 : 0) as number,
  );

  const progressBlur = useMotionValue(0.3);
  const progressSpecularOpacity = useMotionValue(0.6);
  const progressSpecularSaturation = useMotionValue(12);
  const progressRefractionBase = useMotionValue(1.1);
  const progressPressMultiplier = useTransform(
    progressIsActive as any,
    [0, 1],
    [0.4, 0.9],
  );
  const progressScaleRatio = useSpring(
    useTransform(
      [progressPressMultiplier, progressRefractionBase],
      ([m, base]: number[]) => (Number(m) || 0) * (Number(base) || 0),
    ),
  );
  const progressScaleSpring = useSpring(
    useTransform(progressIsActive as any, [0, 1], [PROGRESS_SCALE_REST, PROGRESS_SCALE_DRAG]),
    { damping: 80, stiffness: 2000 },
  );
  const progressBgOpacity = useSpring(
    useTransform(progressIsActive as any, [0, 1], [1, 0.1]),
    { damping: 80, stiffness: 2000 },
  );
  const progressBgColor = useTransform(
    progressBgOpacity,
    (op: number) => `rgba(255, 255, 255, ${op})`,
  );

  // Sync state if project updates from other clients
  useEffect(() => {
    setReleaseDate(project.estimated_release_date || "");
    setPreSaveUrl(project.pre_save_url || "");
    setDistributorNotes(project.distributor_notes || "");
    setCompletionPercentage(project.completion_percentage || 0);
    setRating(project.rating || 0);

    let parsed: string[] = [];
    if (project.color_palette) {
      try {
        const temp = JSON.parse(project.color_palette);
        if (Array.isArray(temp)) {
          parsed = temp;
        }
      } catch {
        // Keep empty array
      }
    }
    setLocalColors(parsed);
  }, [project]);

  // Parse checklist
  let checklist: Record<string, boolean> = PLATFORMS.reduce(
    (acc, p) => ({ ...acc, [p]: false }),
    {} as Record<string, boolean>
  );
  if (project.streaming_checklist) {
    try {
      checklist = JSON.parse(project.streaming_checklist);
    } catch {
      // Keep empty defaults
    }
  }

  // Save changes wrapper
  const handleSave = async (fields: Partial<Parameters<typeof updateProject.mutateAsync>[0]["data"]>) => {
    try {
      await updateProject.mutateAsync({
        id: project.public_id,
        data: fields,
      });
    } catch (error) {
      console.error("Failed to save metadata:", error);
      toast.error("Failed to save changes");
    }
  };

  // Custom Date selection change handler
  const handleReleaseDateChange = (newDate: string) => {
    setReleaseDate(newDate);
    if (newDate !== (project.estimated_release_date || "")) {
      handleSave({ estimated_release_date: newDate || "" });
    }
  };

  const handlePreSaveBlur = () => {
    if (preSaveUrl !== (project.pre_save_url || "")) {
      handleSave({ pre_save_url: preSaveUrl || "" });
    }
  };

  const handleDistributorNotesBlur = () => {
    if (distributorNotes !== (project.distributor_notes || "")) {
      handleSave({ distributor_notes: distributorNotes || "" });
    }
  };

  // Immediate save on change
  const handlePercentageChange = useCallback((value: number) => {
    setCompletionPercentage(value);
  }, []);

  const handlePercentageCommit = () => {
    if (completionPercentage !== project.completion_percentage) {
      handleSave({ completion_percentage: completionPercentage });
    }
  };

  // Progress slider handler ref (avoids stale closures in effects)
  const handlePercentageCommitRef = useRef(handlePercentageCommit);
  handlePercentageCommitRef.current = handlePercentageCommit;

  // Read percentage from thumb position during Framer Motion drag
  const updateProgressFromThumb = useCallback(() => {
    if (!progressContainerRef.current || !progressThumbRef.current) return;
    const container = progressContainerRef.current.getBoundingClientRect();
    const thumb = progressThumbRef.current.getBoundingClientRect();
    const thumbCenterX = thumb.left + thumb.width / 2;
    const x0 = container.left + PROGRESS_THUMB_WIDTH / 2;
    const x100 = container.right - PROGRESS_THUMB_WIDTH / 2;
    const range = x100 - x0;
    if (range <= 0) return;
    const ratio = (thumbCenterX - x0) / range;
    const percentage = Math.round(Math.max(0, Math.min(100, ratio * 100)));
    handlePercentageChange(percentage);
  }, [handlePercentageChange]);

  // Click on track -> jump thumb and begin drag
  const handleProgressTrackMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canEdit || !progressContainerRef.current) return;
      const container = progressContainerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - container.left;
      const ratio = relativeX / container.width;
      const percentage = Math.round(Math.max(0, Math.min(100, ratio * 100)));
      handlePercentageChange(percentage);
      const maxX = container.width - PROGRESS_THUMB_WIDTH;
      progressThumbX.set(Math.max(0, Math.min(maxX, (percentage / 100) * maxX)));
      progressPointerDown.set(1);
      setIsProgressDragging(true);
    },
    [canEdit, handlePercentageChange, progressThumbX, progressPointerDown],
  );

  // Sync thumb X when percentage changes externally (not during drag)
  useEffect(() => {
    if (!isProgressDragging && progressContainerRef.current) {
      const containerWidth = progressContainerRef.current.offsetWidth;
      const maxX = Math.max(0, containerWidth - PROGRESS_THUMB_WIDTH);
      progressThumbX.set((completionPercentage / 100) * maxX);
    }
  }, [completionPercentage, isProgressDragging, progressThumbX]);

  // Global pointer-up resets drag state (mirrors volume slider)
  useEffect(() => {
    function onPointerUp() {
      progressPointerDown.set(0);
      setIsProgressDragging(false);
    }
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchend", onPointerUp);
    return () => {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchend", onPointerUp);
    };
  }, [progressPointerDown]);

  // Window-level mouse tracking for track-click drags
  useEffect(() => {
    if (!isProgressDragging || !progressContainerRef.current) return;
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressContainerRef.current) return;
      const container = progressContainerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - container.left;
      const ratio = relativeX / container.width;
      const percentage = Math.round(Math.max(0, Math.min(100, ratio * 100)));
      handlePercentageChange(percentage);
      const maxX = container.width - PROGRESS_THUMB_WIDTH;
      progressThumbX.set(Math.max(0, Math.min(maxX, (percentage / 100) * maxX)));
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.style.userSelect = "";
    };
  }, [isProgressDragging, handlePercentageChange, progressThumbX]);

  const handleRatingChange = (value: number) => {
    if (!canEdit) return;
    const newRating = rating === value ? 0 : value; // Toggle rating off if clicked again
    setRating(newRating);
    handleSave({ rating: newRating });
  };

  const handleLocalColorChange = (index: number, newColor: string) => {
    if (!canEdit) return;
    const updated = [...localColors];
    updated[index] = newColor;
    setLocalColors(updated);
  };

  const handleColorCommit = (index: number, finalColor: string) => {
    if (!canEdit) return;
    const updated = [...localColors];
    updated[index] = finalColor;
    handleSave({ color_palette: JSON.stringify(updated) });
  };

  const handleColorAdd = () => {
    if (!canEdit || localColors.length >= 8) return;
    const defaultColor = preferences?.accent_color || "#ffba00";
    const updated = [...localColors, defaultColor];
    setLocalColors(updated);
    handleSave({ color_palette: JSON.stringify(updated) });
  };

  const handleColorRemove = (index: number) => {
    if (!canEdit) return;
    const updated = localColors.filter((_, i) => i !== index);
    setLocalColors(updated);
    handleSave({ color_palette: JSON.stringify(updated) });
  };

  const handleChecklistChange = (platform: string, checked: boolean) => {
    if (!canEdit) return;
    const newChecklist = { ...checklist, [platform]: checked };
    handleSave({ streaming_checklist: JSON.stringify(newChecklist) });
  };

  // Days remaining calculation
  const getDaysRemainingText = () => {
    if (!releaseDate) return null;
    const rel = new Date(releaseDate);
    if (isNaN(rel.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    rel.setHours(0, 0, 0, 0);

    const diff = rel.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days} days remaining`;
    } else if (days === 0) {
      return "Released today!";
    } else {
      return `Released ${Math.abs(days)} days ago`;
    }
  };

  const daysRemainingText = getDaysRemainingText();

  // Star rendering
  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type="button"
          disabled={!canEdit}
          onClick={() => handleRatingChange(i)}
          className={`p-0.5 outline-none transition-transform focus:scale-110 active:scale-95 ${canEdit ? "cursor-pointer" : "cursor-default"
            }`}
        >
          <Star
            className={`size-5 transition-colors ${i <= rating ? "fill-amber-400 text-amber-400" : "text-white/20 hover:text-white/40"
              }`}
          />
        </button>
      );
    }
    return stars;
  };

  const isModal = !!onClose;

  return (
    <div className={isModal ? "p-6 space-y-6 text-white text-sm max-h-[80vh] overflow-y-auto" : "bg-linear-to-b from-[#232323] to-[#201f1f] border border-[#353333] rounded-2xl p-5 space-y-6 text-white text-sm"}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <h3 className="font-semibold text-white/90 tracking-wide" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
          PROJECT DETAILS
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* 1. Release Date & Countdown */}
      <div className="space-y-2">
        <Label className="text-white/60 text-xs flex items-center gap-1.5 font-medium">
          <Calendar className="size-4" /> ESTIMATED RELEASE DATE
        </Label>
        <div className="flex flex-col sm:flex-row gap-3">
          <CustomDatePicker
            value={releaseDate}
            onChange={handleReleaseDateChange}
            disabled={!canEdit}
          />
          {daysRemainingText && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs font-mono shrink-0 select-none">
              <Clock className="size-3.5" />
              {daysRemainingText}
            </div>
          )}
        </div>
      </div>

      {/* 2. Completion Percentage */}
      <div className="space-y-2 group/progress">
        <div className="flex justify-between items-center">
          <Label className="text-white/60 text-xs flex items-center gap-1.5 font-medium">
            <Percent className="size-4" /> COMPLETION PROGRESS
          </Label>
          <span className="text-xs font-mono font-medium text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-md border border-accent-blue/20 group-hover/progress:scale-105 group-active/progress:scale-110 transition-transform duration-200">
            {completionPercentage}%
          </span>
        </div>
        <ProgressFilter
          id="progress-slider-filter"
          blur={progressBlur}
          scaleRatio={progressScaleRatio}
          specularOpacity={progressSpecularOpacity}
          specularSaturation={progressSpecularSaturation}
        />
        <motion.div
          ref={progressContainerRef}
          style={{
            position: "relative",
            height: PROGRESS_THUMB_HEIGHT,
            cursor: canEdit ? "pointer" : "default",
          }}
          onMouseDown={handleProgressTrackMouseDown}
        >
          {/* Track background */}
          <div
            style={{
              position: "absolute",
              height: PROGRESS_TRACK_HEIGHT,
              width: "100%",
              top: (PROGRESS_THUMB_HEIGHT - PROGRESS_TRACK_HEIGHT) / 2,
              backgroundColor: "#89898F66",
              borderRadius: PROGRESS_TRACK_HEIGHT / 2,
              pointerEvents: "none",
            }}
          >
            <div className="w-full h-full overflow-hidden" style={{ borderRadius: PROGRESS_TRACK_HEIGHT / 2 }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: `${completionPercentage}%`,
                  height: PROGRESS_TRACK_HEIGHT,
                  borderRadius: PROGRESS_TRACK_HEIGHT / 2,
                  backgroundColor: "var(--accent-color)",
                }}
              />
            </div>
          </div>
          {/* Draggable thumb (mirrors volume slider) */}
          <motion.div
            ref={progressThumbRef}
            drag={canEdit ? "x" : false}
            dragConstraints={progressContainerRef}
            dragElastic={0.02}
            dragMomentum={false}
            onMouseDown={(e) => {
              if (!canEdit) return;
              e.stopPropagation();
              progressPointerDown.set(1);
            }}
            onMouseUp={() => { progressPointerDown.set(0); }}
            onDragStart={() => {
              if (!canEdit) return;
              progressPointerDown.set(1);
              setIsProgressDragging(true);
            }}
            onDrag={() => { updateProgressFromThumb(); }}
            onDragEnd={() => {
              progressPointerDown.set(0);
              setIsProgressDragging(false);
              handlePercentageCommit();
            }}
            className="absolute"
            style={{
              width: PROGRESS_THUMB_WIDTH,
              height: PROGRESS_THUMB_HEIGHT,
              top: 0,
              x: progressThumbX,
              borderRadius: 16,
              backdropFilter: "url(#progress-slider-filter)",
              scale: progressScaleSpring,
              cursor: canEdit ? "pointer" : "default",
              backgroundColor: progressBgColor,
              boxShadow: "0 3px 14px rgba(0,0,0,0.1)",
            }}
          />
        </motion.div>
      </div>

      {/* 3. Star Rating */}
      <div className="space-y-2">
        <Label className="text-white/60 text-xs flex items-center gap-1.5 font-medium">
          <Star className="size-4" /> OVERALL RATING
        </Label>
        <div className="flex items-center gap-1">{renderStars()}</div>
      </div>

      {/* 4. Color Palette Picker */}
      <div className="space-y-2">
        <Label className="text-white/60 text-xs flex items-center gap-1.5 font-medium">
          <Palette className="size-4" /> BRAND COLOR PALETTE
        </Label>
        <div className="flex flex-wrap items-center gap-3">
          {localColors.map((color, i) => (
            <ColorPickerDropdown
              key={i}
              color={color}
              disabled={!canEdit}
              onChange={(newColor) => handleLocalColorChange(i, newColor)}
              onCommit={(newColor) => handleColorCommit(i, newColor)}
              onRemove={() => handleColorRemove(i)}
            />
          ))}
          {canEdit && localColors.length < 8 && (
            <button
              type="button"
              onClick={handleColorAdd}
              className="flex items-center justify-center size-8 rounded-full border border-dashed border-white/20 hover:border-white/60 hover:scale-105 active:scale-95 transition-all text-white/40 hover:text-white/80 cursor-pointer shrink-0"
              title="Add brand color"
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* 5. Streaming Checklist */}
      <div className="space-y-3">
        <Label className="text-white/60 text-xs flex items-center gap-1.5 font-medium">
          <Music className="size-4" /> DISTRIBUTION CHECKLIST
        </Label>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 border border-[#353333]/50 rounded-2xl p-4"
          style={{
            background: "linear-gradient(0deg, #1D1D1D 0%, rgba(40, 40, 40, 0.22) 100%)",
          }}
        >
          {PLATFORMS.map((platform) => (
            <div key={platform} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                {getPlatformIcon(platform)}
                <span className="text-xs text-white/80 font-medium">{platform}</span>
              </div>
              <Switch
                checked={checklist[platform] || false}
                disabled={!canEdit}
                onCheckedChange={(checked) => handleChecklistChange(platform, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 6. Pre-save & Distributor Notes */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs flex items-center gap-1.5 font-medium">
            <Link className="size-4" /> PRE-SAVE CAMPAIGN LINK
          </Label>
          <Input
            type="url"
            disabled={!canEdit}
            value={preSaveUrl}
            onChange={(e) => setPreSaveUrl(e.target.value)}
            onBlur={handlePreSaveBlur}
            placeholder="https://presave.to/my-album"
            className="border-[#353333]/50 text-white text-sm placeholder:text-white/20 h-12 rounded-2xl px-5 bg-transparent"
            style={{
              background: "linear-gradient(0deg, #1D1D1D 0%, rgba(40, 40, 40, 0.22) 100%)",
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs flex items-center gap-1.5 font-medium">
            <Info className="size-4" /> DISTRIBUTOR NOTES & ISRC CODES
          </Label>
          <textarea
            disabled={!canEdit}
            value={distributorNotes}
            onChange={(e) => setDistributorNotes(e.target.value)}
            onBlur={handleDistributorNotesBlur}
            placeholder="Add distributor info, track catalogs, metadata logs, or ISRC notes..."
            className="w-full min-h-20 max-h-40 border border-[#353333]/50 text-white rounded-2xl p-4 text-sm placeholder:text-white/20 outline-none transition-[color,box-shadow] focus:border-accent-blue focus:ring-[color-mix(in_oklab,var(--accent-blue)_40%,transparent)] focus:ring-[3px] resize-y"
            style={{
              background: "linear-gradient(0deg, #1D1D1D 0%, rgba(40, 40, 40, 0.22) 100%)",
              fontFamily: '"IBM Plex Mono", monospace'
            }}
          />
        </div>
      </div>
    </div>
  );
}
