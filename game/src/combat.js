// SOLMAR HEAT — combat: the pistol, the punch, and the sparks they make.
// One clear job: shooting and hitting things. Damage to the player is the
// police system's job; this file only deals damage the player deals.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createCombat(scene, game) {
  const tracers = [];
  const sparks = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffc36b });
  const flash = new THREE.PointLight(0xffd98a, 0, 18);
  scene.add(flash);

  function addTracer(from, to) {
    const len = from.distanceTo(to);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), tracerMat);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.lookAt(to);
    mesh.userData.life = 0.07;
    scene.add(mesh);
    tracers.push(mesh);
  }

  function addSparks(point, count) {
    for (let i = 0; i < count; i += 1) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), sparkMat);
      s.position.copy(point);
      s.userData = {
        life: 0.4,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 6,
        vz: (Math.random() - 0.5) * 8,
      };
      scene.add(s);
      sparks.push(s);
    }
  }

  // Fire the pistol from the camera toward the screen centre. Returns what was hit.
  function shoot(camera, player) {
    if (player.ammo <= 0) return { hit: null, dry: true };
    player.ammo -= 1;
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const muzzle = origin.clone().add(dir.clone().multiplyScalar(1.2));
    muzzle.y -= 0.25;
    flash.position.copy(muzzle);
    flash.intensity = 60;
    const end = origin.clone().add(dir.clone().multiplyScalar(CONFIG.pistolRange));

    // Nearest thing the ray hits: a pedestrian, a foot cop, or a car.
    let best = null;
    let bestT = CONFIG.pistolRange;
    const test = (point, radius, ref) => {
      const to = new THREE.Vector3(point.x - origin.x, point.y - origin.y, point.z - origin.z);
      const t = to.dot(dir);
      if (t < 0 || t > bestT) return;
      const closest = origin.clone().add(dir.clone().multiplyScalar(t));
      const d = Math.hypot(closest.x - point.x, closest.y - point.y, closest.z - point.z);
      if (d < radius) {
        bestT = t;
        best = { ...ref, point: closest.clone(), dist: t };
      }
    };
    for (const ped of game.peds.peds) {
      if (ped.state !== 'down') test(new THREE.Vector3(ped.pos.x, 1.1, ped.pos.z), 0.9, { kind: 'ped', ped });
    }
    for (const cop of game.police.footCops) {
      test(new THREE.Vector3(cop.pos.x, 1.1, cop.pos.z), 0.9, { kind: 'cop', cop });
    }
    for (const car of game.traffic.cars) {
      test(new THREE.Vector3(car.pos.x, 0.9, car.pos.z), 2.4, { kind: 'car', car });
    }
    // Parked cars too — a shot at one should spark, not pass through it.
    for (const car of game.playerCars) {
      test(new THREE.Vector3(car.pos.x, 0.9, car.pos.z), 2.4, { kind: 'car', car });
    }
    for (const pc of game.police.cars) {
      test(new THREE.Vector3(pc.car.pos.x, 0.9, pc.car.pos.z), 2.4, { kind: 'policeCar', car: pc.car });
    }

    const hitPoint = best ? best.point : end;
    addTracer(muzzle, hitPoint);
    if (best) {
      addSparks(hitPoint, 6);
      if (best.kind === 'ped') {
        game.peds.knockDown(best.ped);
        game.peds.scare(best.ped.pos.x, best.ped.pos.z, 30);
      } else if (best.kind === 'cop') {
        game.police.knockDownCop(best.cop);
        game.peds.scare(best.cop.pos.x, best.cop.pos.z, 30);
      }
    } else {
      // The shot still scares the street.
      game.peds.scare(player.pos.x, player.pos.z, 25);
    }
    return { hit: best, dry: false };
  }

  // A punch: whatever is right in front of the player, within arm's reach.
  function punch(player) {
    const fx = Math.sin(player.angle);
    const fz = Math.cos(player.angle);
    const px = player.pos.x + fx * 1.4;
    const pz = player.pos.z + fz * 1.4;
    const ped = game.peds.nearest(px, pz, CONFIG.punchRange);
    if (ped) {
      game.peds.knockDown(ped);
      game.peds.scare(ped.pos.x, ped.pos.z, 20);
      return { kind: 'ped', ped };
    }
    const cop = game.police.nearestFootCop(px, pz, CONFIG.punchRange);
    if (cop) {
      game.police.knockDownCop(cop);
      return { kind: 'cop', cop };
    }
    return null;
  }

  return {
    shoot,
    punch,
    update(dt) {
      flash.intensity = Math.max(0, flash.intensity - dt * 900);
      for (let i = tracers.length - 1; i >= 0; i -= 1) {
        const t = tracers[i];
        t.userData.life -= dt;
        if (t.userData.life <= 0) {
          scene.remove(t);
          tracers.splice(i, 1);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const s = sparks[i];
        s.userData.life -= dt;
        s.position.x += s.userData.vx * dt;
        s.position.y += s.userData.vy * dt;
        s.position.z += s.userData.vz * dt;
        s.userData.vy -= 12 * dt;
        if (s.userData.life <= 0 || s.position.y < 0) {
          scene.remove(s);
          sparks.splice(i, 1);
        }
      }
    },
  };
}
