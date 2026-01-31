"use client";

import { motion, AnimatePresence } from "framer-motion";

interface SpeechBubbleProps {
  agentName: string;
  content: string;
  color: string;
  position: { x: number; y: number; visible: boolean };
}

export function SpeechBubble({ agentName, content, color, position }: SpeechBubbleProps) {
  if (!position.visible) return null;

  // Truncate long content
  const truncatedContent = content.length > 200 ? content.substring(0, 200) + "..." : content;

  // Get RGB for rgba backgrounds
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : "255, 255, 255";
  };

  const rgb = hexToRgb(color);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bubble-container"
        style={{
          position: "absolute",
          left: position.x,
          top: position.y,
          transform: "translate(-50%, -100%)",
          width: "320px",
          pointerEvents: "none",
          paddingBottom: "40px",
          filter: "drop-shadow(0 0 10px rgba(0,0,0,0.8))",
          zIndex: 20,
        }}
      >
        <div
          style={{
            background: "rgba(5, 8, 12, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderTop: `3px solid ${color}`,
            backdropFilter: "blur(4px)",
            padding: "16px",
            color: "#fff",
            borderRadius: "8px",
          }}
        >
          <span
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: "0.75em",
              letterSpacing: "1px",
              marginBottom: "10px",
              display: "block",
              opacity: 0.9,
              textTransform: "uppercase",
              color: color,
            }}
          >
            {agentName}
          </span>
          <div
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "1.15em",
              lineHeight: 1.5,
              textShadow: "0 0 10px rgba(255,255,255,0.2)",
            }}
          >
            {truncatedContent}
          </div>
        </div>
        {/* Connecting line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            width: "1px",
            height: "40px",
            background: `rgba(${rgb}, 0.6)`,
            transform: "translateX(-50%)",
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
