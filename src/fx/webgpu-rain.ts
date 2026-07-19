/**
 * WebGPU compute-shader rain — THE SPIKE (plan §4, spec §4).
 *
 * Raw WebGPU: 4096 particles in a storage buffer, integrated by a compute
 * pass, rendered as additive streak quads via vertex-pulling, composited on
 * a transparent overlay canvas above the PixiJS canvas.
 *
 * Returns null when WebGPU is unavailable (unsupported GPU/driver — the
 * Linux caveat flagged in the research doc). Whether the PixiJS fallback
 * ships is the OPERATOR's call, not the spike's.
 */

export interface WebGpuRain {
  update(dt: number): void;
  destroy(): void;
}

const PARTICLE_COUNT = 4096;
const FLOATS_PER_PARTICLE = 6; // pos.xy vel.xy len seed

const WGSL = /* wgsl */ `
struct Particle {
  pos: vec2f,
  vel: vec2f,
  len: f32,
  seed: f32,
};
struct Uniforms {
  dt: f32,
  time: f32,
  aspect: f32,
  pad: f32,
};
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> u: Uniforms;

fn hash(n: f32) -> f32 {
  return fract(sin(n) * 43758.5453);
}

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&particles)) {
    return;
  }
  var p = particles[i];
  p.pos += p.vel * u.dt;
  if (p.pos.y > 1.05 || p.pos.x < -0.1) {
    p.pos.y = -0.05 - hash(p.seed * 91.7 + u.time) * 0.1;
    p.pos.x = hash(p.seed * 57.3 + u.time * 1.31) * 1.2 - 0.1;
  }
  particles[i] = p;
}
`;

const WGSL_RENDER = /* wgsl */ `
struct Particle {
  pos: vec2f,
  vel: vec2f,
  len: f32,
  seed: f32,
};
struct Uniforms {
  dt: f32,
  time: f32,
  aspect: f32,
  pad: f32,
};
@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) fade: f32,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VsOut {
  let p = particles[ii];
  // two triangles forming a quad: corner.x in {0,1}, corner.y in {0,1}
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u));
  let dir = normalize(p.vel);
  let perp = vec2f(-dir.y, dir.x);
  let halfWidth = 0.0009;
  var offset = perp * (corner.x - 0.5) * halfWidth * 2.0;
  offset += dir * corner.y * p.len;
  offset.x = offset.x / u.aspect; // keep streak width square in pixels
  let clip = vec2f((p.pos.x + offset.x) * 2.0 - 1.0, 1.0 - (p.pos.y + offset.y) * 2.0);
  var out: VsOut;
  out.pos = vec4f(clip, 0.0, 1.0);
  out.fade = 1.0 - corner.y;
  return out;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let rgb = vec3f(0.616, 0.722, 0.851); // palette rainStreak #9db8d9
  let a = in.fade * 0.45;
  return vec4f(rgb * a, a);
}
`;

export async function createWebGpuRain(
  canvas: HTMLCanvasElement,
  seed: number,
): Promise<WebGpuRain | null> {
  if (!('gpu' in navigator) || !navigator.gpu) return null;

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) return null;
  const gpuContext: GPUCanvasContext = context; // narrowed binding for closures

  const format = navigator.gpu.getPreferredCanvasFormat();
  gpuContext.configure({ device, format, alphaMode: 'premultiplied' });

  // --- particle storage buffer, seeded on CPU (LCG — deterministic) ---
  const particleBuffer = device.createBuffer({
    size: PARTICLE_COUNT * FLOATS_PER_PARTICLE * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const init = new Float32Array(PARTICLE_COUNT * FLOATS_PER_PARTICLE);
  let s = seed >>> 0;
  const rnd = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const o = i * FLOATS_PER_PARTICLE;
    init[o] = rnd() * 1.2 - 0.1; // x in [-0.1, 1.1]
    init[o + 1] = rnd() * 1.2 - 0.2; // y in [-0.2, 1.0]
    init[o + 2] = -(0.03 + rnd() * 0.02); // vx — wind slant
    init[o + 3] = 0.7 + rnd() * 0.35; // vy
    init[o + 4] = 0.02 + rnd() * 0.025; // streak length
    init[o + 5] = rnd(); // seed
  }
  device.queue.writeBuffer(particleBuffer, 0, init);

  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // --- compute pipeline ---
  const simModule = device.createShaderModule({ code: WGSL });
  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: simModule, entryPoint: 'simulate' },
  });
  const computeBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
    ],
  });

  // --- render pipeline (vertex-pulling, additive) ---
  const renderModule = device.createShaderModule({ code: WGSL_RENDER });
  const renderPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: renderModule, entryPoint: 'vs' },
    fragment: {
      module: renderModule,
      entryPoint: 'fs',
      targets: [
        {
          format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          },
        },
      ],
    },
    primitive: { topology: 'triangle-list' },
  });
  const renderBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
    ],
  });

  let time = 0;
  const uniforms = new Float32Array(4);

  function update(dt: number): void {
    time += dt;
    uniforms[0] = Math.min(dt, 0.1);
    uniforms[1] = time;
    uniforms[2] = canvas.width / Math.max(canvas.height, 1); // aspect
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    const encoder = device.createCommandEncoder();

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / 64));
    computePass.end();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: gpuContext.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.draw(6, PARTICLE_COUNT);
    renderPass.end();

    device.queue.submit([encoder.finish()]);
  }

  function destroy(): void {
    particleBuffer.destroy();
    uniformBuffer.destroy();
    device.destroy();
  }

  return { update, destroy };
}
