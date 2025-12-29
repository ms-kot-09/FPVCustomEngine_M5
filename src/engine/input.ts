export type StickState = { x: number; y: number; active: boolean };
export type InputState = { left: StickState; right: StickState; fire: boolean; pause: boolean };

function stick(zone: HTMLElement, knob: HTMLElement): StickState {
  const state: StickState = { x: 0, y: 0, active: false };
  let pid: number | null = null;

  const update = (clientX: number, clientY: number) => {
    const r = zone.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (clientX - cx) / (r.width / 2);
    const dy = (clientY - cy) / (r.height / 2);
    let x = Math.max(-1, Math.min(1, dx));
    let y = Math.max(-1, Math.min(1, dy));
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    if (Math.hypot(x, y) < 0.08) { x = 0; y = 0; }
    state.x = x; state.y = y;
    knob.style.transform = `translate(${x * 120 - 50}%, ${y * 120 - 50}%)`;
  };

  const reset = () => {
    pid = null; state.active = false; state.x = 0; state.y = 0;
    knob.style.transform = "translate(-50%, -50%)";
  };

  zone.addEventListener("pointerdown", (e) => {
    pid = e.pointerId;
    (zone as any).setPointerCapture?.(pid);
    state.active = true;
    update(e.clientX, e.clientY);
  });
  zone.addEventListener("pointermove", (e) => { if (pid === e.pointerId) update(e.clientX, e.clientY); });
  zone.addEventListener("pointerup", (e) => { if (pid === e.pointerId) reset(); });
  zone.addEventListener("pointercancel", reset);

  return state;
}

export type GamepadProfile = {
  name: string;
  axes: { lx:number; ly:number; rx:number; ry:number };
  buttons: { fire:number; pause:number };
  deadzone?: number;
};

export const Profiles: GamepadProfile[] = [
  { name: "PS4 DualShock (standard)", axes:{lx:0, ly:1, rx:2, ry:3}, buttons:{fire:0, pause:9}, deadzone:0.08 },
  { name: "Generic Standard", axes:{lx:0, ly:1, rx:2, ry:3}, buttons:{fire:0, pause:9}, deadzone:0.10 },
];

function applyDeadzone(v:number, dz:number) {
  if (Math.abs(v) < dz) return 0;
  const s = (Math.abs(v) - dz) / (1 - dz);
  return Math.sign(v) * Math.max(0, Math.min(1, s));
}

export function createInput() {
  const leftZone = document.getElementById("leftZone")!;
  const rightZone = document.getElementById("rightZone")!;
  const leftKnob = document.getElementById("leftKnob")!;
  const rightKnob = document.getElementById("rightKnob")!;
  const fireBtn = document.getElementById("fireBtn")!;

  const left = stick(leftZone, leftKnob);
  const right = stick(rightZone, rightKnob);

  let fireDown = false;
  fireBtn.addEventListener("pointerdown", () => fireDown = true);
  fireBtn.addEventListener("pointerup", () => fireDown = false);
  fireBtn.addEventListener("pointercancel", () => fireDown = false);

  let pause = false;
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") pause = true; });

  let gpProfile: GamepadProfile = Profiles[0];

  const getGamepad = (): Gamepad | null => {
    const gps = navigator.getGamepads?.() || [];
    for (const g of gps) if (g) return g;
    return null;
  };

  const sample = (): InputState => {
    const st: InputState = { left: {...left}, right: {...right}, fire: fireDown, pause: pause };
    pause = false;

    const g = getGamepad();
    if (!g) return st;

    const dz = gpProfile.deadzone ?? 0.1;
    const ax = g.axes;
    const btn = g.buttons;

    const lx = applyDeadzone(ax[gpProfile.axes.lx] ?? 0, dz);
    const ly = applyDeadzone(ax[gpProfile.axes.ly] ?? 0, dz);
    const rx = applyDeadzone(ax[gpProfile.axes.rx] ?? 0, dz);
    const ry = applyDeadzone(ax[gpProfile.axes.ry] ?? 0, dz);

    if (!left.active) { st.left.x = lx; st.left.y = ly; }
    if (!right.active) { st.right.x = rx; st.right.y = ry; }

    st.fire = st.fire || !!(btn[gpProfile.buttons.fire]?.pressed);
    st.pause = st.pause || !!(btn[gpProfile.buttons.pause]?.pressed);
    return st;
  };

  const setProfile = (p: GamepadProfile) => { gpProfile = p; };

  return { sample, setProfile, getGamepad };
}
