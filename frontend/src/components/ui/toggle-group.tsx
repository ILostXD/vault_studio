import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ToggleGroupOption {
  label: string;
  value: string;
}

interface ToggleGroupProps {
  options: ToggleGroupOption[];
  value: string;
  onValueChange: (val: string) => void;
  className?: string;
  size?: "default" | "sm";
  layoutId?: string;
}

export function ToggleGroup({
  options,
  value,
  onValueChange,
  className,
  size = "default",
  layoutId,
}: ToggleGroupProps) {
  const generatedId = useId();
  const activeLayoutId = layoutId || `toggle-active-bg-${generatedId}`;
  const isSmall = size === "sm";

  return (
    <div
      className={cn(
        "flex bg-[var(--bg-2)] border border-border shadow-inner relative z-0",
        isSmall ? "p-0.5 rounded-xl" : "p-1 rounded-[20px]",
        className
      )}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative flex-1 font-medium transition-colors duration-200 z-10 flex items-center justify-center",
              isSmall
                ? "px-2 py-1 text-[10px] uppercase font-mono rounded-[10px]"
                : "px-4 py-2 text-sm rounded-2xl",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            {isActive && (
              <motion.div
                layoutId={activeLayoutId}
                className={cn(
                  "absolute inset-0 bg-[var(--bg-4)] border border-border shadow-sm -z-10",
                  isSmall ? "rounded-[9px]" : "rounded-[16px]"
                )}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
