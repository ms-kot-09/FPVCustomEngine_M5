import { createGL, program, resizeCanvasToDisplaySize } from "../engine/webgl";
import { quat, v3 } from "../engine/math";
import type { World } from "./world";

function mat4Identity() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
function mat4Mul(a:Float32Array,b:Float32Array) {
  const o = new Float32Array(16);
  for (let c=0;c<4;c++) for (let r=0;r<4;r++) {
    o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
  }
  return o;
}
function mat4Translate(x:number,y:number,z:number) { const m = mat4Identity(); m[12]=x; m[13]=y; m[14]=z; return m; }
function mat4Scale(x:number,y:number,z:number) { const m = mat4Identity(); m[0]=x; m[5]=y; m[10]=z; return m; }
function mat4FromQuat(q:[number,number,number,number]) {
  const m = mat4Identity();
  const r = quat.toMat3(q);
  m[0]=r[0]; m[1]=r[1]; m[2]=r[2];
  m[4]=r[3]; m[5]=r[4]; m[6]=r[5];
  m[8]=r[6]; m[9]=r[7]; m[10]=r[8];
  return m;
}
function mat4Perspective(fovRad:number, aspect:number, near:number, far:number) {
  const f = 1/Math.tan(fovRad/2);
  const nf = 1/(near-far);
  const m = new Float32Array(16);
  m[0]=f/aspect; m[5]=f; m[10]=(far+near)*nf; m[11]=-1; m[14]=2*far*near*nf;
  return m;
}
function mat4LookFromDrone(pos:[number,number,number], rot:[number,number,number,number]) {
  const invRot: [number,number,number,number] = [-rot[0],-rot[1],-rot[2], rot[3]];
  const r = mat4FromQuat(invRot);
  const t = mat4Translate(-pos[0], -pos[1], -pos[2]);
  return mat4Mul(r, t);
}

export class Renderer {
  private gl: WebGL2RenderingContext;
  private p: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private uVP: WebGLUniformLocation;
  private uM: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;
  private uCamPos: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private uTheme: WebGLUniformLocation;
  private t0 = performance.now();

  constructor(private canvas: HTMLCanvasElement) {
    const gl = createGL(canvas);
    this.gl = gl;

    const vs = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPos;
    uniform mat4 uVP;
    uniform mat4 uM;
    out vec3 vPos;
    void main(){
      vec4 wp = uM * vec4(aPos, 1.0);
      vPos = wp.xyz;
      gl_Position = uVP * wp;
    }`;

    const fs = `#version 300 es
    precision highp float;
    in vec3 vPos;
    uniform vec4 uColor;
    uniform vec3 uCamPos;
    uniform float uTime;
    uniform float uTheme;
    out vec4 o;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
    void main(){
      float dist = length(vPos - uCamPos);
      float fog = smoothstep(22.0, 110.0, dist);
      vec3 tintA = mix(vec3(0.9,0.25,1.0), vec3(0.2,0.7,1.0), uTheme);
      vec3 base = uColor.rgb;
      float n = hash(vPos.xz*0.12) * 0.6 + 0.4;
      float glow = 0.35 + 0.65 * smoothstep(0.0, 1.0, abs(vPos.y)*0.12 + n*0.25);
      float pulse = 0.85 + 0.15*sin(uTime*1.2 + vPos.x*0.2 + vPos.z*0.2);
      vec3 col = base * glow * pulse;
      col += 0.06 * tintA * smoothstep(-0.2, 2.2, vPos.y);
      vec3 sky = mix(vec3(0.03,0.02,0.06), vec3(0.07,0.05,0.11), clamp((vPos.y+2.0)/8.0, 0.0, 1.0));
      col = mix(col, sky, fog);
      o = vec4(col, 1.0);
    }`;

    this.p = program(gl, vs, fs);
    this.uVP = gl.getUniformLocation(this.p, "uVP")!;
    this.uM = gl.getUniformLocation(this.p, "uM")!;
    this.uColor = gl.getUniformLocation(this.p, "uColor")!;
    this.uCamPos = gl.getUniformLocation(this.p, "uCamPos")!;
    this.uTime = gl.getUniformLocation(this.p, "uTime")!;
    this.uTheme = gl.getUniformLocation(this.p, "uTheme")!;

    const v = new Float32Array([
      -1,-1, 1,  1,-1, 1,  1, 1, 1,  -1,-1, 1,  1, 1, 1, -1, 1, 1,
      -1,-1,-1, -1, 1,-1,  1, 1,-1,  -1,-1,-1,  1, 1,-1,  1,-1,-1,
      -1,-1,-1, -1,-1, 1, -1, 1, 1,  -1,-1,-1, -1, 1, 1, -1, 1,-1,
       1,-1,-1,  1, 1,-1,  1, 1, 1,   1,-1,-1,  1, 1, 1,  1,-1, 1,
      -1, 1,-1, -1, 1, 1,  1, 1, 1,  -1, 1,-1,  1, 1, 1,  1, 1,-1,
      -1,-1,-1,  1,-1,-1,  1,-1, 1,  -1,-1,-1,  1,-1, 1, -1,-1, 1,
    ]);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);
  }

  frame(world: World) {
    const gl = this.gl;
    resizeCanvasToDisplaySize(this.canvas);
    gl.viewport(0,0,this.canvas.width,this.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.02,0.01,0.04,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.p);
    gl.bindVertexArray(this.vao);

    const aspect = this.canvas.width / this.canvas.height;
    const proj = mat4Perspective(Math.PI/2, aspect, 0.05, 320);
    const view = mat4LookFromDrone(world.pos, world.rot);
    const vp = mat4Mul(proj, view);
    gl.uniformMatrix4fv(this.uVP, false, vp);
    gl.uniform3f(this.uCamPos, world.pos[0], world.pos[1], world.pos[2]);
    gl.uniform1f(this.uTime, (performance.now()-this.t0)/1000);
    const theme = world.map.theme === "warehouse" ? 0.15 : world.map.theme === "industrial" ? 0.35 : world.map.theme === "city" ? 0.55 : world.map.theme === "docks" ? 0.75 : 0.0;
    gl.uniform1f(this.uTheme, theme);

    const groundCol = world.map.theme==="industrial" ? [0.08,0.10,0.12,1] : [0.06,0.06,0.09,1];
    this.drawBox([0,-0.45,0], [100,0.2,100], groundCol as any);

    const s = (world.map.seed % 97) + 17;
    const count = 20 + (s % 10);
    for (let i=0;i<count;i++) {
      const a = (i*0.77) + (s*0.01);
      const r = 14 + (i%7)*3.2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = 2.2 + (i%5)*0.9;
      const col = world.map.theme==="city" ? [0.20,0.20,0.23,1] : [0.9,0.25,1.0,1];
      this.drawBox([x, h*0.5, z], [0.8, h, 0.8], col as any);
    }

    for (const e of world.enemies) {
      const c = e.kind==="soldier" ? [0.2,0.2,0.2,1] : e.kind==="car" ? [0.14,0.14,0.24,1] : [0.10,0.22,0.12,1];
      const s2 = e.kind==="soldier" ? [0.6,1.2,0.6] : e.kind==="car" ? [2.3,0.9,4.1] : [3.0,1.3,5.0];
      this.drawBox(e.pos, s2 as any, c as any);
    }

    const fwd = quat.rotateVec3(world.rot, [0,0,1]) as any as [number,number,number];
    const bodyPos = v3.add(world.pos as any, v3.mul(fwd as any, 0.85) as any);
    this.drawBox(bodyPos as any, [0.26,0.09,0.26], [0.7,0.25,1.0,1]);

    gl.bindVertexArray(null);
  }

  private drawBox(pos:[number,number,number], scale:[number,number,number], color:[number,number,number,number]) {
    const gl = this.gl;
    const M = mat4Mul(mat4Translate(pos[0],pos[1],pos[2]), mat4Scale(scale[0],scale[1],scale[2]));
    gl.uniformMatrix4fv(this.uM, false, M);
    gl.uniform4f(this.uColor, color[0],color[1],color[2], color[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }
}
