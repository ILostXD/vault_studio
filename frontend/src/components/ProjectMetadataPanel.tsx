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
import ColorPicker from "@/components/ui/ColorPicker";
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
          className="flex items-center justify-between w-full h-12 rounded-2xl px-5 text-(--text-0) text-sm themed-input-surface cursor-pointer select-none text-left focus:border-accent-blue focus:ring-[color-mix(in_oklab,var(--accent-blue)_40%,transparent)] focus:ring-[3px] transition-[border-color,box-shadow]"
        >
          <span className={value ? "text-(--text-0)" : "text-(--text-0)/40"}>
            {value ? formatDateDisplay(value) : "Select release date..."}
          </span>
          <Calendar className="size-4 text-(--text-0)/40" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[1100] overlay-surface backdrop-blur-xl border border-(--card-border) rounded-2xl p-4 shadow-2xl text-(--text-0) w-72 space-y-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 font-sans"
          sideOffset={8}
          align="start"
        >
          <div className="flex items-center justify-between border-b border-(--control-border-subtle) pb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-(--control-bg-hover) text-(--text-0)/60 hover:text-(--text-0) transition-colors cursor-pointer"
            >
              <ChevronLeft className="size-4.5" />
            </button>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-(--text-0)/80">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-(--control-bg-hover) text-(--text-0)/60 hover:text-(--text-0) transition-colors cursor-pointer"
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-(--text-0)/40 font-mono font-medium">
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
                      ? "bg-accent-blue text-(--text-0) font-bold"
                      : today
                        ? "border border-accent-blue/50 text-accent-blue hover:bg-accent-blue/10"
                        : "text-(--text-0)/80 hover:bg-(--control-bg-hover) hover:text-(--text-0)"
                    }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-(--control-border-subtle) pt-2 text-xs font-mono">
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
              className="text-(--text-0)/40 hover:text-(--text-0)/80 transition-colors cursor-pointer"
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
            className={`size-5 transition-colors ${i <= rating ? "fill-amber-400 text-amber-400" : "text-(--text-0)/20 hover:text-(--text-0)/40"
              }`}
          />
        </button>
      );
    }
    return stars;
  };

  const isModal = !!onClose;

  return (
    <div className={isModal ? "p-6 space-y-6 text-(--text-0) text-sm max-h-[80vh] overflow-y-auto" : "bg-linear-to-b from-(--card-gradient-from) to-(--card-gradient-to) border border-(--card-border) rounded-2xl p-5 space-y-6 text-(--text-0) text-sm"}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <h3 className="font-semibold text-(--text-0)/90 tracking-wide" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
          PROJECT DETAILS
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-(--text-0)/60 hover:text-(--text-0) transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* 1. Release Date & Countdown */}
      <div className="space-y-2">
        <Label className="text-(--text-0)/60 text-xs flex items-center gap-1.5 font-medium">
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
          <Label className="text-(--text-0)/60 text-xs flex items-center gap-1.5 font-medium">
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
        <Label className="text-(--text-0)/60 text-xs flex items-center gap-1.5 font-medium">
          <Star className="size-4" /> OVERALL RATING
        </Label>
        <div className="flex items-center gap-1">{renderStars()}</div>
      </div>

      {/* 4. Color Palette Picker */}
      <div className="space-y-2">
        <Label className="text-(--text-0)/60 text-xs flex items-center gap-1.5 font-medium">
          <Palette className="size-4" /> BRAND COLOR PALETTE
        </Label>
        <div className="flex flex-wrap items-center gap-3">
          {localColors.map((color, i) => (
            <ColorPicker
              key={i}
              variant="popover"
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
              className="flex items-center justify-center size-8 rounded-full border border-dashed border-white/20 hover:border-white/60 hover:scale-105 active:scale-95 transition-all text-(--text-0)/40 hover:text-(--text-0)/80 cursor-pointer shrink-0"
              title="Add brand color"
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* 5. Streaming Checklist */}
      <div className="space-y-3">
        <Label className="text-(--text-0)/60 text-xs flex items-center gap-1.5 font-medium">
          <Music className="size-4" /> DISTRIBUTION CHECKLIST
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 rounded-2xl p-4 themed-input-surface">
          {PLATFORMS.map((platform) => (
            <div key={platform} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                {getPlatformIcon(platform)}
                <span className="text-xs text-(--text-0)/80 font-medium">{platform}</span>
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
          <Label className="text-(--text-0)/60 text-xs flex items-center gap-1.5 font-medium">
            <Link className="size-4" /> PRE-SAVE CAMPAIGN LINK
          </Label>
          <Input
            type="url"
            disabled={!canEdit}
            value={preSaveUrl}
            onChange={(e) => setPreSaveUrl(e.target.value)}
            onBlur={handlePreSaveBlur}
            placeholder="https://presave.to/my-album"
            className="themed-input-surface text-sm placeholder:text-(--text-0)/40 h-12 rounded-2xl px-5"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-(--text-0)/60 text-xs flex items-center gap-1.5 font-medium">
            <Info className="size-4" /> DISTRIBUTOR NOTES & ISRC CODES
          </Label>
          <textarea
            disabled={!canEdit}
            value={distributorNotes}
            onChange={(e) => setDistributorNotes(e.target.value)}
            onBlur={handleDistributorNotesBlur}
            placeholder="Add distributor info, track catalogs, metadata logs, or ISRC notes..."
            className="w-full min-h-20 max-h-40 themed-input-surface rounded-2xl p-4 text-sm placeholder:text-(--text-0)/40 outline-none transition-[color,box-shadow] focus:border-accent-blue focus:ring-[color-mix(in_oklab,var(--accent-blue)_40%,transparent)] focus:ring-[3px] resize-y"
            style={{
              fontFamily: '"IBM Plex Mono", monospace'
            }}
          />
        </div>
      </div>
    </div>
  );
}
