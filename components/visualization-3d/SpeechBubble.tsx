"use client";

import { Html } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";

interface SpeechBubbleProps {
  position: [number, number, number];
  text: string;
  agentName: string;
  color: string;
}

export function SpeechBubble({ position, text, agentName, color }: SpeechBubbleProps) {
  return (
    <Html
      position={position}
      center
      distanceFactor={2}
      style={{ pointerEvents: "none" }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          {/* Main bubble */}
          <div
            className="relative max-w-[280px] p-4 rounded-lg backdrop-blur-md"
            style={{
              background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
              border: `1px solid ${color}40`,
              boxShadow: `0 0 30px ${color}20, inset 0 0 30px ${color}05`,
            }}
          >
            {/* Agent name tag */}
            <div
              className="absolute -top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: color,
                color: "#0a0f14",
              }}
            >
              {agentName}
            </div>

            {/* Text content */}
            <p
              className="text-xs leading-relaxed font-mono"
              style={{ color: `${color}` }}
            >
              {text}
            </p>

            {/* Decorative corner accents */}
            <div
              className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 rounded-tl"
              style={{ borderColor: color }}
            />
            <div
              className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 rounded-tr"
              style={{ borderColor: color }}
            />
            <div
              className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 rounded-bl"
              style={{ borderColor: color }}
            />
            <div
              className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 rounded-br"
              style={{ borderColor: color }}
            />

            {/* Pointer arrow */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: `8px solid ${color}40`,
              }}
            />
          </div>

          {/* Animated scan line effect */}
          <motion.div
            className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="absolute left-0 right-0 h-[2px]"
              style={{
                background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
              }}
              animate={{
                top: ["0%", "100%", "0%"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </Html>
  );
}
