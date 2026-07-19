/** PHOSPHOR palette — Blade Runner neon on deep night. Pure data. */

export const PALETTE = {
  night: 0x05070f,
  asphalt: 0x0d1322,
  asphaltSheen: 0x18294a,
  building: 0x111a30,
  buildingTop: 0x16223e,
  buildingEdge: 0x24406e,
  windowDark: 0x142038,
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
