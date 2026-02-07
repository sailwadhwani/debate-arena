"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface DebateAudioState {
  status: "idle" | "loading" | "debating" | "paused" | "concluding" | "complete";
  speakingAgentId?: string;
  agentColor?: string;
  argumentCount: number;
}

interface AudioConfig {
  enabled: boolean;
  volume: number;
}

// Simple audio manager
class DebateAudioManager {
  private ctx: AudioContext | null = null;
  private droneOscillators: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;
  private isPlaying = false;

  async init(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      const AudioContextClass = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      this.ctx = new AudioContextClass();

      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }

      console.log("[Audio] Initialized, state:", this.ctx.state);
      return this.ctx.state === "running";
    } catch (e) {
      console.warn("[Audio] Init failed:", e);
      return false;
    }
  }

  isReady(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  // Play a simple beep tone
  playTone(frequency: number, duration: number = 0.2, volume: number = 0.1, type: OscillatorType = "sine") {
    if (!this.ctx || this.ctx.state !== "running") return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = type;
      osc.frequency.value = frequency;

      // Smooth envelope
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

      osc.start();
      osc.stop(this.ctx.currentTime + duration + 0.1);
    } catch (e) {
      console.warn("[Audio] Tone failed:", e);
    }
  }

  // Play agent speaking sound (chord based on color)
  playAgentSound(color: string, volume: number = 0.15) {
    if (!this.isReady()) return;

    // Convert color to frequency
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) || 128;
    const g = parseInt(hex.substring(2, 4), 16) || 128;
    const b = parseInt(hex.substring(4, 6), 16) || 128;
    const freq = 200 + ((r + g + b) / 765) * 300;

    // Play a chord
    this.playTone(freq, 0.3, volume, "sine");
    setTimeout(() => this.playTone(freq * 1.25, 0.25, volume * 0.6, "triangle"), 50);
    setTimeout(() => this.playTone(freq * 1.5, 0.2, volume * 0.4, "sine"), 100);

    console.log("[Audio] Agent sound for", color, "freq:", freq);
  }

  // Start ambient drone
  startDrone(volume: number = 0.03) {
    if (!this.ctx || this.isPlaying) return;

    try {
      this.droneGain = this.ctx.createGain();
      this.droneGain.connect(this.ctx.destination);
      this.droneGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.droneGain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 2);

      // Low drone frequencies
      [55, 82.5, 110].forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        osc.type = i === 0 ? "sine" : "triangle";
        osc.frequency.value = freq;
        osc.connect(this.droneGain!);
        osc.start();
        this.droneOscillators.push(osc);
      });

      this.isPlaying = true;
      console.log("[Audio] Drone started");
    } catch (e) {
      console.warn("[Audio] Drone start failed:", e);
    }
  }

  // Stop ambient drone
  stopDrone() {
    if (!this.droneGain || !this.isPlaying) return;

    try {
      this.droneGain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 1);

      setTimeout(() => {
        this.droneOscillators.forEach(osc => {
          try { osc.stop(); } catch { /* ignore */ }
        });
        this.droneOscillators = [];
        this.isPlaying = false;
      }, 1100);

      console.log("[Audio] Drone stopping");
    } catch (e) {
      console.warn("[Audio] Drone stop failed:", e);
    }
  }

  // Adjust drone intensity
  setDroneIntensity(intensity: number) {
    if (!this.droneGain || !this.ctx) return;
    const vol = 0.02 + Math.min(intensity, 1) * 0.06;
    this.droneGain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.3);
  }

  // Play conclusion fanfare
  playConclusion(volume: number = 0.15) {
    if (!this.isReady()) return;

    const notes = [261.63, 329.63, 392.0, 523.25]; // C major arpeggio
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.4, volume, "sine");
        this.playTone(freq * 2, 0.3, volume * 0.3, "triangle");
      }, i * 150);
    });

    console.log("[Audio] Conclusion fanfare");
  }
}

// Singleton instance
let audioManager: DebateAudioManager | null = null;

function getAudioManager(): DebateAudioManager {
  if (!audioManager) {
    audioManager = new DebateAudioManager();
  }
  return audioManager;
}

export function useDebateAudio(state: DebateAudioState, config: AudioConfig = { enabled: true, volume: 0.5 }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const lastSpeakerRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string>("idle");

  // Initialize audio (must be called on user interaction)
  const initialize = useCallback(async () => {
    if (isInitialized) return true;

    const manager = getAudioManager();
    const success = await manager.init();

    if (success) {
      setIsInitialized(true);
      // Play a test tone to confirm audio works
      manager.playTone(440, 0.1, config.volume * 0.2);
      console.log("[Audio] Ready!");
    }

    return success;
  }, [isInitialized, config.volume]);

  // Handle state changes
  useEffect(() => {
    if (!config.enabled || !isInitialized) return;

    const manager = getAudioManager();
    if (!manager.isReady()) return;

    // Start/stop drone based on status
    if (state.status === "debating" && lastStatusRef.current !== "debating") {
      manager.startDrone(config.volume * 0.08);
    } else if ((state.status === "complete" || state.status === "idle") && lastStatusRef.current === "debating") {
      manager.stopDrone();
    }

    // Adjust drone intensity
    if (state.status === "debating") {
      manager.setDroneIntensity(Math.min(state.argumentCount * 0.15, 1));
    }

    // Play sound when speaker changes
    if (state.speakingAgentId &&
        state.speakingAgentId !== lastSpeakerRef.current &&
        state.agentColor) {
      manager.playAgentSound(state.agentColor, config.volume * 0.2);
      lastSpeakerRef.current = state.speakingAgentId;
    }

    // Play conclusion
    if (state.status === "complete" && lastStatusRef.current !== "complete") {
      setTimeout(() => manager.playConclusion(config.volume * 0.2), 500);
    }

    lastStatusRef.current = state.status;
  }, [state, config, isInitialized]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioManager) {
        audioManager.stopDrone();
      }
    };
  }, []);

  return {
    initialize,
    isInitialized,
    playImpact: () => {
      if (isInitialized && config.enabled) {
        getAudioManager().playTone(100, 0.15, config.volume * 0.3, "sawtooth");
      }
    },
  };
}
