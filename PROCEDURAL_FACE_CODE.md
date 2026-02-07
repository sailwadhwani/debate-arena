# Exact Code to Replace OBJ Loading with Procedural Face

Give this entire file to Opus. This is a DROP-IN REPLACEMENT for the OBJ loading code.

---

## Step 1: Remove These Imports (line 6-7)

DELETE these lines:
```typescript
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
```

---

## Step 2: Remove These Functions (lines 274-373)

DELETE the entire `normalizeMesh`, `samplePointsOnSurface`, and `loadFaceModel` functions.

DELETE the cached variables:
```typescript
let cachedFacePositions: Float32Array | null = null;
let cachedSmallFacePositions: Float32Array | null = null;
```

DELETE the constant:
```typescript
const FACE_MODEL = "/models/face2.obj";
```

---

## Step 3: Add This Code Instead (paste after line 52, after PARTICLE_COUNT definitions)

```typescript
// ============================================================================
// PROCEDURAL FACE GENERATOR - No OBJ file needed
// ============================================================================

// Cache for generated face positions
let cachedFacePositions: Float32Array | null = null;
let cachedSmallFacePositions: Float32Array | null = null;

/**
 * Generates a humanoid face shape using mathematical functions.
 * This produces a recognizable head with eye sockets, nose, mouth, and skull shape.
 */
function generateProceduralFace(particleCount: number, scale: number = 10): Float32Array {
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    // Use spherical coordinates as base
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2; // Around the head (0 to 2PI)
    const phi = Math.acos(2 * v - 1); // Top to bottom (0 to PI)

    // Base head shape - slightly elongated sphere (taller than wide)
    let radius = 1.0;
    const headHeight = 1.3; // Makes head taller

    // Convert to cartesian for deformation calculations
    let x = Math.sin(phi) * Math.cos(theta);
    let y = Math.cos(phi) * headHeight; // Stretch vertically
    let z = Math.sin(phi) * Math.sin(theta);

    // Face is on the +Z side (front)
    const isFrontFace = z > 0.3;
    const isUpperFace = y > -0.2 && y < 0.8;
    const faceFactor = isFrontFace ? 1 : 0;

    // === SKULL SHAPE ===
    // Flatten the back of the head slightly
    if (z < -0.5) {
      radius *= 0.92;
    }

    // Narrow the sides of the head (temples)
    if (Math.abs(x) > 0.7 && y > 0 && y < 0.6) {
      radius *= 0.95;
    }

    // === FOREHEAD ===
    // Slight forehead bulge
    if (y > 0.5 && y < 1.0 && z > 0.2) {
      radius *= 1.05;
    }

    // === EYE SOCKETS ===
    // Left eye socket
    const leftEyeX = -0.35;
    const eyeY = 0.25;
    const eyeZ = 0.85;
    const distToLeftEye = Math.sqrt(
      Math.pow(x - leftEyeX, 2) +
      Math.pow(y - eyeY, 2) +
      Math.pow(z - eyeZ, 2)
    );
    if (distToLeftEye < 0.25) {
      radius *= 0.75 + distToLeftEye * 0.8; // Deeper in center
    }

    // Right eye socket
    const rightEyeX = 0.35;
    const distToRightEye = Math.sqrt(
      Math.pow(x - rightEyeX, 2) +
      Math.pow(y - eyeY, 2) +
      Math.pow(z - eyeZ, 2)
    );
    if (distToRightEye < 0.25) {
      radius *= 0.75 + distToRightEye * 0.8;
    }

    // === BROW RIDGE ===
    // Add prominent brow above eyes
    if (y > 0.35 && y < 0.5 && z > 0.7 && Math.abs(x) < 0.55) {
      radius *= 1.08;
    }

    // === NOSE ===
    // Nose bridge
    if (Math.abs(x) < 0.12 && y > -0.1 && y < 0.3 && z > 0.75) {
      radius *= 1.15;
    }
    // Nose tip - more prominent
    if (Math.abs(x) < 0.15 && y > -0.15 && y < 0.05 && z > 0.8) {
      radius *= 1.25;
    }
    // Nostrils area - slightly wider
    if (Math.abs(x) < 0.2 && Math.abs(x) > 0.08 && y > -0.2 && y < -0.05 && z > 0.7) {
      radius *= 1.1;
    }

    // === CHEEKBONES ===
    // Prominent cheekbones
    if (Math.abs(x) > 0.4 && Math.abs(x) < 0.7 && y > -0.1 && y < 0.2 && z > 0.3) {
      radius *= 1.08;
    }

    // === MOUTH AREA ===
    // Slight indent for mouth
    if (Math.abs(x) < 0.35 && y > -0.45 && y < -0.25 && z > 0.7) {
      radius *= 0.95;
    }
    // Lips - slight protrusion
    if (Math.abs(x) < 0.25 && y > -0.4 && y < -0.3 && z > 0.8) {
      radius *= 1.05;
    }

    // === CHIN ===
    // Chin protrusion
    if (Math.abs(x) < 0.25 && y > -0.8 && y < -0.5 && z > 0.5) {
      radius *= 1.1;
    }
    // Chin point
    if (Math.abs(x) < 0.15 && y > -0.9 && y < -0.7 && z > 0.4) {
      radius *= 1.08;
    }

    // === JAW ===
    // Jawline
    if (Math.abs(x) > 0.3 && Math.abs(x) < 0.6 && y > -0.7 && y < -0.3 && z > 0) {
      radius *= 1.05;
    }

    // === EARS (subtle bumps on sides) ===
    if (Math.abs(x) > 0.85 && y > -0.2 && y < 0.3 && Math.abs(z) < 0.3) {
      radius *= 1.15;
    }

    // === NECK (taper at bottom) ===
    if (y < -0.8) {
      const neckFactor = 1 - ((-0.8 - y) * 0.5);
      radius *= Math.max(0.6, neckFactor);
    }

    // Apply radius and scale
    positions[i * 3] = x * radius * scale;
    positions[i * 3 + 1] = y * radius * scale;
    positions[i * 3 + 2] = z * radius * scale;
  }

  return positions;
}

/**
 * Loads face data - generates procedurally instead of loading OBJ.
 * Returns same structure as the original loadFaceModel function.
 */
async function loadFaceModel(): Promise<{ large: Float32Array; small: Float32Array } | null> {
  // Return cached if available
  if (cachedFacePositions && cachedSmallFacePositions) {
    return { large: cachedFacePositions, small: cachedSmallFacePositions };
  }

  // Generate procedural faces
  // Large face for main speaking agent (scale 10 = ~20 unit diameter)
  cachedFacePositions = generateProceduralFace(PARTICLE_COUNT, 10);

  // Small face for waiting agents (scale 4.5 = ~9 unit diameter)
  cachedSmallFacePositions = generateProceduralFace(SMALL_PARTICLE_COUNT, 4.5);

  console.log("[Face] Generated procedural faces - large:", PARTICLE_COUNT, "small:", SMALL_PARTICLE_COUNT);

  return { large: cachedFacePositions, small: cachedSmallFacePositions };
}
```

---

## That's It!

The rest of the code stays exactly the same. The `loadFaceModel()` function returns the same data structure, so all the existing code that uses it will work unchanged.

---

## How It Works

The procedural face generator creates particles in these areas:

1. **Base Shape**: Spherical coordinates converted to cartesian
2. **Eye Sockets**: Two indentations at typical eye positions
3. **Brow Ridge**: Slight bulge above eyes
4. **Nose**: Bridge, tip, and nostril areas with protrusions
5. **Cheekbones**: Prominent bone structure
6. **Mouth/Lips**: Indent for mouth, slight lip protrusion
7. **Chin**: Forward-projecting chin shape
8. **Jaw**: Defined jawline on sides
9. **Ears**: Subtle bumps on sides
10. **Neck**: Tapered bottom

The math uses distance checks and coordinate ranges to determine which facial feature each particle belongs to, then modifies the radius to create indents (multiply by < 1) or protrusions (multiply by > 1).

---

## Full DebateScene.tsx Header After Changes

The top of your file should look like this:

```typescript
"use client";

import { Suspense, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import type { DebateArgument, DebateSummary } from "@/lib/agents/types";

// ============================================================================
// AGENT VISUAL SIGNATURES - Icons/symbols for each agent type
// ============================================================================
const AGENT_SIGNATURES: Record<string, { symbols: string[]; orbits: number }> = {
  // ... rest stays the same
};

interface Agent {
  id: string;
  name: string;
  color: string;
}

type DebateStatus = "idle" | "loading" | "debating" | "paused" | "concluding" | "complete" | "error";

// ... interfaces stay the same ...

const PARTICLE_COUNT = 15000;
const SMALL_PARTICLE_COUNT = 8000;

// ============================================================================
// PROCEDURAL FACE GENERATOR - No OBJ file needed
// ============================================================================

// Cache for generated face positions
let cachedFacePositions: Float32Array | null = null;
let cachedSmallFacePositions: Float32Array | null = null;

// ... paste the generateProceduralFace and loadFaceModel functions here ...

// Shaders
const vertexShader = `
  // ... rest of file continues unchanged ...
```

---

## Verification

After making these changes:

1. The app should load without any network requests to `/models/*.obj`
2. You should see humanoid face shapes made of particles
3. The face should have recognizable features (eyes, nose, mouth, chin)
4. The morphing animation should work exactly as before

The procedural generation happens synchronously and is cached, so it's actually faster than loading OBJ files!
