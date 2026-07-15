import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useWebHaptics } from "web-haptics/react";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  disableClose?: boolean;
  dataAttributes?: Record<string, string>;
}

const EMPTY_DATA_ATTRIBUTES: Record<string, string> = {};

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export default function BaseModal({
  isOpen,
  onClose,
  children,
  maxWidth = "md",
  disableClose = false,
  dataAttributes = EMPTY_DATA_ATTRIBUTES,
}: BaseModalProps) {
  const haptic = useWebHaptics();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disableClose) {
        onClose();
      }
    };

    if (isOpen) {
      haptic.trigger("medium");
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, disableClose, onClose, haptic]);

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="fixed inset-0 z-1000 overlay-backdrop"
                onClick={disableClose ? undefined : onClose}
                {...(dataAttributes["data-modal-backdrop"] && {
                  "data-modal-backdrop": dataAttributes["data-modal-backdrop"],
                })}
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="fixed inset-0 z-1000 flex overflow-y-auto p-4 pointer-events-none"
                {...(dataAttributes["data-modal-container"] && {
                  "data-modal-container":
                    dataAttributes["data-modal-container"],
                })}
              >
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 18,
                    scale: 0.965,
                    filter: "blur(6px)",
                  }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 10, scale: 0.98, filter: "blur(3px)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className={`relative z-10 my-auto w-full ${maxWidthClasses[maxWidth]} max-h-[calc(100dvh-2rem)] border border-(--card-border) rounded-[34px] shadow-2xl overflow-y-auto pointer-events-auto overlay-surface text-(--text-0)`}
                  onClick={(e) => e.stopPropagation()}
                  {...(dataAttributes["data-modal-content"] && {
                    "data-modal-content": dataAttributes["data-modal-content"],
                  })}
                >
                  {children}
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
