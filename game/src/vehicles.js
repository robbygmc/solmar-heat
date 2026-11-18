// SOLMAR HEAT — cars: the factory, the traffic, and the police chase.
// One clear job: everything with four wheels. The player drives one of these
// too (see player.js), so the shape and the collision helper are shared.
import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { resolveCircleCollisions } from './city.js';

const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c2c40, roughness: 0.25, metalness: 0.6 });
const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.2 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0xc02020, emissive: 0x881111, emissiveIntensity: 0.8 });

// Build a car from boxes. `type` picks the silhouette: sedan, coupe, taxi, police, van.
export function createCarMesh(color, type = 'sedan') {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const long = type === 'van' ? 5.4 : type === 'coupe' ? 4.2 : 4.6;
  const wide = 2.0;
  const bodyH = type === 'van' ? 1.5 : 0.75;

  const body = new THREE.Mesh(bodyGeo, paint);
  body.scale.set(wide, bodyH, long);
  body.position.y = 0.55 + bodyH / 2 - 0.35;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(bodyGeo, type === 'van' ? paint : glassMat);
  cabin.scale.set(wide * 0.85, type === 'van' ? 0.9 : 0.6, long * 0.45);
  cabin.position.set(0, 0.55 + bodyH + (type === 'van' ? 0.4 : 0.25), type === 'van' ? 0.3 : -long * 0.05);
  cabin.castShadow = true;
  group.add(cabin);

  // Wheels.
  const wheels = [];
  const wy = 0.42;
  const wx = wide / 2 - 0.1;
  const wz = long / 2 - 0.9;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, wy, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  // Headlights and taillights (front is +z in local space).
  for (const x of [-wide / 2 + 0.3, wide / 2 - 0.3]) {
    const head = new THREE.Mesh(bodyGeo, lightMat);
    head.scale.set(0.5, 0.22, 0.1);
    head.position.set(x, 0.75, long / 2 + 0.01);
    group.add(head);
    const tail = new THREE.Mesh(bodyGeo, tailMat);
    tail.scale.set(0.5, 0.22, 0.1);
    tail.position.set(x, 0.75, -long / 2 - 0.01);
    group.add(tail);
  }

  if (type === 'taxi') {
    const sign = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0xaa8820, emissiveIntensity: 0.6 }));
    sign.scale.set(0.9, 0.25, 0.5);
    sign.position.set(0, 0.55 + bodyH + 0.65, -long * 0.05);
    group.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4 }));
    bar.scale.set(1.2, 0.18, 0.4);
    bar.position.set(0, 0.55 + bodyH + 0.62, -long * 0.05);
    group.add(bar);
    const red = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 }));
    red.scale.set(0.5, 0.2, 0.42);
    red.position.set(-0.32, 0.55 + bodyH + 0.72, -long * 0.05);
    group.add(red);
    const blue = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2 }));
    blue.scale.set(0.5, 0.2, 0.42);
    blue.position.set(0.32, 0.55 + bodyH + 0.72, -long * 0.05);
    group.add(blue);
    group.userData.strobe = { red, blue, phase: 0 };
  }

  group.userData.length = long;
  group.userData.width = wide;
  group.userData.paint = paint;
  return { group, wheels, length: long, width: wide };
}

// Move a car (heading + speed) one step, sliding along buildings. Returns true
// when the step hit a building hard enough to matter (damage, sparks).
export function stepCar(city, car, dt) {
  const fx = Math.sin(car.angle);
  const fz = Math.cos(car.angle);
  const nx = car.pos.x + fx * car.speed * dt;
  const nz = car.pos.z + fz * car.speed * dt;
  const resolved = resolveCircleCollisions(city, nx, nz, CONFIG.carRadius);
  const hit = Math.abs(resolved.x - nx) + Math.abs(resolved.z - nz) > 0.05;
  car.pos.x = resolved.x;
  car.pos.z = resolved.z;
  car.group.position.set(car.pos.x, 0, car.pos.z);
  car.group.rotation.y = car.angle;
  for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.42;
  return hit;
}

// Traffic: cars that drive the road grid forever, stopping for the car ahead.
export function createTraffic(scene, city, rng) {
  const cars = [];
  const allX = city.roadXs;
  const allZ = city.roadZs;
  for (let i = 0; i < CONFIG.trafficCount; i += 1) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(allX) : rng.pick(allZ);
    const dir = rng.chance(0.5) ? 1 : -1;
    const type = rng.chance(0.12) ? 'taxi' : rng.pick(['sedan', 'sedan', 'coupe']);
    const color = type === 'taxi' ? PALETTE.taxi : rng.pick(PALETTE.car);
    const { group, wheels, length } = createCarMesh(color, type);
    scene.add(group);
    const car = {
      group,
      wheels,
      length,
      type,
      vertical,
      road,
      dir,
      speed: rng.range(6, CONFIG.trafficSpeed),
      pos: new THREE.Vector3(0, 0, 0),
      angle: 0,
      stopped: false,
    };
    if (vertical) {
      car.pos.set(road + (dir > 0 ? -2.2 : 2.2), 0, rng.range(-300, 300));
      car.angle = dir > 0 ? 0 : Math.PI;
    } else {
      car.pos.set(rng.range(-300, 300), 0, road + (dir > 0 ? 2.2 : -2.2));
      car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    cars.push(car);
  }

  function carAhead(car) {
    // Another car in the same lane, close ahead of this one.
    const fx = Math.sin(car.angle);
    const fz = Math.cos(car.angle);
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 9 && side < 2.6) return true;
    }
    return false;
  }

  return {
    cars,
    update(dt, playerCar) {
      for (const car of cars) {
        // Maybe turn at an intersection.
        const onCross = car.vertical
          ? allZ.some((z) => Math.abs(car.pos.z - z) < 1.2)
          : allX.some((x) => Math.abs(car.pos.x - x) < 1.2);
        if (onCross && rng.chance(dt * 0.25)) {
          // Turn onto the crossing road.
          if (car.vertical) {
            const z = allZ.reduce((a, b) => (Math.abs(car.pos.z - a) < Math.abs(car.pos.z - b) ? a : b));
            car.vertical = false;
            car.road = z;
            car.dir = rng.chance(0.5) ? 1 : -1;
            car.pos.z = z + (car.dir > 0 ? 2.2 : -2.2);
            car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            const x = allX.reduce((a, b) => (Math.abs(car.pos.x - a) < Math.abs(car.pos.x - b) ? a : b));
            car.vertical = true;
            car.road = x;
            car.dir = rng.chance(0.5) ? 1 : -1;
            car.pos.x = x + (car.dir > 0 ? -2.2 : 2.2);
            car.angle = car.dir > 0 ? 0 : Math.PI;
          }
        }
        // Stop for traffic ahead, and for the player's car in the way.
        let blocked = carAhead(car);
        if (playerCar) {
          const dx = playerCar.pos.x - car.pos.x;
          const dz = playerCar.pos.z - car.pos.z;
          const fx = Math.sin(car.angle);
          const fz = Math.cos(car.angle);
          const along = dx * fx + dz * fz;
          const side = Math.abs(dx * fz - dz * fx);
          if (along > 0 && along < 9 && side < 2.6) blocked = true;
        }
        car.stopped = blocked;
        const target = blocked ? 0 : rng.range(6, CONFIG.trafficSpeed);
        car.speed += (target - car.speed) * Math.min(1, dt * 2);
        const fx = Math.sin(car.angle);
        const fz = Math.cos(car.angle);
        const nx = car.pos.x + fx * car.speed * dt;
        const nz = car.pos.z + fz * car.speed * dt;
        const resolved = resolveCircleCollisions(city, nx, nz, CONFIG.carRadius);
        car.pos.x = resolved.x;
        car.pos.z = resolved.z;
        // Reached the edge: turn around onto a new road.
        const bound = CONFIG.cityHalf - 8;
        if (Math.abs(car.pos.x) > bound || Math.abs(car.pos.z) > bound) {
          car.dir *= -1;
          car.angle += Math.PI;
          car.pos.x = Math.max(-bound, Math.min(bound, car.pos.x));
          car.pos.z = Math.max(-bound, Math.min(bound, car.pos.z));
        }
        car.group.position.set(car.pos.x, 0, car.pos.z);
        car.group.rotation.y = car.angle;
        for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.42;
      }
    },
    // A parked car near a point (for stealing), or null.
    nearestParked(x, z, maxDist) {
      let best = null;
      let bestD = maxDist;
      for (const car of cars) {
        const d = Math.hypot(car.pos.x - x, car.pos.z - z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      return best;
    },
  };
}

// A police car: chases a target position, rams it, strobes its light bar.
export function createPoliceCar(scene) {
  const { group, wheels, length } = createCarMesh(PALETTE.police, 'police');
  scene.add(group);
  const car = {
    group,
    wheels,
    length,
    type: 'police',
    pos: new THREE.Vector3(0, 0, 0),
    angle: 0,
    speed: 0,
    sirenPhase: 0,
  };
  return {
    car,
    remove() {
      scene.remove(group);
    },
    update(dt, target, city) {
      const dx = target.x - car.pos.x;
      const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 2.2));
      const targetSpeed = dist > 4 ? CONFIG.copCarSpeed : 6;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      const hit = stepCar(city, car, dt);
      if (hit) car.speed *= 0.5;
      // Strobe the light bar.
      car.sirenPhase += dt * 10;
      const strobe = group.userData.strobe;
      if (strobe) {
        const on = Math.sin(car.sirenPhase) > 0;
        strobe.red.material.emissiveIntensity = on ? 3 : 0.2;
        strobe.blue.material.emissiveIntensity = on ? 0.2 : 3;
      }
      return dist;
    },
  };
}
