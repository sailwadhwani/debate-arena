# Prompt for Claude Opus to Recreate Debate Arena

Copy this entire prompt and give it to Claude Opus along with the three documentation files.

---

## THE PROMPT

```
I want you to help me build a sophisticated AI debate application called "Debate Arena". I have comprehensive documentation that details every aspect of the implementation.

## What This Application Does

Debate Arena is a Next.js application where AI agents debate topics in real-time. The killer feature is a **3D particle visualization system** that renders 15,000 particles forming humanoid faces that morph between different agent appearances during debates.

## The Documentation Files

I'm providing you with three documentation files:

1. **RECREATION_GUIDE.md** - Complete technical guide with:
   - Project architecture and file structure
   - Step-by-step implementation instructions
   - Technology stack details
   - Critical code explanations

2. **COMPLETE_CODE_REFERENCE.md** - The full source code for:
   - DebateScene.tsx (the 3D visualization - this is the most important file)
   - All shader code for particle rendering
   - Complete component implementations

3. **CRITICAL_FILES.md** - All supporting files including:
   - Type definitions
   - State management
   - Event system
   - Hooks and contexts
   - Configuration files

## Implementation Priority

Start with these critical components in order:

### Priority 1: Project Setup
```bash
npx create-next-app@latest debate-arena --typescript --tailwind --app
cd debate-arena
npm install three @react-three/fiber @react-three/drei gsap zustand
```

### Priority 2: The Particle Face System (MOST IMPORTANT)
This is the "killer feature" - the 10 lines that make or break it:

```typescript
// 1. Sample points from OBJ mesh surface
const sampler = new MeshSurfaceSampler(mesh).build();
const positions = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  sampler.sample(tempPosition);
  positions[i * 3] = tempPosition.x * scale;
  positions[i * 3 + 1] = tempPosition.y * scale;
  positions[i * 3 + 2] = tempPosition.z * scale;
}

// 2. Morph particles using GSAP endArray
gsap.to(currentPositions, {
  duration: 1.0,
  endArray: targetPositions as unknown as number[],
  ease: "power3.inOut",
  onUpdate: () => {
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  },
});
```

### Priority 3: Core Files to Create First
1. `/lib/types.ts` - All TypeScript interfaces
2. `/lib/state.ts` - Zustand state management
3. `/lib/emitter.ts` - Event system for agent coordination
4. `/components/visualization-3d/DebateScene.tsx` - The 3D scene

### Priority 4: API Routes
1. `/app/api/debate/stream/route.ts` - SSE streaming
2. `/app/api/debate/start/route.ts` - Debate initialization

## Required OBJ Models

The particle system needs .obj files for face shapes. Create or source:
- `/public/models/agent1.obj` - First agent face
- `/public/models/agent2.obj` - Second agent face
- `/public/models/default.obj` - Neutral/idle state

You can use free humanoid head models from Sketchfab or create simple ones in Blender.

## Key Technical Decisions

1. **Why Three.js Points instead of Mesh?**
   - 15,000 individual particles can morph smoothly
   - Custom shaders give full control over appearance
   - Better performance than instanced meshes for this use case

2. **Why GSAP for morphing?**
   - `endArray` feature handles Float32Array morphing
   - Smooth easing between particle positions
   - Handles interruptions gracefully

3. **Why Server-Sent Events?**
   - Real-time streaming of debate arguments
   - Better than WebSockets for one-way data flow
   - Native browser support

## What I Want You To Do

1. Read all three documentation files thoroughly
2. Create the project structure as specified
3. Implement the particle face system first - this is the hardest part
4. Add the debate logic and API routes
5. Style with the cyberpunk/sci-fi theme

## Success Criteria

The app is successful when:
- [ ] Particles form a humanoid face shape
- [ ] Face morphs smoothly between agents during debate
- [ ] Agents debate with visible argument streaming
- [ ] Full sci-fi aesthetic with glowing effects

Please start by reading the documentation files I'm providing, then begin implementation. Ask me questions if anything is unclear, but the documentation should be comprehensive enough to build the entire application.
```

---

## How To Use This Prompt

1. Copy everything between the ``` marks above
2. Open Claude Opus in your workplace CLI
3. Paste the prompt
4. Then provide the three documentation files:
   - `RECREATION_GUIDE.md`
   - `COMPLETE_CODE_REFERENCE.md`
   - `CRITICAL_FILES.md`

You can either:
- Copy/paste the file contents directly after the prompt
- Or if your CLI supports file reading, point Claude to the files

---

## Alternative: Minimal Quick-Start Prompt

If you want a shorter prompt that focuses only on the particle face system:

```
I want to create a 3D particle visualization where 15,000 particles form a humanoid face and can morph between different face shapes.

Tech stack: Next.js, Three.js, @react-three/fiber, GSAP

The critical technique:
1. Load OBJ model using OBJLoader
2. Sample surface points using MeshSurfaceSampler
3. Store positions in Float32Array
4. Render as Three.js Points with custom shaders
5. Morph using GSAP's endArray feature

I'm providing complete source code in COMPLETE_CODE_REFERENCE.md. Please implement this particle face system.
```

---

## Tips for Best Results

1. **Provide context first** - Give Opus the full prompt before the code files
2. **One file at a time** - If context limits are an issue, provide files one by one
3. **Start with DebateScene.tsx** - This is the most important file
4. **Verify particle count** - 15,000 particles is the sweet spot for performance/detail
5. **Test morphing early** - The GSAP endArray trick is crucial - test it works before building more

---

## If Opus Asks Questions

Common questions and answers:

**Q: What LLM should I use for the debate agents?**
A: Any OpenAI-compatible API works. The code supports Ollama locally or OpenAI API. Configure in `/config/llm.json`.

**Q: Where do I get the OBJ models?**
A: Use any humanoid head model. Sketchfab has free options. The model quality matters less than having distinct shapes for each agent.

**Q: The particles don't form a face shape?**
A: Check that MeshSurfaceSampler is sampling the correct mesh (usually `children[0]` of the loaded OBJ). Add console.log to debug.

**Q: Morphing is choppy?**
A: Ensure you're calling `geometry.attributes.position.needsUpdate = true` in the GSAP onUpdate callback.
