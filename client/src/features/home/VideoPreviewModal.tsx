/**
 * VideoPreviewModal — cinematic full-screen modal for product demo video.
 *
 * Auto-plays video on open, pauses on close.
 * Dark overlay with backdrop blur, centered 16:9 container.
 * Close via X button, click outside, or Escape key.
 */
import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";

interface VideoPreviewModalProps {
  open: boolean;
  onClose: () => void;
}

// TODO: Replace with actual product demo video URL
const DEMO_VIDEO_URL = "";

export function VideoPreviewModal({ open, onClose }: VideoPreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (open) {
      videoRef.current?.play();
    } else {
      videoRef.current?.pause();
    }
  }, [open]);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          {/* Video container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-[90vw] max-w-[1100px] aspect-video rounded-2xl overflow-hidden shadow-2xl"
          >
            {DEMO_VIDEO_URL ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                controls
                playsInline
                autoPlay
              >
                <source src={DEMO_VIDEO_URL} type="video/mp4" />
              </video>
            ) : (
              /* Placeholder until real demo video is provided */
              <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] flex flex-col items-center justify-center gap-6">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                  <Play className="h-8 w-8 text-white/60 ml-1" />
                </div>
                <div className="text-center">
                  <p className="font-geist text-xl font-medium text-white/90">
                    Product demo coming soon
                  </p>
                  <p className="font-body text-sm text-white/50 mt-2">
                    See how Drape transforms your creative workflow
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
