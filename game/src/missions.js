// SOLMAR HEAT — missions and the story of Mara Voss.
// One clear job: the five jobs Dante Cruz hands Mara, their objectives, the
// beacon that marks them, and the cash and progression they pay.
// Story: Mara Voss, a getaway driver, owes a debt. Dante Cruz, her fixer,
// gives her jobs until the debt is paid. Original characters, original city.
import * as THREE from 'three';
import { createCarMesh } from './vehicles.js';

const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: 'Dante: "Mara, I need wheels. There is a red coupe parked at the marina. Bring it to my garage."',
    reward: 400,
    steps: [
      { type: 'goto', label: 'Get to the marina coupe', pos: 'marina', radius: 6, needCar: false },
      { type: 'drive', label: 'Steal a car and bring it to the garage', pos: 'garage', radius: 16, needCar: true },
    ],
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    briefing: 'Dante: "Package waiting at the port, by the blue containers. Grab it on foot, then run it to the Vista Hotel."',
    reward: 600,
    steps: [
      { type: 'pickup', label: 'Pick up the package at the port (press E)', pos: 'port', radius: 5, needCar: false },
      { type: 'goto', label: 'Deliver the package to the Vista Hotel', pos: 'hotel', radius: 16, needCar: false },
    ],
  },
  {
    id: 'smoke-on-the-strip',
    title: 'Smoke on the Strip',
    briefing: 'Dante: "You got made leaving the hotel. Two stars on you. Lose the heat, then get to the safehouse."',
    reward: 800,
    heat: 2,
    steps: [
      { type: 'lose', label: 'Lose the wanted level', pos: null, radius: 0, needCar: false },
      { type: 'goto', label: 'Reach the safehouse', pos: 'safehouse', radius: 8, needCar: false },
    ],
  },
  {
    id: 'harbor-lights',
    title: 'Harbor Lights',
    briefing: 'Dante: "Timed run. The buyer waits at the harbor — 150 seconds, no excuses. Go."',
    reward: 1000,
    timed: 150,
    steps: [
      { type: 'goto', label: 'Reach the harbor before time runs out', pos: 'port', radius: 12, needCar: false },
    ],
  },
  {
    id: 'the-last-job',
    title: 'The Last Job',
    briefing: 'Dante: "The casino van. Take it, lose three stars, bring it to my garage — and your debt is paid."',
    reward: 2500,
    heat: 3,
    steps: [
      { type: 'van', label: 'Take the casino van', pos: 'van', radius: 8, needCar: false },
      { type: 'drive', label: 'Deliver the van to the garage', pos: 'garage', radius: 16, needCar: true },
    ],
  },
];

export function createMissions(scene, city, game) {
  // The beacon: a glowing column + a bobbing arrow over the current objective.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffc23b, transparent: true, opacity: 0.35, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 40, 16, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2, 4),
    new THREE.MeshBasicMaterial({ color: 0xffc23b }),
  );
  arrow.rotation.x = Math.PI;
  arrow.visible = false;
  scene.add(arrow);
  // A flat ring on the ground marking the zone where the objective completes
  // — the player can see exactly how close they need to get. Its radius
  // matches the current step's trigger radius.
  const zone = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0xffc23b, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  );
  zone.rotation.x = -Math.PI / 2;
  zone.position.y = 0.12;
  zone.visible = false;
  scene.add(zone);

  let missionVan = null;
  const state = {
    index: 0,
    step: 0,
    active: false,
    done: false,
    timer: 0,
    startedAt: 0,
  };

  function objectivePos(step) {
    if (!step || !step.pos) return null;
    const lm = city.landmarks[step.pos];
    return lm ? { x: lm.x, z: lm.z } : null;
  }

  function currentMission() {
    return MISSIONS[state.index] ?? null;
  }

  function currentStep() {
    const m = currentMission();
    return m ? m.steps[state.step] ?? null : null;
  }

  function placeBeacon() {
    const step = currentStep();
    const pos = step ? objectivePos(step) : null;
    if (pos) {
      beacon.visible = true;
      arrow.visible = true;
      beacon.position.set(pos.x, 20, pos.z);
      arrow.position.set(pos.x, 12, pos.z);
      zone.visible = true;
      zone.position.set(pos.x, 0.12, pos.z);
      zone.scale.setScalar(step.radius || 8);
    } else {
      beacon.visible = false;
      arrow.visible = false;
      zone.visible = false;
    }
  }

  function startMission(index) {
    const m = MISSIONS[index];
    if (!m) {
      state.done = true;
      state.active = false;
      beacon.visible = false;
      arrow.visible = false;
      zone.visible = false;
      return;
    }
    state.index = index;
    state.step = 0;
    state.active = true;
    state.timer = m.timed ?? 0;
    state.startedAt = game.time;
    game.toast(`MISSION: ${m.title}`, 4);
    game.toast(m.briefing, 6);
    if (m.heat) game.police.setWanted(m.heat);
    if (m.id === 'the-last-job') spawnMissionVan();
    placeBeacon();
    game.audio?.mission();
  }

  function spawnMissionVan() {
    if (missionVan) return;
    const lm = city.landmarks.van;
    const { group, wheels, length } = createCarMesh(0x1e5f7a, 'van');
    group.position.set(lm.x, 0, lm.z);
    group.rotation.y = 0.6;
    scene.add(group);
    missionVan = {
      group, wheels, length, type: 'van', missionVan: true,
      pos: new THREE.Vector3(lm.x, 0, lm.z), angle: 0.6, speed: 0,
    };
    game.playerCars.push(missionVan);
  }

  function completeStep() {
    const m = currentMission();
    state.step += 1;
    game.audio?.objective();
    if (state.step >= m.steps.length) {
      // Mission complete.
      game.player.cash += m.reward;
      game.toast(`MISSION COMPLETE: ${m.title} — +$${m.reward}`, 5);
      game.audio?.complete();
      game.save?.();
      startMission(state.index + 1);
      // startMission leaves state.index on the last mission when there is no
      // next one, so test state.done (set by startMission) instead — the old
      // index test could never fire and the story toast was dead.
      if (state.done) {
        game.toast('STORY COMPLETE: The debt is paid. Solmar is yours — free roam.', 7);
      }
    } else {
      const next = currentStep();
      game.toast(next.label, 4);
      placeBeacon();
    }
  }

  function failTimed() {
    const m = currentMission();
    game.toast('Too slow — Dante is not waiting. The run starts over.', 5);
    state.step = 0;
    state.timer = m.timed ?? 0;
    placeBeacon();
  }

  return {
    state,
    missions: MISSIONS,
    // What the HUD shows as the current objective.
    objectiveText() {
      if (state.done) return 'Free roam — Solmar is yours.';
      const m = currentMission();
      const s = currentStep();
      if (!m || !s) return '';
      let text = `${m.title}: ${s.label}`;
      if (state.timer > 0) text += ` — ${Math.ceil(state.timer)}s`;
      return text;
    },
    // Objective position for the minimap and the compass arrow.
    markerPos() {
      const step = currentStep();
      return step ? objectivePos(step) : null;
    },
    start(index) {
      startMission(index);
    },
    // The player pressed E near the objective (pickup / van steps).
    interact(player) {
      const step = currentStep();
      if (!state.active || !step) return false;
      if (step.type === 'pickup') {
        const pos = objectivePos(step);
        if (pos && Math.hypot(player.pos.x - pos.x, player.pos.z - pos.z) < step.radius + 2) {
          game.toast('Package secured. Now the hotel.', 3);
          completeStep();
          return true;
        }
      }
      return false;
    },
    update(dt) {
      if (!state.active || state.done) return;
      const m = currentMission();
      const step = currentStep();
      if (!m || !step) return;
      // Beacon bob.
      if (beacon.visible) {
        arrow.position.y = 12 + Math.sin(game.time * 3) * 0.8;
        arrow.rotation.y += dt * 2;
      }
      // Timed mission.
      if (state.timer > 0) {
        state.timer -= dt;
        if (state.timer <= 0) {
          failTimed();
          return;
        }
      }
      const player = game.player;
      const pos = objectivePos(step);
      if (step.type === 'lose') {
        if (game.police.wanted === 0) completeStep();
        return;
      }
      if (step.type === 'van') {
        if (player.car && player.car.missionVan) {
          completeStep();
        }
        return;
      }
      // A pickup only completes when the player presses E at the spot
      // (missions.interact) — walking past it is not enough.
      if (step.type === 'pickup') return;
      if (!pos) return;
      const dist = Math.hypot(player.pos.x - pos.x, player.pos.z - pos.z);
      if (dist < step.radius) {
        if (step.needCar && !player.car) {
          // Arrived on foot where a car is needed: wait for the player to drive in.
          return;
        }
        completeStep();
      }
    },
  };
}
