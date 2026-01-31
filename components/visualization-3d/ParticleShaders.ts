export const particleVertexShader = `
  uniform vec3 uMouse;
  uniform float uRadius;
  uniform float uStrength;
  uniform float uSize;
  uniform float uTime;
  uniform float uFormProgress;
  uniform vec3 uCloudCenter;

  attribute float aRandom;
  attribute vec3 aCloudPosition;

  varying float vRandom;

  void main() {
    vRandom = aRandom;

    // Interpolate between cloud and face positions based on progress
    vec3 pos = mix(aCloudPosition, position, uFormProgress);

    // Add subtle floating animation
    float floatAmount = (1.0 - uFormProgress) * 2.0;
    pos.x += sin(uTime * 0.5 + aRandom * 6.28) * 0.1 * floatAmount;
    pos.y += cos(uTime * 0.4 + aRandom * 3.14) * 0.1 * floatAmount;
    pos.z += sin(uTime * 0.3 + aRandom * 1.57) * 0.08 * floatAmount;

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);

    // Mouse interaction
    float dist = distance(worldPosition.xyz, uMouse);
    float falloff = smoothstep(uRadius * (1.2 + aRandom * 0.5), 0.0, dist);

    if (falloff > 0.0) {
      vec3 repelDir = normalize(worldPosition.xyz - uMouse);
      vec3 randomDir = vec3(
        sin(pos.x * 0.15 + uTime * 0.0002 + aRandom * 6.28),
        cos(pos.y * 0.15 + uTime * 0.0002 + aRandom * 6.28),
        sin(pos.z * 0.15 + uTime * 0.0002 + aRandom * 6.28)
      );
      vec3 finalDir = normalize(repelDir * 0.3 + randomDir * 0.7);
      float displacement = falloff * uStrength * (0.8 + sin(uTime * 0.001 + aRandom * 6.28) * 0.2);
      worldPosition.xyz += finalDir * displacement;
    }

    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;

    // Size based on formation progress
    float sizeMultiplier = 0.8 + uFormProgress * 0.4;
    gl_PointSize = uSize * sizeMultiplier * (300.0 / -mvPosition.z);
  }
`;

export const particleFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uFormProgress;

  varying float vRandom;

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    // Soft edge glow
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);

    // Pulse effect
    float pulse = 0.9 + sin(vRandom * 6.28) * 0.1;

    // Increase brightness when formed
    vec3 finalColor = uColor * (0.8 + uFormProgress * 0.4);

    gl_FragColor = vec4(finalColor * pulse, alpha * uOpacity);
  }
`;
