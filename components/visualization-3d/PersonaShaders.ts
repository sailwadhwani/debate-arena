/**
 * GLSL Shaders for Persona 3D Visualization
 */

export const humanoidVertexShader = /* glsl */ `
  uniform float time;
  uniform float speakingIntensity;

  varying vec3 vPos;
  varying float vPulse;

  void main() {
    vec3 pos = position;

    // Add speaking animation - subtle scale and displacement
    float speakPulse = sin(time * 8.0) * 0.02 * speakingIntensity;
    pos *= 1.0 + speakPulse;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    vPos = pos;

    // The "Data Pulse" calculated for the fragment shader
    vPulse = sin(pos.y * 4.0 - time * 4.0) * 0.5 + 0.5;
  }
`;

export const humanoidFragmentShader = /* glsl */ `
  varying vec3 vPos;
  varying float vPulse;

  uniform float time;
  uniform vec3 colorPrimary;
  uniform vec3 colorSecondary;
  uniform float speakingIntensity;

  void main() {
    // Vertical Gradient
    float heightPct = smoothstep(-2.0, 2.0, vPos.y);
    vec3 baseColor = mix(colorSecondary, colorPrimary, heightPct);

    // The Pulse Line (Bright flash moving through)
    float wave = smoothstep(0.95, 1.0, vPulse);

    // Speaking glow effect
    float speakGlow = speakingIntensity * (0.5 + 0.5 * sin(time * 10.0));

    // Combine: Base Neon + White Hot Pulse + Speaking Glow
    vec3 finalColor = baseColor + vec3(1.0) * wave + colorPrimary * speakGlow * 0.3;

    // Opacity logic for wireframe feel
    float alpha = 0.6 + wave * 0.4 + speakGlow * 0.2;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

/**
 * Parse hex color to RGB array [0-1]
 */
export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
}

/**
 * Darken a hex color
 */
export function darkenColor(hex: string, factor: number = 0.5): string {
  const rgb = hexToRgb(hex);
  const darkened = rgb.map((c) => Math.round(c * factor * 255));
  return `#${darkened.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
