/**
 * Advanced cyberpunk shaders for humanoid visualization
 * Creates glowing teal/cyan mesh effect like the reference images
 */

// Vertex shader for the holographic humanoid effect
export const humanoidVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vFresnel;

  uniform float time;
  uniform float pulseIntensity;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    // Calculate view direction for fresnel
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
    vFresnel = 1.0 - max(dot(viewDirection, vNormal), 0.0);

    // Subtle vertex displacement for organic feel
    vec3 displaced = position;
    float displacement = sin(position.y * 10.0 + time * 2.0) * 0.002 * pulseIntensity;
    displaced += normal * displacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

// Fragment shader for the glowing holographic effect
export const humanoidFragmentShader = `
  uniform vec3 baseColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float opacity;
  uniform float speakingIntensity;
  uniform float gridDensity;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vFresnel;

  // Noise function for texture
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    // Create grid/mesh pattern
    float gridX = abs(sin(vUv.x * gridDensity * 3.14159));
    float gridY = abs(sin(vUv.y * gridDensity * 3.14159));
    float grid = max(gridX, gridY);
    grid = smoothstep(0.8, 1.0, grid);

    // Scan lines effect
    float scanline = sin(vPosition.y * 50.0 + time * 3.0) * 0.5 + 0.5;
    scanline = smoothstep(0.3, 0.7, scanline) * 0.15;

    // Edge glow using fresnel
    float edgeGlow = pow(vFresnel, 2.0) * 1.5;

    // Data flow effect
    float dataFlow = noise(vec2(vUv.x * 20.0, vUv.y * 20.0 - time * 0.5));
    dataFlow = smoothstep(0.4, 0.6, dataFlow) * 0.3;

    // Combine effects
    float intensity = grid * 0.3 + edgeGlow + scanline + dataFlow;
    intensity *= (0.7 + speakingIntensity * 0.5);

    // Color mixing
    vec3 color = mix(baseColor, glowColor, edgeGlow + speakingIntensity * 0.3);
    color += glowColor * scanline;
    color += glowColor * dataFlow * 0.5;

    // Pulsing core glow
    float corePulse = sin(time * 2.0) * 0.1 + 0.9;
    color *= corePulse;

    // Final color with alpha
    float alpha = opacity * (0.3 + intensity * 0.7);
    alpha = min(alpha, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

// Shader for floating orbs
export const orbVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const orbFragmentShader = `
  uniform vec3 color;
  uniform float time;
  uniform float intensity;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.0);

    // Pulsing glow
    float pulse = sin(time * 3.0) * 0.2 + 0.8;

    vec3 finalColor = color * (fresnel * 2.0 + 0.3) * pulse * intensity;
    float alpha = fresnel * 0.8 + 0.4;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Star field shader
export const starVertexShader = `
  attribute float size;
  attribute float brightness;

  varying float vBrightness;

  uniform float time;

  void main() {
    vBrightness = brightness;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Twinkle effect
    float twinkle = sin(time * 2.0 + position.x * 100.0) * 0.3 + 0.7;

    gl_PointSize = size * twinkle * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const starFragmentShader = `
  varying float vBrightness;

  uniform vec3 color;

  void main() {
    // Circular point with soft edges
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

    vec3 finalColor = color * vBrightness;

    gl_FragColor = vec4(finalColor, alpha * vBrightness);
  }
`;

// Wireframe overlay shader for the mesh lines
export const wireframeVertexShader = `
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const wireframeFragmentShader = `
  uniform vec3 color;
  uniform float opacity;
  uniform float time;

  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    // Animated lines traveling down
    float line = sin(vPosition.y * 30.0 - time * 2.0);
    line = smoothstep(0.95, 1.0, line);

    float alpha = opacity * (0.3 + line * 0.7);

    gl_FragColor = vec4(color, alpha);
  }
`;
