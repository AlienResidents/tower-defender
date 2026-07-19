/** PHOSPHOR palette — Blade Runner neon on deep night. Pure data. */

export const PALETTE = {
  night: 0x05070f,
  asphalt: 0x0a0e1a,
  asphaltSheen: 0x141f38,
  building: 0x0b1020,
  buildingTop: 0x101830,
  buildingEdge: 0x24406e,
  windowDark: 0x0e1628,
  windowLit: 0x2a3d5c,
  windowWarm: 0x6b4d1f,

  cyan: 0x00e5ff,
  magenta: 0xff2bd6,
  amber: 0xffa63d,
  red: 0xff3355,
  holoBlue: 0x4d7cff,

  rainStreak: 0x9db8d9,
  searchlight: 0xcfe8ff,
  headlight: 0xfff2cc,
  engineGlow: 0x66d9ff,
  smoke: 0x8a9bb8,
} as const;

/** Neon hues usable for signage. */
export const NEON_SIGN_COLORS: readonly number[] = [
  PALETTE.cyan,
  PALETTE.magenta,
  PALETTE.amber,
  PALETTE.red,
  PALETTE.holoBlue,
] as const;
