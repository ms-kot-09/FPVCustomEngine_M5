import { v3, quat, Vec3, Quat } from "../engine/math";
import economy from "../data/economy.json";
import type { InputState } from "../engine/input";

export type DroneType = "armed" | "kamikaze" | "dji";
export type DroneDef = {
  id: string;
  name: string;
  type: DroneType;
  weapon: string;
  thrust: number;
  rates: { roll: number; pitch: number; yaw: number };
  blast?: number;
  cost: number;
};

export type EnemyKind = "soldier" | "car" | "tank";
export type Enemy = { id:number; kind:EnemyKind; pos:Vec3; hp:number; };
export type MapDef = { id:string; name:string; cost:number; seed:number; theme:string; };

export class World {
  pos: Vec3 = [0, 4, -10];
  vel: Vec3 = [0, 0, 0];
  rot: Quat = quat.ident();
  angVel: Vec3 = [0, 0, 0];

  coins = 0;
  drone: DroneDef;
  map: MapDef;
  mode: "acro"|"angle" = "acro";

  drag = 0.02;
  angDrag = 0.02;

  fireCooldown = 0;
  kamikazeArmed = true;

  enemies: Enemy[] = [];
  private _eid = 1;
  private spawnTimer = 0;
  private nextSpawnIn = this.randSpawnInterval();
  private _rng = 1234567;

  constructor(drone: DroneDef, map: MapDef, mode:"acro"|"angle") {
    this.drone = drone; this.map = map; this.mode = mode;
    this.seed(map.seed);
    this.spawnInitial();
  }

  seed(s:number) { this._rng = (s|0) ^ 0xA5A5A5; }
  rnd(): number { this._rng = (this._rng*1664525 + 1013904223) >>> 0; return this._rng / 4294967296; }
  randRange(a:number,b:number){ return a + (b-a)*this.rnd(); }
  randSpawnInterval(){ return this.randRange((economy as any).spawn.interval_min, (economy as any).spawn.interval_max); }

  private spawnInitial() {
    this.addEnemies("soldier", 10, 26);
    this.addEnemies("car", 3, 32);
    this.addEnemies("tank", 2, 36);
  }
  private addEnemies(kind:EnemyKind, n:number, r:number) {
    for (let i=0;i<n;i++) {
      const a = this.rnd()*Math.PI*2;
      const d = this.rnd()*r;
      const p:Vec3 = [Math.cos(a)*d, 0, Math.sin(a)*d];
      const hp = kind==="soldier"?60 : kind==="car"?140 : 280;
      this.enemies.push({ id:this._eid++, kind, pos:p, hp });
    }
  }

  step(dt: number, input: InputState) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.nextSpawnIn) {
      this.spawnTimer = 0;
      this.nextSpawnIn = this.randSpawnInterval();
      const tier = Math.min(3, 1 + Math.floor(this.coins / 800));
      this.addEnemies("soldier", 2 + tier, 28 + tier*2);
      if (tier >= 2) this.addEnemies("car", 1, 34);
      if (tier >= 3) this.addEnemies("tank", 1, 40);
    }

    const throttle = v3.clamp((input.left.y + 1) * 0.5, 0, 1);
    const yawCmd = input.left.x;
    const pitchCmd = -input.right.y;
    const rollCmd = input.right.x;

    const up = quat.rotateVec3(this.rot, [0,1,0]) as any as Vec3;
    const thrust = this.drone.thrust * throttle;
    this.vel = v3.add(this.vel, v3.mul(up, thrust * dt));
    this.vel = v3.add(this.vel, [0, -9.81*dt, 0]);

    if (this.mode === "acro") {
      const desired:Vec3 = [
        pitchCmd * this.drone.rates.pitch * (Math.PI/180),
        yawCmd   * this.drone.rates.yaw   * (Math.PI/180),
        -rollCmd * this.drone.rates.roll  * (Math.PI/180),
      ];
      const err = v3.sub(desired, this.angVel);
      this.angVel = v3.add(this.angVel, v3.mul(err, 6 * dt));
    } else {
      const maxAngle = 55 * (Math.PI/180);
      const targetPitch = v3.clamp(pitchCmd * maxAngle, -maxAngle, maxAngle);
      const targetRoll  = v3.clamp(-rollCmd * maxAngle, -maxAngle, maxAngle);

      const upv = quat.rotateVec3(this.rot, [0,1,0]) as any as Vec3;
      const curRoll = Math.asin(v3.clamp(upv[0], -1, 1));
      const curPitch = Math.asin(v3.clamp(-upv[2], -1, 1));

      const kp = 6.5;
      const pitchRate = v3.clamp((targetPitch - curPitch) * kp, -6, 6);
      const rollRate  = v3.clamp((targetRoll - curRoll) * kp, -6, 6);
      const yawRate   = yawCmd * (this.drone.rates.yaw * (Math.PI/180));

      const desired:Vec3 = [pitchRate, yawRate, rollRate];
      const err = v3.sub(desired, this.angVel);
      this.angVel = v3.add(this.angVel, v3.mul(err, 7 * dt));
    }

    const wx=this.angVel[0], wy=this.angVel[1], wz=this.angVel[2];
    const wq:Quat = [wx, wy, wz, 0];
    const dq = quat.mul(this.rot, wq);
    this.rot = quat.norm([
      this.rot[0] + 0.5*dq[0]*dt,
      this.rot[1] + 0.5*dq[1]*dt,
      this.rot[2] + 0.5*dq[2]*dt,
      this.rot[3] + 0.5*dq[3]*dt,
    ]);

    this.vel = v3.add(this.vel, v3.mul(this.vel, -this.drag));
    this.angVel = v3.add(this.angVel, v3.mul(this.angVel, -this.angDrag));
    this.pos = v3.add(this.pos, v3.mul(this.vel, dt));

    if (this.pos[1] < 0.7) { this.pos[1] = 0.7; this.vel[1] = Math.max(0, this.vel[1]); }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (input.fire) this.fire();
  }

  private forward():Vec3 { return quat.rotateVec3(this.rot, [0,0,1]) as any as Vec3; }

  fire() {
    if (this.fireCooldown > 0) return;

    if (this.drone.type === "kamikaze") {
      if (!this.kamikazeArmed) return;
      this.explode(this.pos, this.drone.blast ?? 6, 140);
      this.kamikazeArmed = false;
      this.fireCooldown = 999;
      return;
    }

    const weapon = this.drone.weapon;
    if (weapon === "rocket") {
      const dir = this.forward();
      const p:Vec3 = [this.pos[0] + dir[0]*6, this.pos[1] + dir[1]*6, this.pos[2] + dir[2]*6];
      this.explode(p, 6, 95);
      this.fireCooldown = 0.7;
      return;
    }

    const dir = this.forward();
    let best: null | { e:Enemy; t:number } = null;
    for (const e of this.enemies) {
      const to = v3.sub(e.pos, this.pos);
      const t = v3.dot(to, dir);
      if (t < 0 || t > 140) continue;
      const closest = v3.sub(to, v3.mul(dir, t));
      const d = v3.len(closest);
      const hitRadius = e.kind==="soldier"?1.0 : e.kind==="car"?1.8 : 2.4;
      if (d < hitRadius) if (!best || t < best.t) best = { e, t };
    }
    if (best) {
      const dmg = weapon==="heavy_cannon"?34 : weapon==="heavy_laser"?24 : weapon==="laser"?18 : weapon==="smg"?14 : weapon==="burst"?16 : 10;
      best.e.hp -= dmg;
      if (best.e.hp <= 0) this.kill(best.e);
    }

    this.fireCooldown = weapon==="smg"?0.06 : weapon==="laser"?0.12 : 0.09;
  }

  explode(pos:Vec3, radius:number, damage:number) {
    for (const e of [...this.enemies]) {
      const dx = e.pos[0]-pos[0], dy = e.pos[1]-pos[1], dz = e.pos[2]-pos[2];
      const d = Math.hypot(dx,dy,dz);
      if (d < radius) {
        e.hp -= damage * (1 - d / radius);
        if (e.hp <= 0) this.kill(e);
      }
    }
  }

  kill(e:Enemy) {
    this.enemies = this.enemies.filter(x => x.id !== e.id);
    const rew = (economy as any).rewards?.[e.kind] ?? 5;
    this.coins += rew;
    const kind = (this.rnd() < 0.7) ? "soldier" : (this.rnd() < 0.7 ? "car" : "tank");
    const r = kind==="soldier"?28 : kind==="car"?34 : 40;
    this.addEnemies(kind as any, 1, r);
  }
}
