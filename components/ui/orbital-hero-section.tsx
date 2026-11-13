"use client";

import * as React from "react";
import { useEffect, useRef } from "react";

/* -------------------------------------------------------------------------- */
/*  What this draws                                                           */
/*                                                                            */
/*  The Sun does not sit still. Relative to the stars around it, it moves at   */
/*  19.4 km/s toward the solar apex in Hercules. The planets keep running      */
/*  their Kepler ellipses around it, so the path each planet actually cuts     */
/*  through space is an ellipse plus a straight drift: a helix.                */
/*                                                                            */
/*  The camera travels with the Sun. That is why the Sun stays put, the        */
/*  background stars slide past with real depth parallax, and every planet     */
/*  leaves a spiral behind it as it chases the Sun.                            */
/*                                                                            */
/*  One thing here is drawn for looks rather than for truth, and it is worth   */
/*  naming. By default the orbits are swung square to the Sun's course, which  */
/*  makes every wake a helix about one shared axis and lays the coils out      */
/*  parallel. That is the geometry of the popular "vortex" video, and it is    */
/*  not ours: the real ecliptic leans 53 degrees to the course, so the real    */
/*  helices lean too. alignToCourse={0} gives you that instead.                */
/* -------------------------------------------------------------------------- */

export type Planet = {
  name: string;
  /** Semi-major axis, in astronomical units. */
  a: number;
  /** Eccentricity. */
  e: number;
  /** Inclination to the ecliptic, in degrees. */
  i: number;
  /** Longitude of the ascending node, in degrees. */
  node: number;
  /** Argument of perihelion, in degrees. */
  peri: number;
  /** Mean anomaly at the J2000 epoch, in degrees. */
  M0: number;
  color: string;
  /** Dot radius in px. Not to scale — nothing would be visible if it were. */
  size: number;
  /** Per-planet brightness multiplier. */
  glow?: number;
};

export interface OrbitalHeroSectionProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Bodies to run. Defaults to Mercury through Saturn with J2000 elements. */
  planets?: Planet[];
  /** Seconds of wall clock per Earth year. */
  yearSeconds?: number;
  /** How much past track each planet keeps, in Earth years. */
  trailYears?: number;
  /**
   * Radial squeeze, applied to the drawing only: a planet at r AU is drawn at
   * r^compress. At 1 the map is the true solar system, where Neptune is 78
   * times further out than Mercury and everything inside Jupiter is a speck.
   * Around 0.42 the orbits spread out evenly across the frame. Orbit shapes,
   * eccentricities and tilts survive the squeeze; Kepler's third law is then
   * applied to the drawn spacing, so the inner planets still outrun the outer
   * ones and every planet still sweeps equal areas in equal times.
   */
  compress?: number;
  /** Cap on how many turns of wake a fast planet keeps, so it stays readable. */
  maxTurns?: number;
  /**
   * Fans the orbit planes apart, 0 to 1. The real planets all run within 7° of
   * one plane, so at 0 you get the true article: a flat nested disc seen at an
   * angle. Turning this up tips each orbit onto its own plane, and the loops
   * cross each other at all angles instead of nesting.
   */
  planeSpread?: number;
  /**
   * Stretches the orbits, 0 to 1. The real planets run rings: Venus is off a
   * circle by half a percent, and only Mercury reaches 0.21. At 0 you get
   * those. Turning it up draws each planet onto a longer, lopsided ellipse,
   * which puts the Sun visibly at the focus instead of the middle. The motion
   * stays Keplerian either way — same period, still sweeping equal areas, just
   * a harder swing through perihelion.
   */
  eccentricity?: number;
  /**
   * Swings every orbit onto the one plane standing square to the Sun's
   * course, 0 to 1. At 1 the wakes become true helices about a single shared
   * axis, so the coils run parallel — the tidy look. It is also the geometry
   * of the popular "vortex" video, and it is not ours: the real ecliptic
   * leans 53 degrees to the course, which is what you get at 0.
   */
  alignToCourse?: number;
  /**
   * The Sun's speed through the local star field, in drawn units per year.
   * Earth circles at 2π units a year, so 4.09 is the true 19.4 km/s ratio —
   * right, but it stretches the coils flat. Lower values wind them tighter.
   */
  driftSpeed?: number;
  /** Direction of travel: ecliptic longitude and latitude of the solar apex, in degrees. */
  apex?: [number, number];
  /** Half-width of the view, in AU. */
  viewRadius?: number;
  /** Camera pitch in degrees. 0 looks straight down on the ecliptic, 90 is edge-on. */
  tilt?: number;
  /** Camera yaw in degrees. */
  spin?: number;
  /**
   * Camera roll in degrees. Turns the picture about the line of sight, so it
   * sets which way the helix runs across the screen without touching the
   * viewing angle. Pick it with tilt and spin so the Sun's track lies flat in
   * the screen plane: that is the view where a helix reads as a helix. Seen
   * end-on its turns stack up and look like rings.
   */
  roll?: number;
  /** How far ahead of centre the Sun sits, as a fraction of the short side. */
  lead?: number;
  /**
   * Where to put the Sun in the frame, as fractions of width and height.
   * [0.5, 0.5] centres it. Push it off to one side to clear a quiet corner
   * for hero copy.
   */
  focus?: [number, number];
  /**
   * Lays a black veil over one edge so text can sit there and still be read.
   * The veil is drawn last, over the whole scene, fading out by two thirds of
   * the way across.
   */
  scrim?: "none" | "left" | "right" | "top" | "bottom";
  /** How dark the veil gets at the edge it starts from, 0 to 1. */
  scrimStrength?: number;
  /** Number of background stars. */
  starCount?: number;
  /** Overall bloom strength, 0 to 2. */
  glow?: number;
  /** Add a faint closed ellipse behind each planet. Off by default. */
  showOrbits?: boolean;
  /** Draw the Sun's own straight track through space. */
  showSunTrack?: boolean;
  /** Let the pointer nudge the camera. */
  interactive?: boolean;
  /** Freeze on the current frame. */
  paused?: boolean;
  sunColor?: string;
  children?: React.ReactNode;
}

/* -------------------------------------------------------------------------- */
/*  Real orbital elements, J2000, referred to the ecliptic                    */
/* -------------------------------------------------------------------------- */

export const SOLAR_SYSTEM: Planet[] = [
  { name: "Mercury", a: 0.38710, e: 0.20563, i: 7.005, node: 48.331, peri: 29.125, M0: 174.796, color: "#fff0d0", size: 2.2 },
  { name: "Venus",   a: 0.72333, e: 0.00677, i: 3.395, node: 76.680, peri: 54.853, M0: 50.115,  color: "#ffc65a", size: 3.4 },
  { name: "Earth",   a: 1.00000, e: 0.01671, i: 0.000, node: 348.739, peri: 114.208, M0: 357.517, color: "#5fd8ff", size: 3.8, glow: 1.1 },
  { name: "Mars",    a: 1.52371, e: 0.09339, i: 1.850, node: 49.558, peri: 286.483, M0: 19.373, color: "#ff4a32", size: 2.9 },
  { name: "Jupiter", a: 5.20290, e: 0.04839, i: 1.303, node: 100.464, peri: 273.867, M0: 20.020, color: "#ffa62e", size: 5.4 },
  { name: "Saturn",  a: 9.53700, e: 0.05386, i: 2.485, node: 113.665, peri: 339.392, M0: 317.020, color: "#ffd884", size: 4.8 },
  { name: "Uranus",  a: 19.1913, e: 0.04726, i: 0.773, node: 74.006, peri: 98.999, M0: 142.238, color: "#7fe6ff", size: 4.2 },
  { name: "Neptune", a: 30.0690, e: 0.00859, i: 1.770, node: 131.784, peri: 276.336, M0: 256.228, color: "#3f7dff", size: 4.4 },
];

/** Just the four rocky ones, for a tighter frame. */
export const INNER_PLANETS: Planet[] = SOLAR_SYSTEM.slice(0, 4);

/**
 * Extra tilt and swing added to each orbit plane at planeSpread = 1, in
 * degrees. Fixed rather than random, so the rosette they make is the same
 * every load and on the server as on the client.
 */
const PLANE_FAN: Array<[number, number]> = [
  [58, 35], [27, 145], [71, 250], [40, 80],
  [84, 190], [33, 310], [62, 120], [15, 20],
];

/** Eccentricity each orbit is pulled toward at eccentricity = 1. */
const ECC_FAN = [0.52, 0.34, 0.63, 0.44, 0.3, 0.58, 0.4, 0.68];

/* -------------------------------------------------------------------------- */
/*  Maths                                                                     */
/* -------------------------------------------------------------------------- */

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

/**
 * Kepler's equation M = E − e·sin E, solved for the eccentric anomaly.
 * Newton's method; at solar-system eccentricities three passes are plenty.
 */
function eccentricAnomaly(M: number, e: number): number {
  let m = M % TAU;
  if (m < 0) m += TAU;
  let E = m + e * Math.sin(m) * (1 + e * Math.cos(m));
  for (let k = 0; k < 8; k++) {
    const step = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-10) break;
  }
  return E;
}

function parseRGB(color: string): [number, number, number] {
  const c = color.trim();
  if (c[0] === "#") {
    const hex = c.slice(1);
    const full =
      hex.length === 3 ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] : hex.slice(0, 6);
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/(\d+(?:\.\d+)?)/g);
  if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  return [255, 255, 255];
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function OrbitalHeroSection({
  planets = SOLAR_SYSTEM,
  yearSeconds = 16,
  trailYears = 2.6,
  compress = 0.42,
  maxTurns = 3,
  planeSpread = 1,
  eccentricity = 0.25,
  alignToCourse = 1,
  driftSpeed = 1.5,
  apex = [272, 53],
  viewRadius = 3.4,
  // Pitch and yaw are picked together so the Sun's track leaves the frame at
  // about 38° below the horizon, and it runs up and to the right.
  tilt = 45,
  spin = 252,
  roll = 13.5,
  lead = 0.12,
  focus = [0.5, 0.5],
  scrim = "none",
  scrimStrength = 0.88,
  starCount = 1500,
  glow = 1,
  showOrbits = false,
  showSunTrack = true,
  interactive = true,
  paused = false,
  sunColor = "#FFF2CC",
  className = "",
  children,
  ...rest
}: OrbitalHeroSectionProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const props = useRef({
    planets, yearSeconds, trailYears, compress, maxTurns, planeSpread, eccentricity, alignToCourse, driftSpeed, apex,
    viewRadius, tilt, spin, roll, lead, focus, scrim, scrimStrength, starCount, glow, showOrbits, showSunTrack,
    interactive, paused, sunColor,
  });
  props.current = {
    planets, yearSeconds, trailYears, compress, maxTurns, planeSpread, eccentricity, alignToCourse, driftSpeed, apex,
    viewRadius, tilt, spin, roll, lead, focus, scrim, scrimStrength, starCount, glow, showOrbits, showSunTrack,
    interactive, paused, sunColor,
  };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    /** Simulation clock, in Earth years since J2000. */
    let years = reduced ? 1.7 : 0;
    let lastFrame = 0;
    let running = true;
    let visible = true;
    let raf = 0;

    /* --- camera ----------------------------------------------------------- */
    // World axes: x, y span the ecliptic, z points to the ecliptic north pole.
    // Screen basis is built from yaw about z, then pitch about the new x.
    let pxPerAU = 1;
    let cx = 0;
    let cy = 0;
    let camDist = 1; // camera standoff from the Sun, in AU
    // basis vectors in world coords
    const RIGHT = { x: 1, y: 0, z: 0 };
    const UP = { x: 0, y: 1, z: 0 };
    const FWD = { x: 0, y: 0, z: 1 }; // points from the Sun back toward the camera

    function setCamera(yawDeg: number, pitchDeg: number, rollDeg: number) {
      const A = yawDeg * RAD;
      const B = pitchDeg * RAD;
      const ca = Math.cos(A), sa = Math.sin(A);
      const cb = Math.cos(B), sb = Math.sin(B);
      const rx = ca, ry = sa, rz = 0;
      const ux = -sa * cb, uy = ca * cb, uz = sb;
      FWD.x = sa * sb; FWD.y = -ca * sb; FWD.z = cb;
      // Roll turns the picture about the line of sight. It changes nothing in
      // space — it only decides which way the helix runs across the screen,
      // which is why it can be set apart from the viewing angle.
      const C = rollDeg * RAD;
      const cr = Math.cos(C), sr = Math.sin(C);
      RIGHT.x = rx * cr + ux * sr;
      RIGHT.y = ry * cr + uy * sr;
      RIGHT.z = rz * cr + uz * sr;
      UP.x = -rx * sr + ux * cr;
      UP.y = -ry * sr + uy * cr;
      UP.z = -rz * sr + uz * cr;
    }

    // Scratch output for project(); reused to keep the hot loop allocation-free.
    const P = { x: 0, y: 0, depth: 0, s: 0, ok: false };

    /** World offset from the Sun → screen. */
    function project(dx: number, dy: number, dz: number) {
      const vx = dx * RIGHT.x + dy * RIGHT.y + dz * RIGHT.z;
      const vy = dx * UP.x + dy * UP.y + dz * UP.z;
      const vz = dx * FWD.x + dy * FWD.y + dz * FWD.z;
      const depth = camDist - vz;
      if (depth < 0.6) {
        P.ok = false;
        return;
      }
      const s = camDist / depth;
      P.x = cx + vx * pxPerAU * s;
      P.y = cy - vy * pxPerAU * s;
      P.depth = depth;
      P.s = s;
      P.ok = true;
    }

    /* --- the Sun's own velocity ------------------------------------------- */
    // Ecliptic longitude/latitude of the solar apex → a unit vector.
    const DIR = { x: 0, y: 0, z: 0 };
    function setApex(lonDeg: number, latDeg: number) {
      const l = lonDeg * RAD;
      const b = latDeg * RAD;
      DIR.x = Math.cos(b) * Math.cos(l);
      DIR.y = Math.cos(b) * Math.sin(l);
      DIR.z = Math.sin(b);
    }

    /* --- heliocentric position from orbital elements ---------------------- */
    type Elements = {
      p: Planet;
      rgb: [number, number, number];
      e: number; // eccentricity actually drawn
      aDraw: number; // semi-major axis after the radial squeeze
      period: number; // years, from Kepler's third law on the drawn spacing
      n: number; // mean motion, radians per year
      cw: number; sw: number; ci: number; si: number; cn: number; sn: number;
      M0: number;
      /** Turns the orbit plane onto the one square to the Sun's course. */
      swing: number[] | null;
    };

    function elementsOf(
      p: Planet, index: number, gamma: number, spread: number, ecc: number, align: number
    ): Elements {
      const aDraw = Math.pow(p.a, gamma);
      // Kepler's third law: P² ∝ a³, so P = a^1.5 years and n = 2π/P.
      const period = Math.pow(aDraw, 1.5);
      const fan = PLANE_FAN[index % PLANE_FAN.length];
      const inc = (p.i + spread * fan[0]) * RAD;
      const node = (p.node + spread * fan[1]) * RAD;
      const target = ECC_FAN[index % ECC_FAN.length];
      const ci = Math.cos(inc), si = Math.sin(inc);
      const cn = Math.cos(node), sn = Math.sin(node);
      return {
        p,
        rgb: parseRGB(p.color),
        e: Math.min(0.85, p.e + ecc * (target - p.e)),
        aDraw,
        period,
        n: TAU / period,
        cw: Math.cos(p.peri * RAD), sw: Math.sin(p.peri * RAD),
        ci, si, cn, sn,
        M0: p.M0 * RAD,
        swing: align > 0 ? swingToCourse(si * sn, -si * cn, ci, align) : null,
      };
    }

    /**
     * Builds the rotation that swings an orbit plane toward the one standing
     * square to the Sun's course. Feed it the plane's normal; at align = 1 the
     * normal ends up along the course, which makes every wake a true helix
     * about it, and all the helices share one axis.
     */
    function swingToCourse(
      nx: number, ny: number, nz: number, align: number
    ): number[] | null {
      // Aim at whichever end of the course the plane already leans toward, so
      // an orbit is never turned inside out.
      const s = nx * DIR.x + ny * DIR.y + nz * DIR.z >= 0 ? 1 : -1;
      let tx = nx + align * (s * DIR.x - nx);
      let ty = ny + align * (s * DIR.y - ny);
      let tz = nz + align * (s * DIR.z - nz);
      const tl = Math.hypot(tx, ty, tz);
      if (tl < 1e-9) return null;
      tx /= tl; ty /= tl; tz /= tl;
      // Rodrigues: rotate n onto the blended normal, about their cross product.
      let ax = ny * tz - nz * ty;
      let ay = nz * tx - nx * tz;
      let az = nx * ty - ny * tx;
      const al = Math.hypot(ax, ay, az);
      if (al < 1e-9) return null;
      ax /= al; ay /= al; az /= al;
      const c = Math.max(-1, Math.min(1, nx * tx + ny * ty + nz * tz));
      const sA = al > 1 ? 1 : al;
      const k = 1 - c;
      return [
        c + ax * ax * k, ax * ay * k - az * sA, ax * az * k + ay * sA,
        ay * ax * k + az * sA, c + ay * ay * k, ay * az * k - ax * sA,
        az * ax * k - ay * sA, az * ay * k + ax * sA, c + az * az * k,
      ];
    }

    const R3 = { x: 0, y: 0, z: 0 };
    /** Heliocentric position at mean anomaly M, already squeezed. Writes R3. */
    function helio(el: Elements, M: number, gamma: number) {
      const e = el.e;
      const E = eccentricAnomaly(M, e);
      const xo = el.p.a * (Math.cos(E) - e);
      const yo = el.p.a * Math.sqrt(1 - e * e) * Math.sin(E);
      // turn by the argument of perihelion, inside the orbit plane
      const x1 = xo * el.cw - yo * el.sw;
      const y1 = xo * el.sw + yo * el.cw;
      // tip the plane by the inclination
      const y2 = y1 * el.ci;
      const z2 = y1 * el.si;
      // swing round by the ascending node
      let x = x1 * el.cn - y2 * el.sn;
      let y = x1 * el.sn + y2 * el.cn;
      let z = z2;
      // swing the whole plane toward the Sun's course
      const S = el.swing;
      if (S) {
        const rx = S[0] * x + S[1] * y + S[2] * z;
        const ry = S[3] * x + S[4] * y + S[5] * z;
        const rz = S[6] * x + S[7] * y + S[8] * z;
        x = rx; y = ry; z = rz;
      }
      // Squeeze along the radius. Angles are untouched, so the tilt of every
      // orbit plane and the offset of the Sun from the ellipse centre survive.
      if (gamma !== 1) {
        const r = Math.sqrt(x * x + y * y + z * z);
        if (r > 1e-9) {
          const s = Math.pow(r, gamma - 1);
          x *= s; y *= s; z *= s;
        }
      }
      R3.x = x; R3.y = y; R3.z = z;
    }

    let elems: Elements[] = [];
    let elemsKey = "";
    function syncElements() {
      const C = props.current;
      const key =
        C.compress + "/" + C.planeSpread + "/" + C.eccentricity + "/" +
        C.alignToCourse + "/" + C.apex[0] + "," + C.apex[1] + "/" +
        C.planets.map((p) => p.name + p.a + p.e + p.color).join("|");
      if (key === elemsKey) return;
      elemsKey = key;
      elems = C.planets.map((p, idx) => elementsOf(p, idx, C.compress, C.planeSpread, C.eccentricity, C.alignToCourse));
    }

    /* --- background stars ------------------------------------------------- */
    let D_NEAR = 60;
    let D_FAR = 1400;
    const EMPTY = new Float64Array(0);
    let sx = EMPTY, sy = EMPTY, sz = EMPTY, sMag = EMPTY, sPhase = EMPTY;
    let sTint = new Uint8Array(0);
    let starN = 0;
    let rand = mulberry32(0xc0ffee);

    /** Place one star at a random spot in the frustum, at optional fixed depth. */
    function seedStar(k: number, depth?: number, edge?: 0 | 1 | 2 | 3) {
      const d =
        depth ?? D_NEAR * Math.pow(D_FAR / D_NEAR, Math.pow(rand(), 0.55));
      const halfW = (width * 0.5) * 1.15;
      const halfH = (height * 0.5) * 1.15;
      let ox: number, oy: number;
      if (edge === 0) { ox = -halfW; oy = (rand() * 2 - 1) * halfH; }
      else if (edge === 1) { ox = halfW; oy = (rand() * 2 - 1) * halfH; }
      else if (edge === 2) { ox = (rand() * 2 - 1) * halfW; oy = -halfH; }
      else if (edge === 3) { ox = (rand() * 2 - 1) * halfW; oy = halfH; }
      else { ox = (rand() * 2 - 1) * halfW; oy = (rand() * 2 - 1) * halfH; }
      const scale = d / (camDist * pxPerAU);
      const vx = ox * scale;
      const vy = -oy * scale;
      const vz = camDist - d;
      const wx = vx * RIGHT.x + vy * UP.x + vz * FWD.x + DIR.x * dist;
      const wy = vx * RIGHT.y + vy * UP.y + vz * FWD.y + DIR.y * dist;
      const wz = vx * RIGHT.z + vy * UP.z + vz * FWD.z + DIR.z * dist;
      sx[k] = wx; sy[k] = wy; sz[k] = wz;
      sMag[k] = Math.pow(rand(), 2.4);
      sPhase[k] = rand() * TAU;
      const t = rand();
      sTint[k] = t > 0.9 ? 1 : t < 0.08 ? 2 : 0;
    }

    /** Distance the Sun has travelled, in AU. */
    let dist = 0;

    function buildStars() {
      starN = Math.max(
        60,
        Math.round(props.current.starCount * Math.min(2, (width * height) / (1440 * 900)))
      );
      sx = new Float64Array(starN);
      sy = new Float64Array(starN);
      sz = new Float64Array(starN);
      sMag = new Float64Array(starN);
      sPhase = new Float64Array(starN);
      sTint = new Uint8Array(starN);
      rand = mulberry32(0xc0ffee);
      for (let k = 0; k < starN; k++) seedStar(k);
    }

    /* --- sprites ---------------------------------------------------------- */
    const glowCache = new Map<string, HTMLCanvasElement>();
    function glowSprite(color: string): HTMLCanvasElement {
      const hit = glowCache.get(color);
      if (hit) return hit;
      const R = 64;
      const c = document.createElement("canvas");
      c.width = c.height = R * 2;
      const g2 = c.getContext("2d")!;
      const [r, g, b] = parseRGB(color);
      const grad = g2.createRadialGradient(R, R, 0, R, R, R);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.15, `rgba(${r},${g},${b},0.95)`);
      grad.addColorStop(0.36, `rgba(${r},${g},${b},0.26)`);
      grad.addColorStop(0.66, `rgba(${r},${g},${b},0.05)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      g2.fillStyle = grad;
      g2.fillRect(0, 0, R * 2, R * 2);
      glowCache.set(color, c);
      return c;
    }

    /* --- sizing ----------------------------------------------------------- */
    function resize() {
      const rect = host!.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w === width && h === height) return;
      width = w;
      height = h;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      buildStars();
    }

    function layout() {
      const C = props.current;
      pxPerAU = (Math.min(width, height) * 0.5) / C.viewRadius;
      camDist = C.viewRadius * 3.1;
      D_NEAR = camDist * 5;
      D_FAR = camDist * 120;
      setApex(C.apex[0], C.apex[1]);
      setCamera(C.spin, C.tilt, C.roll);
    }

    /* --- pointer ---------------------------------------------------------- */
    let pointerX = 0, pointerY = 0, camX = 0, camY = 0;
    function onPointer(ev: PointerEvent) {
      if (!props.current.interactive) return;
      const rect = host!.getBoundingClientRect();
      pointerX = ((ev.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((ev.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    function onLeave() { pointerX = 0; pointerY = 0; }

    /* --- the star at the centre ------------------------------------------ */
    function drawSun(k: number, t: number) {
      const [r, g, b] = parseRGB(props.current.sunColor);
      const pulse = 1 + Math.sin(t * 2.1) * 0.02;
      const R = Math.max(5, Math.min(width, height) * 0.013) * pulse;

      const haze = ctx!.createRadialGradient(cx, cy, 0, cx, cy, R * 14);
      haze.addColorStop(0, `rgba(${r},${g},${b},${0.05 * k})`);
      haze.addColorStop(0.4, `rgba(255,190,110,${0.014 * k})`);
      haze.addColorStop(1, "rgba(255,160,80,0)");
      ctx!.fillStyle = haze;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * 14, 0, TAU);
      ctx!.fill();

      const outer = ctx!.createRadialGradient(cx, cy, 0, cx, cy, R * 4.6);
      outer.addColorStop(0, `rgba(${r},${g},${b},${0.34 * k})`);
      outer.addColorStop(0.3, `rgba(255,222,160,${0.1 * k})`);
      outer.addColorStop(0.62, `rgba(255,196,110,${0.025 * k})`);
      outer.addColorStop(1, "rgba(255,180,90,0)");
      ctx!.fillStyle = outer;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * 4.6, 0, TAU);
      ctx!.fill();

      const bloom = ctx!.createRadialGradient(cx, cy, 0, cx, cy, R * 2.3);
      bloom.addColorStop(0, `rgba(255,255,255,${k})`);
      bloom.addColorStop(0.42, `rgba(255,252,240,${0.7 * k})`);
      bloom.addColorStop(0.72, `rgba(${r},${g},${b},${0.22 * k})`);
      bloom.addColorStop(1, "rgba(255,210,140,0)");
      ctx!.fillStyle = bloom;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * 2.3, 0, TAU);
      ctx!.fill();

      ctx!.fillStyle = "rgba(255,255,255,1)";
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, TAU);
      ctx!.fill();
    }

    /* --- one frame -------------------------------------------------------- */
    function render(t: number) {
      const C = props.current;
      const k = C.glow;
      layout();
      syncElements();

      camX += (pointerX - camX) * 0.04;
      camY += (pointerY - camY) * 0.04;
      setCamera(C.spin + camX * 7, C.tilt + camY * 5, C.roll);

      dist = C.driftSpeed * t;

      cx = width * C.focus[0];
      cy = height * C.focus[1];
      project(DIR.x, DIR.y, DIR.z);
      if (P.ok) {
        const dxs = P.x - cx;
        const dys = P.y - cy;
        const len = Math.hypot(dxs, dys) || 1;
        const push = Math.min(width, height) * C.lead;
        cx += (dxs / len) * push;
        cy += (dys / len) * push;
      }

      ctx!.globalCompositeOperation = "source-over";
      ctx!.fillStyle = "#000000";
      ctx!.fillRect(0, 0, width, height);
      ctx!.globalCompositeOperation = "lighter";

      /* stars ------------------------------------------------------------- */
      const dRef = D_NEAR * 3.3;
      const left = -width * 0.12;
      const right = width * 1.12;
      const top = -height * 0.12;
      const bottom = height * 1.12;
      for (let s = 0; s < starN; s++) {
        project(sx[s] - DIR.x * dist, sy[s] - DIR.y * dist, sz[s] - DIR.z * dist);
        if (!P.ok || P.depth > D_FAR * 1.25) {
          seedStar(s);
          continue;
        }
        if (P.x < left || P.x > right || P.y < top || P.y > bottom) {
          seedStar(
            s,
            undefined,
            P.x < left ? 1 : P.x > right ? 0 : P.y < top ? 3 : 2
          );
          continue;
        }
        if (P.depth < D_NEAR * 0.75) continue;

        const near = Math.min(1, (P.depth - D_NEAR * 0.75) / (D_NEAR * 0.6));
        const far = 1 - Math.max(0, (P.depth - D_FAR * 0.78) / (D_FAR * 0.32));
        let a = (0.2 + sMag[s] * 1.05) * Math.pow(dRef / P.depth, 0.8) * near * far;
        if (a <= 0.012) continue;
        a *= 0.82 + 0.18 * Math.sin(t * 9 + sPhase[s]);
        const col = sTint[s] === 1 ? "175,205,255" : sTint[s] === 2 ? "255,214,170" : "255,255,255";
        const size = Math.min(2.3, 0.55 + sMag[s] * 1.5 * Math.pow(dRef / P.depth, 0.5));
        ctx!.fillStyle = `rgba(${col},${Math.min(1, a).toFixed(3)})`;
        if (size < 1.05) {
          ctx!.fillRect(P.x, P.y, size, size);
        } else {
          ctx!.beginPath();
          ctx!.arc(P.x, P.y, size * 0.5, 0, TAU);
          ctx!.fill();
        }
      }

      /* the Sun's own track through space ---------------------------------- */
      if (C.showSunTrack) {
        const back = C.driftSpeed * C.trailYears * 1.1;
        project(0, 0, 0);
        const hx = P.x, hy = P.y;
        project(-DIR.x * back, -DIR.y * back, -DIR.z * back);
        if (P.ok) {
          const grad = ctx!.createLinearGradient(hx, hy, P.x, P.y);
          grad.addColorStop(0, `rgba(255,246,214,${k})`);
          grad.addColorStop(0.45, `rgba(255,206,110,${0.55 * k})`);
          grad.addColorStop(1, "rgba(255,180,80,0)");
          ctx!.strokeStyle = grad;
          ctx!.lineCap = "round";
          ctx!.beginPath();
          ctx!.moveTo(hx, hy);
          ctx!.lineTo(P.x, P.y);
          ctx!.lineWidth = 11;
          ctx!.globalAlpha = 0.16;
          ctx!.stroke();
          ctx!.lineWidth = 4;
          ctx!.globalAlpha = 0.3;
          ctx!.stroke();
          ctx!.globalAlpha = 1;
          ctx!.lineWidth = 1.8;
          ctx!.stroke();
        }
      }

      /* orbit guides ------------------------------------------------------- */
      if (C.showOrbits) {
        for (const el of elems) {
          const [r, g, b] = el.rgb;
          const steps = 160;
          ctx!.beginPath();
          let started = false;
          for (let q = 0; q <= steps; q++) {
            const E = (q / steps) * TAU;
            const M = E - el.e * Math.sin(E);
            helio(el, M, C.compress);
            project(R3.x, R3.y, R3.z);
            if (!P.ok) { started = false; continue; }
            if (!started) { ctx!.moveTo(P.x, P.y); started = true; }
            else ctx!.lineTo(P.x, P.y);
          }
          ctx!.strokeStyle = `rgba(${r},${g},${b},${0.045 * k})`;
          ctx!.lineWidth = 4;
          ctx!.stroke();
          ctx!.strokeStyle = `rgba(${r},${g},${b},${0.3 * k})`;
          ctx!.lineWidth = 1;
          ctx!.stroke();
        }
      }

      /* planets and their helical wakes ------------------------------------ */
      type Shot = { el: Elements; x: number; y: number; depth: number; s: number };
      const shots: Shot[] = [];

      for (const el of elems) {
        const [r, g, b] = el.rgb;
        const bright = (el.p.glow ?? 1) * k;
        const span = Math.min(C.trailYears, C.maxTurns * el.period);
        const turns = span / el.period;
        const N = Math.max(
          48,
          Math.min(360, Math.ceil(turns * 46 * (1 + 2.2 * el.e)) + 48)
        );

        const xs = new Float64Array(N + 1);
        const ys = new Float64Array(N + 1);
        const okArr = new Uint8Array(N + 1);
        for (let q = 0; q <= N; q++) {
          const age = (1 - q / N) * span;
          const M = el.M0 + el.n * (t - age);
          helio(el, M, C.compress);
          const back = C.driftSpeed * age;
          project(R3.x - DIR.x * back, R3.y - DIR.y * back, R3.z - DIR.z * back);
          xs[q] = P.x; ys[q] = P.y; okArr[q] = P.ok ? 1 : 0;
          if (q === N && P.ok) {
            shots.push({ el, x: P.x, y: P.y, depth: P.depth, s: P.s });
          }
        }

        const stroke = (from: number, to: number, alpha: number, wide: number) => {
          ctx!.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
          ctx!.lineWidth = wide;
          ctx!.beginPath();
          let started = false;
          for (let q = from; q <= to; q++) {
            if (!okArr[q]) { started = false; continue; }
            if (!started) { ctx!.moveTo(xs[q], ys[q]); started = true; }
            else ctx!.lineTo(xs[q], ys[q]);
          }
          ctx!.stroke();
        };

        ctx!.lineCap = "round";
        ctx!.lineJoin = "round";
        stroke(Math.floor(N * 0.72), N, 0.05 * bright, 6.5);
        stroke(Math.floor(N * 0.86), N, 0.05 * bright, 3);

        ctx!.lineCap = "butt";
        ctx!.lineWidth = 1.3;
        for (let q = 0; q < N; q++) {
          if (!okArr[q] || !okArr[q + 1]) continue;
          const f = (q + 1) / N;
          const a = Math.pow(f, 2.6) * 0.95 * bright;
          if (a < 0.005) continue;
          ctx!.strokeStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
          ctx!.beginPath();
          ctx!.moveTo(xs[q], ys[q]);
          ctx!.lineTo(xs[q + 1], ys[q + 1]);
          ctx!.stroke();
        }
      }

      /* bodies, back to front around the Sun -------------------------------- */
      shots.sort((p, q) => q.depth - p.depth);
      const sizeScale = Math.min(width, height) / 660;
      const drawShot = (o: Shot) => {
        const depth = Math.min(1.3, Math.max(0.5, o.s));
        const size = o.el.p.size * depth * sizeScale;
        const bright = (o.el.p.glow ?? 1) * k;
        const R = size * 3.3;
        ctx!.globalAlpha = Math.min(1, 0.9 * bright);
        ctx!.drawImage(glowSprite(o.el.p.color), o.x - R, o.y - R, R * 2, R * 2);
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = "rgba(255,255,255,0.95)";
        ctx!.beginPath();
        ctx!.arc(o.x, o.y, size * 0.5, 0, TAU);
        ctx!.fill();
      };

      let idx = 0;
      while (idx < shots.length && shots[idx].depth > camDist) drawShot(shots[idx++]);
      drawSun(k, t);
      while (idx < shots.length) drawShot(shots[idx++]);

      ctx!.globalCompositeOperation = "source-over";

      /* the veil that copy sits on ----------------------------------------- */
      if (C.scrim !== "none") {
        const s = Math.max(0, Math.min(1, C.scrimStrength));
        const g =
          C.scrim === "left" ? ctx!.createLinearGradient(0, 0, width, 0)
          : C.scrim === "right" ? ctx!.createLinearGradient(width, 0, 0, 0)
          : C.scrim === "top" ? ctx!.createLinearGradient(0, 0, 0, height)
          : ctx!.createLinearGradient(0, height, 0, 0);
        for (let q = 0; q <= 12; q++) {
          const x = q / 12;
          g.addColorStop(x, `rgba(0,0,0,${(s * Math.pow(1 - x, 2.4)).toFixed(4)})`);
        }
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, width, height);
      }
    }

    /* --- loop ------------------------------------------------------------- */
    function tick(now: number) {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (!visible) { lastFrame = now; return; }
      const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
      lastFrame = now;
      if (!props.current.paused && !reduced) {
        years += dt / Math.max(0.1, props.current.yearSeconds);
      }
      render(years);
    }

    resize();
    render(years);
    if (!reduced) raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced || props.current.paused) render(years);
    });
    ro.observe(host);

    const io = new IntersectionObserver(
      (entries) => { visible = entries[0]?.isIntersecting ?? true; },
      { threshold: 0 }
    );
    io.observe(host);

    const onVisibility = () => { visible = !document.hidden; lastFrame = 0; };
    document.addEventListener("visibilitychange", onVisibility);
    host.addEventListener("pointermove", onPointer);
    host.addEventListener("pointerleave", onLeave);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={`relative isolate h-full w-full overflow-hidden bg-black ${className}`}
      {...rest}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      {children ? <div className="relative z-10 h-full w-full">{children}</div> : null}
    </div>
  );
}

export default OrbitalHeroSection;
