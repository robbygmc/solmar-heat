// SOLMAR HEAT — the entry point and game loop.
// One clear job: build the world, wire the systems together, run the loop, and
// own the screens (title, pause, wasted, busted) and the player's key actions
// (enter/exit a car, punch, shoot, reload, pause).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { buildCity, resolveCircleCollisions } from './city.js';
import { createTraffic } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer, createParkedCar } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { stageShot } from './shots.js';

const MISSIONS_DONE = 99;
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1) || 1;
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
// A slow orbit over the city behind the title screen.
camera.position.set(120, 90, 220);
camera.lookAt(0, 30, 0);

const rng = makeRng(seed);
const input = createInput(canvas);
const city = buildCity(scene, rng);
const audio = createAudio();
const traffic = createTraffic(scene, city, rng);
const peds = createPedestrians(scene, city, rng);

// Parked cars Mara can steal: the curb spots the city laid out.
const playerCars = [];
for (const spot of city.spawnPoints.parked) {
  playerCars.push(createParkedCar(scene, spot, rng));
}

const game = {
  scene,
  camera,
  renderer,
  city,
  rng,
  time: 0,
  screen: 'title', // title | play | pause | wasted | busted
  audio,
  traffic,
  peds,
  playerCars,
  player: null,
  playerController: null,
  police: null,
  missions: null,
  combat: null,
  hud: null,
  shot: null,
  // Every car in the world (traffic + parked + police), for collisions.
  allCars() {
    return [...traffic.cars, ...playerCars, ...this.police.cars.map((u) => u.car)];
  },
  toast(text, seconds) {
    this.hud.toast(text, seconds);
  },
  playerHurt(amount) {
    this.playerController.hurt(amount);
    if (this.player.health <= 0) this.onWasted();
  },
  playerCarDamage(amount) {
    this.player.carDamage = Math.min(100, this.player.carDamage + amount);
  },
  save() {
    saveGame(this);
  },
  onBusted() {
    if (this.screen !== 'play') return;
    this.screen = 'busted';
    audio.busted();
    audio.duckMusic(true);
    input.unlockPointer();
    this.police.reset();
    this.player.cash = Math.max(0, this.player.cash - 300);
    this.hud.show('busted');
  },
  onWasted() {
    if (this.screen !== 'play') return;
    this.screen = 'wasted';
    audio.busted();
    audio.duckMusic(true);
    input.unlockPointer();
    this.police.reset();
    this.player.cash = Math.max(0, this.player.cash - 200);
    this.hud.show('wasted');
  },
  respawn() {
    const hospital = city.landmarks.hospital;
    if (this.player.car) this.playerController.setCar(null);
    this.player.pos.set(hospital.x, 0, hospital.z);
    this.player.angle = 0;
    this.player.health = CONFIG.playerMaxHealth;
    this.player.ammo = CONFIG.pistolAmmo;
    this.player.carDamage = 0;
    this.screen = 'play';
    this.hud.show('play');
    audio.duckMusic(false);
    input.lockPointer();
    this.save();
  },
};

const start = city.spawnPoints.player;
const playerController = createPlayer(scene, city, input, start);
game.player = playerController.player;
game.playerController = playerController;
game.police = createPolice(scene, city, rng, game);
game.missions = createMissions(scene, city, game);
game.combat = createCombat(scene, game);
game.hud = createHud(game);

// For headless testing: the page exposes its game object.
window.__solmar = game;

// ---- Screens and buttons ----
const saved = loadGame();
const continueBtn = document.getElementById('btn-continue');
if (!saved) continueBtn.style.display = 'none';
document.getElementById('btn-start').addEventListener('click', () => startGame(false));
continueBtn.addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', () => resumeGame());
document.getElementById('btn-restart').addEventListener('click', () => {
  clearSave();
  location.reload();
});
document.getElementById('btn-end').addEventListener('click', () => game.respawn());

function applySave(data) {
  game.player.cash = data.cash;
  game.player.health = data.health ?? CONFIG.playerMaxHealth;
  game.player.ammo = data.ammo ?? CONFIG.pistolAmmo;
  game.player.pos.set(data.x, 0, data.z);
  game.player.angle = data.angle ?? 0;
}

function startGame(useSave) {
  audio.ensure();
  audio.startMusic();
  if (useSave && saved) {
    applySave(saved);
    game.missions.start(saved.missionDone ? MISSIONS_DONE : saved.missionIndex);
  } else {
    clearSave();
    game.missions.start(0);
  }
  game.screen = 'play';
  game.hud.show('play');
  input.lockPointer();
}

function resumeGame() {
  game.screen = 'play';
  game.hud.show('play');
  audio.duckMusic(false);
  input.lockPointer();
}

function pauseGame() {
  if (game.screen !== 'play') return;
  game.screen = 'pause';
  game.hud.show('pause');
  audio.duckMusic(true);
  input.unlockPointer();
  game.save();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- The player's key actions (enter car, punch, shoot, reload, pause) ----
let prevMouseDown = false;
function handleActions() {
  const st = input.state;
  const player = game.player;

  if (st.pressed('KeyP') || st.pressed('Escape')) {
    if (game.screen === 'play') pauseGame();
    else if (game.screen === 'pause') resumeGame();
  }
  if (game.screen !== 'play') return;

  if (st.pressed('KeyM')) {
    const on = audio.toggleMusic();
    game.toast(on ? 'Music on — Sunset over Solmar ♪' : 'Music off', 2);
  }

  if (st.pressed('KeyE')) {
    if (player.car) {
      // Get out: step to the side of the car — on the side that is NOT
      // inside a building. The old code always stepped to the same side,
      // which could drop Mara inside a building collider: the hotel delivery
      // leaves the car against the hotel wall, and the exit put her in the
      // concave corner between two overlapping hotel buildings, where every
      // walk step was cancelled and the foot cops beat her to death while
      // she was pinned (playtest run 11). Resolve both sides out of the
      // colliders and take the side that needed the smaller push.
      const car = player.car;
      car.speed = 0;
      playerController.setCar(null);
      const sx = Math.cos(car.angle);
      const sz = -Math.sin(car.angle);
      const a = resolveCircleCollisions(game.city, car.pos.x + sx * 2.4, car.pos.z + sz * 2.4, CONFIG.playerRadius);
      const b = resolveCircleCollisions(game.city, car.pos.x - sx * 2.4, car.pos.z - sz * 2.4, CONFIG.playerRadius);
      const da = Math.hypot(a.x - (car.pos.x + sx * 2.4), a.z - (car.pos.z + sz * 2.4));
      const db = Math.hypot(b.x - (car.pos.x - sx * 2.4), b.z - (car.pos.z - sz * 2.4));
      const pick = da <= db ? a : b;
      player.pos.set(pick.x, 0, pick.z);
      player.angle = car.angle;
    } else if (game.missions.interact(player)) {
      // A pickup step handled it.
    } else {
      // Steal the nearest car.
      let best = null;
      let bestD = 3.6;
      for (const car of game.allCars()) {
        const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      if (best) {
        const wasTraffic = traffic.cars.includes(best);
        if (wasTraffic) {
          traffic.cars.splice(traffic.cars.indexOf(best), 1);
          playerCars.push(best);
          game.peds.scare(best.pos.x, best.pos.z, 15);
        }
        playerController.setCar(best);
        player.carDamage = 0;
        const policeNear = game.police.footCops.some((c) => Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 40)
          || game.police.cars.some((u) => Math.hypot(u.car.pos.x - player.pos.x, u.car.pos.z - player.pos.z) < 40);
        if (policeNear) {
          game.police.addHeat(1);
          game.toast('Car stolen — the PD saw that!', 3);
        } else {
          game.toast('Car stolen. Drive like you own it.', 3);
        }
        audio.pickup();
      }
    }
  }

  if (st.pressed('KeyF') && !player.car && player.punchTimer <= 0) {
    player.punchTimer = 0.35;
    const hit = game.combat.punch(player);
    audio.punch();
    if (hit) {
      game.police.addHeat(1);
      game.toast(hit.kind === 'cop' ? 'You hit a cop. That was bold.' : 'You knocked them down.', 3);
    }
  }

  if (st.pressed('KeyR')) {
    player.ammo = CONFIG.pistolAmmo;
    game.toast('Reloaded.', 1.5);
  }

  // Mouse click: shoot (on foot only).
  if (st.mouseDown && !prevMouseDown && !player.car && player.shootCooldown <= 0) {
    player.shootCooldown = 0.28;
    const result = game.combat.shoot(camera, player);
    audio.shot();
    if (result.hit) {
      game.police.addHeat(result.hit.kind === 'cop' ? 2 : 1);
      game.peds.scare(player.pos.x, player.pos.z, 30);
    }
  }
  prevMouseDown = st.mouseDown;

  // Clicking the canvas while playing re-locks the pointer.
  if (st.mouseDown && !st.locked && game.screen === 'play') input.lockPointer();
}

// ---- Screenshot mode: stage a scene, then drive it with a script ----
if (shotName) {
  game.shot = stageShot(shotName, game);
  game.screen = 'play';
  game.hud.show('play');
} else {
  game.hud.show('title');
}

// ---- The loop ----
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  game.time += dt;

  if (game.screen === 'title') {
    // Slow orbit over the city behind the title screen.
    const a = game.time * 0.05;
    camera.position.set(Math.sin(a) * 220, 110, Math.cos(a) * 220);
    camera.lookAt(0, 30, 0);
    traffic.update(dt, null);
    peds.update(dt);
  }

  if (game.screen === 'play') {
    // In shot mode the script drives; in normal play the player does.
    if (game.shot) {
      input.state.keys.add('KeyW');
    }
    handleActions();
    playerController.update(dt, game);
    traffic.update(dt, game.player.car);
    peds.update(dt);
    game.police.update(dt, game.player);
    game.missions.update(dt);
    game.combat.update(dt);
    audio.engine(game.player.car ? Math.abs(game.player.car.speed) / CONFIG.carMaxSpeed : 0, !!game.player.car);
    audio.update(dt, game.police.wanted);
    playerController.updateCamera(dt, camera);
    if (game.shot) input.state.keys.delete('KeyW');
  }
  game.hud.update(dt, camera);
  renderer.render(scene, camera);
  input.endFrame();
}
requestAnimationFrame(loop);
