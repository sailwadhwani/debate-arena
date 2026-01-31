"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseSpeechSynthesisOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
}

interface UseSpeechSynthesisResult {
  speak: (text: string, agentName?: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  currentWord: number;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

// Map agent names to voice preferences
const AGENT_VOICE_PREFERENCES: Record<string, { gender: "male" | "female"; pitch: number }> = {
  "Product Manager": { gender: "male", pitch: 1.0 },
  "Tech Lead": { gender: "male", pitch: 0.9 },
  "Business Strategist": { gender: "female", pitch: 1.1 },
  "Compliance Counsel": { gender: "female", pitch: 1.0 },
  "The Boss": { gender: "male", pitch: 0.8 },
};

export function useSpeechSynthesis(options: UseSpeechSynthesisOptions = {}): UseSpeechSynthesisResult {
  const { rate = 1.0, pitch = 1.0, volume = 1.0 } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentWord, setCurrentWord] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Load voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported]);

  // Select voice based on agent
  const selectVoice = useCallback((agentName?: string): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    const prefs = agentName ? AGENT_VOICE_PREFERENCES[agentName] : null;

    // Prefer English voices
    const englishVoices = voices.filter(v => v.lang.startsWith("en"));

    if (prefs && englishVoices.length > 0) {
      // Try to find a voice matching gender preference
      const genderKeywords = prefs.gender === "female"
        ? ["female", "woman", "zira", "samantha", "karen", "moira", "fiona", "victoria"]
        : ["male", "man", "david", "daniel", "james", "alex", "tom", "guy"];

      const matchingVoice = englishVoices.find(v =>
        genderKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
      );

      if (matchingVoice) return matchingVoice;
    }

    // Fallback: prefer Google or Microsoft voices for quality
    const preferredVoice = englishVoices.find(v =>
      v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Natural")
    );

    return preferredVoice || englishVoices[0] || voices[0];
  }, [voices]);

  const speak = useCallback((text: string, agentName?: string) => {
    if (!isSupported || !enabled) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Set voice
    const voice = selectVoice(agentName);
    if (voice) {
      utterance.voice = voice;
    }

    // Get agent-specific pitch
    const prefs = agentName ? AGENT_VOICE_PREFERENCES[agentName] : null;

    utterance.rate = rate;
    utterance.pitch = prefs?.pitch || pitch;
    utterance.volume = volume;

    // Track word progress
    let wordIndex = 0;
    utterance.onboundary = (event) => {
      if (event.name === "word") {
        wordIndex++;
        setCurrentWord(wordIndex);
      }
    };

    utterance.onstart = () => {
      setIsSpeaking(true);
      setCurrentWord(0);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentWord(0);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentWord(0);
    };

    window.speechSynthesis.speak(utterance);
  }, [isSupported, enabled, rate, pitch, volume, selectVoice]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentWord(0);
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
    voices,
    currentWord,
    enabled,
    setEnabled,
  };
}
