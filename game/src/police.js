// SOLMAR HEAT — the wanted level and the Solmar PD.
// One clear job: heat, pursuit, busts. Crimes raise the stars; the stars decide
// how many foot cops and cruisers hunt Mara; hiding and time cool it down.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createPoliceCar } from './vehicles.js';

function createCopMesh() {
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1c2f4a, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98e6a, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.34), navy);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skin);
  head.position.y = 1.66;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.7 }));
  cap.position.y = 1.84;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), navy);
  legL.position.set(-0.15, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), navy);
  legR.position.set(0.15, 0.36, 0);
  group.add(legR);
  return { group, legL, legR };
}

export function createPolice(scene, city, rng, game) {
  const footCops = [];
  const cars = [];
  let wanted = 0;
  let lastCrimeAt = -999;
  let bustTimer = 0;
  let punchTimer = 0;

  function spawnFootCop(near) {
    const { group, legL, legR } = createCopMesh();
    scene.add(group);
    // Spawn on a road, 25–45 units from the player.
    let x = near.x;
    let z = near.z;
    for (let tries = 0; tries < 12; tries += 1) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(25, 45);
      x = near.x + Math.sin(a) * d;
      z = near.z + Math.cos(a) * d;
      if (Math.abs(x) < CONFIG.cityHalf - 10 && Math.abs(z) < CONFIG.cityHalf - 10) break;
    }
    const cop = {
      group,
      legL,
      legR,
      pos: new THREE.Vector3(x, 0, z),
      angle: 0,
      speed: CONFIG.copFootSpeed,
      swing: 0,
      health: 100,
      state: 'chase',
    };
    footCops.push(cop);
    return cop;
  }

  function spawnPoliceCar(near) {
    const unit = createPoliceCar(scene);
    const a = rng.range(0, Math.PI * 2);
    unit.car.pos.set(
      Math.max(-300, Math.min(300, near.x + Math.sin(a) * 40)),
      0,
      Math.max(-300, Math.min(300, near.z + Math.cos(a) * 40)),
    );
    unit.car.angle = a;
    unit.car.group.position.copy(unit.car.pos);
    unit.car.group.rotation.y = unit.car.angle;
    cars.push(unit);
    return unit;
  }

  // Place one cruiser at an exact spot, facing an exact heading — used by
  // staged shots so the PD is visibly in frame instead of spawning at a
  // random angle behind the camera.
  function placeCruiser(x, z, angle) {
    const unit = createPoliceCar(scene);
    unit.car.pos.set(x, 0, z);
    unit.car.angle = angle;
    unit.car.speed = 20;
    // Sync the mesh at spawn, like createParkedCar does: the update loop
    // would do it on the next frame, but the placed car must read correctly
    // from the first render.
    unit.car.group.position.copy(unit.car.pos);
    unit.car.group.rotation.y = unit.car.angle;
    cars.push(unit);
    return unit;
  }

  function removeFootCop(cop) {
    scene.remove(cop.group);
    const i = footCops.indexOf(cop);
    if (i >= 0) footCops.splice(i, 1);
  }

  function removePoliceCar(unit) {
    unit.remove();
    const i = cars.indexOf(unit);
    if (i >= 0) cars.splice(i, 1);
  }

  return {
    footCops,
    cars,
    placeCruiser,
    get wanted() {
      return wanted;
    },
    addHeat(amount) {
      wanted = Math.min(CONFIG.wantedMax, wanted + amount);
      lastCrimeAt = game.time;
      if (wanted > 0) game.audio?.siren();
    },
    setWanted(level) {
      wanted = Math.max(0, Math.min(CONFIG.wantedMax, level));
      lastCrimeAt = game.time;
    },
    knockDownCop(cop) {
      cop.state = 'down';
      cop.health = 0;
      // Shooting a cop is a serious crime.
      this.addHeat(2);
      setTimeout(() => removeFootCop(cop), 4000);
    },
    nearestFootCop(x, z, maxDist) {
      let best = null;
      let bestD = maxDist;
      for (const cop of footCops) {
        if (cop.state === 'down') continue;
        const d = Math.hypot(cop.pos.x - x, cop.pos.z - z);
        if (d < bestD) {
          bestD = d;
          best = cop;
        }
      }
      return best;
    },
    reset() {
      for (const cop of [...footCops]) removeFootCop(cop);
      for (const unit of [...cars]) removePoliceCar(unit);
      wanted = 0;
      bustTimer = 0;
    },
    update(dt, player) {
      if (wanted <= 0) {
        // Stragglers leave.
        for (const cop of [...footCops]) removeFootCop(cop);
        for (const unit of [...cars]) removePoliceCar(unit);
        return;
      }
      const target = player.pos;
      // Numbers scale with the stars.
      const wantCops = Math.min(2, wanted);
      const wantCars = wanted >= 2 ? Math.min(3, wanted - 1) : 0;
      while (footCops.length < wantCops) spawnFootCop(target);
      while (cars.length < wantCars) spawnPoliceCar(target);
      while (footCops.length > wantCops) removeFootCop(footCops[0]);
      while (cars.length > wantCars) removePoliceCar(cars[0]);

      // Foot cops run at Mara.
      punchTimer -= dt;
      let anyClose = false;
      for (const cop of footCops) {
        if (cop.state === 'down') continue;
        const dx = target.x - cop.pos.x;
        const dz = target.z - cop.pos.z;
        const dist = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let diff = want - cop.angle;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        cop.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
        if (dist > CONFIG.bustDistance) {
          cop.pos.x += Math.sin(cop.angle) * cop.speed * dt;
          cop.pos.z += Math.cos(cop.angle) * cop.speed * dt;
          cop.swing += dt * 9;
        } else {
          anyClose = true;
          // A cop on top of Mara on foot punches her; near a car, they yank at the door.
          if (punchTimer <= 0 && !player.car) {
            punchTimer = 0.9;
            game.playerHurt(9);
          }
        }
        cop.group.position.set(cop.pos.x, 0, cop.pos.z);
        cop.group.rotation.y = cop.angle;
        cop.legL.rotation.x = Math.sin(cop.swing) * 0.7;
        cop.legR.rotation.x = -Math.sin(cop.swing) * 0.7;
      }

      // Busted: a cop stands on Mara while she is on foot and not moving fast.
      if (anyClose && !player.car && Math.abs(player.speed) < 2) {
        bustTimer += dt;
        if (bustTimer > CONFIG.bustSeconds) {
          bustTimer = 0;
          game.onBusted();
        }
      } else {
        bustTimer = 0;
      }

      // Cruisers chase and ram.
      for (const unit of cars) {
        const dist = unit.update(dt, target, city);
        // Ramming the player's car hurts it — once per cruiser per half
        // second. Per-frame damage (no cooldown) shredded a fresh car in
        // ~2s of contact and pinned it (speed x0.92 every frame), which made
        // mission 3 unwinnable once cruisers caught up: a 100-damage car
        // tops out at 19 u/s against 34 u/s cruisers, so the wanted level
        // could never cool down. A ram is a hit, not a shredder — the foot
        // cops already punch on a 0.9s cooldown for the same reason.
        unit.ramTimer = (unit.ramTimer ?? 0) - dt;
        if (player.car && dist < 4.5 && unit.ramTimer <= 0) {
          unit.ramTimer = 0.5;
          // A light speed cost, not a pin: x0.92 per hit kept the car
          // below the cruisers' pace while they were glued on (run 13),
          // so it could never break away. With the car's 26 u/s^2
          // acceleration it now recovers between hits and pulls clear.
          player.car.speed *= 0.96;
          game.playerCarDamage(1);
        }
        // A cruiser that catches Mara on foot drops a cop.
        if (!player.car && dist < 6 && footCops.length < wantCops + 1 && rng.chance(dt * 0.3)) {
          spawnFootCop(unit.car.pos);
        }
      }

      // Cool down: no crime for a while and no police close by.
      const nearestPolice = Math.min(
        ...footCops.map((c) => Math.hypot(c.pos.x - target.x, c.pos.z - target.z)),
        ...cars.map((u) => Math.hypot(u.car.pos.x - target.x, u.car.pos.z - target.z)),
        999,
      );
      if (game.time - lastCrimeAt > CONFIG.wantedDecaySeconds && nearestPolice > 45) {
        wanted -= 1;
        lastCrimeAt = game.time;
        if (wanted <= 0) {
          wanted = 0;
          game.toast('You lost them. The heat is off — for now.');
        } else {
          game.toast(`Heat down: ${wanted} star${wanted === 1 ? '' : 's'} left.`);
        }
      }
    },
  };
}
