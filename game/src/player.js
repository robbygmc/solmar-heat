// SOLMAR HEAT — the player: Mara Voss, on foot and behind the wheel.
// One clear job: movement, driving, the camera, and the car she is in.
// The world (traffic, police, missions) reads player.pos, player.car and player.angle.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { resolveCircleCollisions } from './city.js';
import { createCarMesh, stepCar } from './vehicles.js';

function createPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x8e1f2a, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98e6a, roughness: 0.8 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.34), jacket);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skin);
  head.position.y = 1.66;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.8 }));
  cap.position.y = 1.82;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), jeans);
  legL.position.set(-0.15, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), jeans);
  legR.position.set(0.15, 0.36, 0);
  group.add(legR);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), jacket);
  armR.position.set(0.42, 1.05, 0.1);
  group.add(armR);
  return { group, legL, legR, armR };
}

export function createPlayer(scene, city, input, start) {
  const { group, legL, legR, armR } = createPlayerMesh();
  scene.add(group);

  // Exhaust / tyre smoke: a tiny pool of fading grey puffs.
  const puffs = [];
  const puffGeo = new THREE.SphereGeometry(0.35, 6, 5);
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xbbbbbb, transparent: true, opacity: 0.2 });
  function puff(x, y, z, big) {
    let p = puffs.find((q) => q.userData.life <= 0);
    if (!p) {
      if (puffs.length > 40) return;
      p = new THREE.Mesh(puffGeo, puffMat.clone());
      scene.add(p);
      puffs.push(p);
    }
    p.position.set(x, y, z);
    p.scale.setScalar(big ? 1.1 : 0.55);
    p.userData.life = 0.6;
    p.visible = true;
  }

  const player = {
    group,
    pos: new THREE.Vector3(start.x, 0, start.z),
    angle: start.angle,
    vy: 0,
    onGround: true,
    car: null, // the car object being driven, or null
    carDamage: 0,
    speed: 0, // on-foot speed, or the driven car's speed
    health: CONFIG.playerMaxHealth,
    cash: 150,
    ammo: CONFIG.pistolAmmo,
    wanted: 0,
    camYaw: start.angle + Math.PI, // the camera starts behind the player
    camPitch: 0.32,
    walkSwing: 0,
    punchTimer: 0,
    shootCooldown: 0,
    invulnerable: 0,
  };

  return {
    player,
    // The car Mara is driving, or null.
    get car() {
      return player.car;
    },
    setCar(car) {
      player.car = car;
      if (car) {
        group.visible = false;
        player.pos.copy(car.pos);
      } else {
        group.visible = true;
      }
    },
    hurt(amount) {
      if (player.invulnerable > 0 || player.health <= 0) return;
      player.health = Math.max(0, player.health - amount);
      player.invulnerable = 0.6;
    },
    heal(amount) {
      player.health = Math.min(CONFIG.playerMaxHealth, player.health + amount);
    },
    update(dt, game) {
      const inputState = input.state;
      player.invulnerable = Math.max(0, player.invulnerable - dt);
      player.shootCooldown = Math.max(0, player.shootCooldown - dt);
      player.punchTimer = Math.max(0, player.punchTimer - dt);

      // Mouse look.
      player.camYaw -= inputState.mouseDX * 0.0032;
      player.camPitch = Math.max(-0.2, Math.min(1.1, player.camPitch + inputState.mouseDY * 0.0028));

      if (player.car) {
        this.updateDriving(dt, game);
      } else {
        this.updateOnFoot(dt, game);
      }
      // Smoke puffs age.
      for (const p of puffs) {
        if (p.userData.life <= 0) continue;
        p.userData.life -= dt;
        p.position.y += dt * 1.2;
        p.scale.multiplyScalar(1 + dt * 1.6);
        p.material.opacity = Math.max(0, 0.2 * (p.userData.life / 0.6));
        if (p.userData.life <= 0) p.visible = false;
      }
    },
    updateOnFoot(dt, game) {
      const st = input.state;
      const run = st.any('ShiftLeft', 'ShiftRight');
      const speed = run ? CONFIG.runSpeed : CONFIG.walkSpeed;
      // Move relative to the camera yaw.
      let mx = 0;
      let mz = 0;
      if (st.any('KeyW', 'ArrowUp')) { mx -= Math.sin(player.camYaw); mz -= Math.cos(player.camYaw); }
      if (st.any('KeyS', 'ArrowDown')) { mx += Math.sin(player.camYaw); mz += Math.cos(player.camYaw); }
      if (st.any('KeyA', 'ArrowLeft')) { mx -= Math.cos(player.camYaw); mz += Math.sin(player.camYaw); }
      if (st.any('KeyD', 'ArrowRight')) { mx += Math.cos(player.camYaw); mz -= Math.sin(player.camYaw); }
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        mx /= len;
        mz /= len;
        player.angle = Math.atan2(mx, mz);
        const nx = player.pos.x + mx * speed * dt;
        const nz = player.pos.z + mz * speed * dt;
        const resolved = resolveCircleCollisions(game.city, nx, nz, CONFIG.playerRadius);
        player.pos.x = resolved.x;
        player.pos.z = resolved.z;
        player.speed = speed;
        player.walkSwing += dt * speed * 1.6;
      } else {
        player.speed = 0;
        player.walkSwing *= 0.9;
      }
      // Push out of cars standing around.
      for (const car of game.allCars()) {
        const dx = player.pos.x - car.pos.x;
        const dz = player.pos.z - car.pos.z;
        const d = Math.hypot(dx, dz);
        const min = CONFIG.carRadius + 0.5;
        if (d < min && d > 0.01) {
          player.pos.x = car.pos.x + (dx / d) * min;
          player.pos.z = car.pos.z + (dz / d) * min;
        }
      }
      // Jump and gravity.
      if (st.pressed('Space') && player.onGround) {
        player.vy = CONFIG.jumpSpeed;
        player.onGround = false;
      }
      if (!player.onGround) {
        player.vy -= CONFIG.gravity * dt;
        player.pos.y += player.vy * dt;
        if (player.pos.y <= 0) {
          player.pos.y = 0;
          player.vy = 0;
          player.onGround = true;
        }
      }
      group.position.copy(player.pos);
      group.rotation.y = player.angle;
      legL.rotation.x = Math.sin(player.walkSwing) * 0.7;
      legR.rotation.x = -Math.sin(player.walkSwing) * 0.7;
      armR.rotation.x = player.punchTimer > 0 ? -1.6 : Math.sin(player.walkSwing) * 0.5;
    },
    updateDriving(dt, game) {
      const st = input.state;
      const car = player.car;
      const forward = st.any('KeyW', 'ArrowUp');
      const back = st.any('KeyS', 'ArrowDown');
      const handbrake = st.any('Space');
      if (forward) car.speed += CONFIG.carAccel * dt;
      if (back) {
        if (car.speed > 0.5) car.speed -= CONFIG.carBrake * dt;
        else car.speed -= CONFIG.carReverse * dt;
      }
      if (!forward && !back) {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
      }
      if (handbrake) {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
      }
      const maxF = CONFIG.carMaxSpeed * (1 - player.carDamage * 0.005);
      car.speed = Math.max(-CONFIG.carMaxReverse, Math.min(maxF, car.speed));
      // Steering: stronger at speed, reversed when reversing, looser with handbrake.
      const steerInput = (st.any('KeyA', 'ArrowLeft') ? 1 : 0) - (st.any('KeyD', 'ArrowRight') ? 1 : 0);
      const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
      const turn = CONFIG.carTurn * speedFactor * (handbrake ? 1.7 : 1) * (car.speed >= 0 ? 1 : -1);
      car.angle += steerInput * turn * dt;
      const hit = stepCar(game.city, car, dt);
      if (hit && Math.abs(car.speed) > 6) {
        player.carDamage = Math.min(100, player.carDamage + 4);
        car.speed *= 0.45;
        puff(car.pos.x, 1, car.pos.z, true);
        game.audio?.crash();
      }
      // Car-car bumps.
      for (const other of game.allCars()) {
        if (other === car) continue;
        const dx = car.pos.x - other.pos.x;
        const dz = car.pos.z - other.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 4.4 && d > 0.01) {
          const push = (4.4 - d) / 2;
          car.pos.x += (dx / d) * push;
          car.pos.z += (dz / d) * push;
          other.pos.x -= (dx / d) * push;
          other.pos.z -= (dz / d) * push;
          car.speed *= 0.7;
          if (other.speed !== undefined) other.speed *= 0.7;
          player.carDamage = Math.min(100, player.carDamage + 2);
        }
      }
      player.pos.copy(car.pos);
      player.speed = car.speed;
      // Exhaust puffs when accelerating, tyre smoke on handbrake.
      if ((forward && Math.abs(car.speed) > 4 && Math.random() < 0.12) || handbrake) {
        const bx = car.pos.x - Math.sin(car.angle) * 2;
        const bz = car.pos.z - Math.cos(car.angle) * 2;
        puff(bx, 0.4, bz, handbrake);
      }
      // Smoke when badly damaged.
      if (player.carDamage > 55 && Math.random() < 0.3) {
        puff(car.pos.x, 1.2, car.pos.z, true);
      }
    },
    // Third-person camera: orbit on foot, chase cam while driving.
    updateCamera(dt, camera) {
      const target = new THREE.Vector3();
      if (player.car) {
        const car = player.car;
        const fx = Math.sin(car.angle);
        const fz = Math.cos(car.angle);
        target.set(car.pos.x + fx * 6, 1.5, car.pos.z + fz * 6);
        const want = new THREE.Vector3(
          car.pos.x - fx * CONFIG.driveCamDistance,
          CONFIG.driveCamHeight,
          car.pos.z - fz * CONFIG.driveCamDistance,
        );
        camera.position.lerp(want, Math.min(1, dt * 4));
        camera.lookAt(target);
      } else {
        target.set(player.pos.x, 1.6, player.pos.z);
        const cx = player.pos.x + Math.sin(player.camYaw) * CONFIG.camDistance * Math.cos(player.camPitch);
        const cz = player.pos.z + Math.cos(player.camYaw) * CONFIG.camDistance * Math.cos(player.camPitch);
        const cy = player.pos.y + 1.6 + Math.sin(player.camPitch) * CONFIG.camDistance + 1.0;
        camera.position.set(cx, cy, cz);
        camera.lookAt(target);
      }
    },
  };
}

// A parked car Mara can steal: not traffic, just sitting at a curb spot.
export function createParkedCar(scene, spot, rng) {
  const color = rng.pick([0xc23b2e, 0x2e6fc2, 0xe8b93b, 0x3aa655, 0xd8d8d8, 0x7a4fc2]);
  const { group, wheels, length } = createCarMesh(color, rng.pick(['sedan', 'coupe']));
  group.position.set(spot.x, 0, spot.z);
  group.rotation.y = spot.angle;
  scene.add(group);
  return {
    group,
    wheels,
    length,
    type: 'parked',
    pos: new THREE.Vector3(spot.x, 0, spot.z),
    angle: spot.angle,
    speed: 0,
  };
}
