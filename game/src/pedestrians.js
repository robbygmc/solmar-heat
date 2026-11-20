// SOLMAR HEAT — pedestrians.
// One clear job: the people on the sidewalks. They stroll between corners, cross
// at crosswalks, and run when shots are fired or a car comes at them.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { isOnRoad, resolveCircleCollisions } from './city.js';

const skinTones = [0xc98e6a, 0x8a5a3a, 0xe8b88a, 0x6a4a30];
const shirts = [0xc23b2e, 0x2e6fc2, 0xe8b93b, 0x3aa655, 0x7a4fc2, 0xe07a2e, 0xd8d8d8, 0x2e8a8a];

function createPedMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: rng.pick(shirts), roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: rng.pick(skinTones), roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: rng.pick([0x222831, 0x3a3a4a, 0x5a4a3a]), roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pants);
  legL.position.set(-0.14, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pants);
  legR.position.set(0.14, 0.35, 0);
  group.add(legR);
  return { group, legL, legR };
}

export function createPedestrians(scene, city, rng) {
  const peds = [];
  const spawn = () => {
    // Start on a sidewalk: just off a road, on a block edge.
    for (let tries = 0; tries < 20; tries += 1) {
      const x = rng.range(-CONFIG.cityHalf + 20, CONFIG.cityHalf - 20);
      const z = rng.range(-CONFIG.cityHalf + 20, CONFIG.cityHalf - 20);
      if (!isOnRoad(city, x, z)) return { x, z };
    }
    return { x: 0, z: 0 };
  };
  for (let i = 0; i < CONFIG.pedCount; i += 1) {
    const { group, legL, legR } = createPedMesh(rng);
    scene.add(group);
    const p = spawn();
    const ped = {
      group,
      legL,
      legR,
      pos: new THREE.Vector3(p.x, 0, p.z),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, CONFIG.pedSpeed),
      state: 'walk',
      target: null,
      scareTimer: 0,
      downTimer: 0,
      swing: rng.range(0, 6),
      health: 100,
    };
    ped.target = pickWalkTarget(city, rng, ped.pos);
    peds.push(ped);
  }

  function pickWalkTarget(city, rng, from) {
    // A nearby corner: the edge of the block the pedestrian is on.
    for (let tries = 0; tries < 12; tries += 1) {
      const x = from.x + rng.range(-50, 50);
      const z = from.z + rng.range(-50, 50);
      if (Math.abs(x) < CONFIG.cityHalf - 10 && Math.abs(z) < CONFIG.cityHalf - 10 && !isOnRoad(city, x, z)) {
        return { x, z };
      }
    }
    return { x: from.x, z: from.z };
  }

  return {
    peds,
    // Scare everyone near a point (gunshot, crash): they run away from it.
    scare(x, z, radius) {
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
        if (d < radius) {
          ped.state = 'flee';
          ped.scareTimer = 3;
          const away = Math.atan2(ped.pos.x - x, ped.pos.z - z);
          ped.target = {
            x: ped.pos.x + Math.sin(away) * 40,
            z: ped.pos.z + Math.cos(away) * 40,
          };
        }
      }
    },
    nearest(x, z, maxDist) {
      let best = null;
      let bestD = maxDist;
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
        if (d < bestD) {
          bestD = d;
          best = ped;
        }
      }
      return best;
    },
    update(dt) {
      for (const ped of peds) {
        if (ped.state === 'down') {
          // Fallen: lying on the ground, fading out after a while — sink
          // below the street after 6s, removed entirely after 8s (see the
          // sweep at the end of update).
          ped.downTimer += dt;
          ped.group.rotation.x = Math.max(-Math.PI / 2, ped.group.rotation.x - dt * 4);
          ped.group.position.y = ped.downTimer > 6
            ? Math.max(-1.2, ped.group.position.y - dt * 0.8)
            : Math.max(0.25, ped.group.position.y - dt);
          continue;
        }
        if (ped.scareTimer > 0) {
          ped.scareTimer -= dt;
          if (ped.scareTimer <= 0) {
            ped.state = 'walk';
            ped.target = pickWalkTarget(city, rng, ped.pos);
          }
        }
        const dx = ped.target.x - ped.pos.x;
        const dz = ped.target.z - ped.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.5) {
          ped.target = ped.state === 'flee' ? ped.target : pickWalkTarget(city, rng, ped.pos);
          if (ped.state === 'flee') ped.state = 'walk';
          continue;
        }
        const want = Math.atan2(dx, dz);
        let diff = want - ped.angle;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
        const speed = ped.state === 'flee' ? 5.2 : ped.speed;
        const nx = ped.pos.x + Math.sin(ped.angle) * speed * dt;
        const nz = ped.pos.z + Math.cos(ped.angle) * speed * dt;
        const resolved = resolveCircleCollisions(city, nx, nz, 0.5);
        ped.pos.x = resolved.x;
        ped.pos.z = resolved.z;
        ped.group.position.set(ped.pos.x, 0, ped.pos.z);
        ped.group.rotation.y = ped.angle;
        ped.swing += dt * speed * 2.4;
        ped.legL.rotation.x = Math.sin(ped.swing) * 0.6;
        ped.legR.rotation.x = -Math.sin(ped.swing) * 0.6;
      }
      // Sweep out peds that finished fading — splicing here, after the loop,
      // so the iteration above is never disturbed.
      for (let i = peds.length - 1; i >= 0; i -= 1) {
        if (peds[i].state === 'down' && peds[i].downTimer > 8) {
          scene.remove(peds[i].group);
          peds.splice(i, 1);
        }
      }
    },
    // Knock a pedestrian down (combat). Returns true when they went down.
    knockDown(ped) {
      if (ped.state === 'down') return false;
      ped.state = 'down';
      ped.health = 0;
      return true;
    },
  };
}
