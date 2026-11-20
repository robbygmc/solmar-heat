// SOLMAR HEAT — shared tuning and constants.
// One clear job: every number the rest of the game agrees on lives here.
export const CONFIG = {
  // City layout: a grid of blocks separated by roads, with a beach and sea to the south.
  blockSize: 60,
  roadWidth: 14,
  blocks: 9, // 9 x 9 blocks
  sidewalk: 3,
  // Derived: half the city span, used to place the sea and the world bounds.
  cityHalf: (9 * 60 + 10 * 14) / 2, // 340

  // Player on foot.
  walkSpeed: 7,
  runSpeed: 11,
  jumpSpeed: 8,
  gravity: 22,
  playerRadius: 0.6,
  playerHeight: 1.8,

  // Driving (arcade).
  carAccel: 26,
  carBrake: 40,
  carReverse: 12,
  carMaxSpeed: 38,
  carMaxReverse: 10,
  carTurn: 1.9,
  carGrip: 6,
  carRadius: 2.2,

  // Traffic and pedestrians.
  trafficCount: 12,
  trafficSpeed: 9,
  pedCount: 26,
  pedSpeed: 1.6,

  // Wanted / police.
  wantedMax: 5,
  wantedDecaySeconds: 26,
  copFootSpeed: 6.4,
  copCarSpeed: 34,
  bustDistance: 1.6,
  bustSeconds: 2.5,

  // Combat.
  pistolDamage: 34,
  pistolRange: 70,
  pistolAmmo: 12,
  punchDamage: 20,
  punchRange: 2.2,
  playerMaxHealth: 100,

  // Music: the "Sunset over Solmar" synth loop (see audio.js).
  musicLevel: 0.14,
  musicDuckLevel: 0.05,

  // Camera.
  camDistance: 9,
  camHeight: 4.2,
  driveCamDistance: 10,
  driveCamHeight: 4.2,

  // Sunset look.
  sunColor: 0xffb36b,
  sunIntensity: 2.9,
  skyTop: 0x4d6fa5,
  skyMid: 0xff9a5c,
  skyLow: 0xffb37a,
  fogColor: 0xe8b088,
  fogNear: 300,
  fogFar: 950,
};

// Colours used across the city, cars and HUD. Warm sunset palette on purpose.
export const PALETTE = {
  asphalt: 0x5a5148,
  sidewalk: 0xa89e8a,
  sand: 0xdcc49a,
  sea: 0x2a7a9e,
  building: [0xcf8f6a, 0xb98a6d, 0xd9a06a, 0xa88a7a, 0xc47a5e, 0x9a7a8a],
  glass: 0x2c3e55,
  car: [0xc23b2e, 0x2e6fc2, 0xe8b93b, 0x3aa655, 0xd8d8d8, 0x222222, 0x7a4fc2, 0xe07a2e],
  police: 0x1c2f4a,
  taxi: 0xf2c230,
};
