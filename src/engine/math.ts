export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export const v3 = {
  add: (a:Vec3,b:Vec3):Vec3 => [a[0]+b[0], a[1]+b[1], a[2]+b[2]],
  sub: (a:Vec3,b:Vec3):Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
  mul: (a:Vec3,s:number):Vec3 => [a[0]*s, a[1]*s, a[2]*s],
  dot: (a:Vec3,b:Vec3)=> a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  len: (a:Vec3)=> Math.hypot(a[0],a[1],a[2]),
  cross: (a:Vec3,b:Vec3):Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  clamp: (v:number, a:number, b:number)=>Math.max(a, Math.min(b, v))
};

export const quat = {
  ident: ():Quat => [0,0,0,1],
  mul: (a:Quat,b:Quat):Quat => {
    const ax=a[0], ay=a[1], az=a[2], aw=a[3];
    const bx=b[0], by=b[1], bz=b[2], bw=b[3];
    return [
      aw*bx + ax*bw + ay*bz - az*by,
      aw*by - ax*bz + ay*bw + az*bx,
      aw*bz + ax*by - ay*bx + az*bw,
      aw*bw - ax*bx - ay*by - az*bz,
    ];
  },
  norm: (q:Quat):Quat => {
    const l=Math.hypot(q[0],q[1],q[2],q[3])||1;
    return [q[0]/l,q[1]/l,q[2]/l,q[3]/l];
  },
  rotateVec3: (q:Quat, v:Vec3):Vec3 => {
    const x=q[0], y=q[1], z=q[2], w=q[3];
    const uv = v3.cross([x,y,z], v);
    const uuv = v3.cross([x,y,z], uv);
    return v3.add(v, v3.add(v3.mul(uv as any, 2*w) as any, v3.mul(uuv as any, 2) as any) as any);
  },
  toMat3: (q:Quat):number[] => {
    const x=q[0], y=q[1], z=q[2], w=q[3];
    const xx=x*x, yy=y*y, zz=z*z;
    const xy=x*y, xz=x*z, yz=y*z;
    const wx=w*x, wy=w*y, wz=w*z;
    return [
      1-2*(yy+zz), 2*(xy+wz),   2*(xz-wy),
      2*(xy-wz),   1-2*(xx+zz), 2*(yz+wx),
      2*(xz+wy),   2*(yz-wx),   1-2*(xx+yy),
    ];
  }
};
