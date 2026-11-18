// SOLMAR HEAT — the city itself.
// One clear job: build Solmar from a seed — roads, sidewalks, buildings, beach,
// sea, sky, palms, lamps and landmarks — and hand back the colliders, the road
// graph traffic drives on, and the named places missions use.
import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';

// A canvas texture of one building face: windows, some lit warm for sunset.
function buildingTexture(baseColor, litRatio, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 14;
  const cw = 128 / cols;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng.next() < litRatio;
      ctx.fillStyle = lit ? '#ffd98a' : '#202c40';
      ctx.fillRect(c * cw + 3, r * rh + 4, cw - 6, rh - 8);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The ground: one 1024 canvas painted as the whole street grid — asphalt roads
// with lane dashes and crosswalks, pale sidewalks, and a sand strip at the south.
function groundTexture(city) {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const half = city.half;
  const toPx = (v) => ((v + half) / (2 * half)) * S;
  // Sidewalk base.
  ctx.fillStyle = '#8a8578';
  ctx.fillRect(0, 0, S, S);
  // Asphalt roads.
  ctx.fillStyle = '#4e4e58';
  for (const x of city.roadXs) {
    ctx.fillRect(toPx(x - CONFIG.roadWidth / 2), 0, toPx(CONFIG.roadWidth), S);
  }
  for (const z of city.roadZs) {
    ctx.fillRect(0, toPx(z - CONFIG.roadWidth / 2), S, toPx(CONFIG.roadWidth));
  }
  // Lane dashes (canvas y is flipped vs world z; symmetric, so it does not matter).
  ctx.fillStyle = '#8a7a44';
  for (const x of city.roadXs) {
    for (let z = -half + 8; z < half - 8; z += 16) {
      ctx.fillRect(toPx(x) - 1, toPx(z), 1.5, 5);
    }
  }
  for (const z of city.roadZs) {
    for (let x = -half + 8; x < half - 8; x += 16) {
      ctx.fillRect(toPx(x), toPx(z) - 1, 5, 1.5);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = '#8f8a7c';
  for (const x of city.roadXs) {
    for (const z of city.roadZs) {
      for (let k = -2; k <= 2; k += 1) {
        ctx.fillRect(toPx(x - 4 + k * 3), toPx(z - CONFIG.roadWidth / 2 + 1), 1.5, 3);
        ctx.fillRect(toPx(x - 4 + k * 3), toPx(z + CONFIG.roadWidth / 2 - 4), 1.5, 3);
      }
    }
  }
  // The beach itself is a separate sand mesh south of the ground plane; the
  // ground texture ends at the southern road so the beach road stays asphalt.
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// A billboard face with original Solmar wording.
function billboardTexture(lines, bg, fg, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = fg;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, 128, 56 + i * 38);
  });
  // Sun rays, because everything in Solmar advertises the sunset.
  ctx.strokeStyle = fg;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(128, 118);
    ctx.lineTo(128 + Math.cos(a) * 40, 118 - Math.sin(a) * 26);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const half = CONFIG.cityHalf;
  const pitch = CONFIG.blockSize + CONFIG.roadWidth;
  const roadXs = [];
  const roadZs = [];
  for (let i = 0; i <= CONFIG.blocks; i += 1) {
    const c = -half + CONFIG.roadWidth / 2 + i * pitch;
    roadXs.push(c);
    roadZs.push(c);
  }
  const city = { half, roadXs, roadZs, colliders: [], spawnPoints: {}, landmarks: {} };

  // ---- Sky, sun, fog ----
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(CONFIG.skyTop) },
      mid: { value: new THREE.Color(CONFIG.skyMid) },
      low: { value: new THREE.Color(CONFIG.skyLow) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){
        float h = normalize(vP).y;
        vec3 c = h > 0.35 ? mix(mid, top, smoothstep(0.35, 0.8, h)) : mix(low, mid, smoothstep(0.02, 0.45, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const sun = new THREE.DirectionalLight(CONFIG.sunColor, CONFIG.sunIntensity);
  sun.position.set(-180, 90, -260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -380;
  sun.shadow.camera.right = 380;
  sun.shadow.camera.top = 380;
  sun.shadow.camera.bottom = -380;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffc98a, 0x3a2f2a, 1.25));
  scene.fog = new THREE.Fog(CONFIG.fogColor, CONFIG.fogNear, CONFIG.fogFar);

  // The sun disc itself, low in the west.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
  );
  sunDisc.position.set(-560, 110, -420);
  sunDisc.lookAt(0, 60, 0);
  scene.add(sunDisc);

  // ---- Ground ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * half, 2 * half),
    new THREE.MeshStandardMaterial({ map: groundTexture(city), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Beach sand and sea, south of the city (+z).
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * half + 400, 90),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, half + 45);
  sand.receiveShadow = true;
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 500),
    new THREE.MeshStandardMaterial({ color: 0x35809e, roughness: 0.2, metalness: 0.5 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, half + 90 + 250);
  scene.add(sea);

  // ---- Buildings ----
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const buildingMats = PALETTE.building.map((color) => {
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    const tex = buildingTexture(hex, 0.35, rng);
    return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.85 });
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 });
  const addCollider = (x, z, w, d) => {
    city.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  };

  // Downtown is the middle blocks; heights fall off toward the edges.
  const blockCenters = [];
  for (let i = 0; i < CONFIG.blocks; i += 1) {
    blockCenters.push(-half + CONFIG.roadWidth + CONFIG.blockSize / 2 + i * pitch);
  }
  let towerPlaced = false;
  for (let bi = 0; bi < CONFIG.blocks; bi += 1) {
    for (let bj = 0; bj < CONFIG.blocks; bj += 1) {
      const bx = blockCenters[bi];
      const bz = blockCenters[bj];
      const distCenter = Math.max(Math.abs(bx), Math.abs(bz)) / half;
      // The south row is the hotel strip; the east edge is the port; one block is a park.
      const isHotelRow = bj === CONFIG.blocks - 1;
      const isPort = bi === CONFIG.blocks - 1 && bj >= 2 && bj <= 4;
      const isPark = bi === 2 && bj === 2;
      if (isPark) {
        // Park: lawn, trees, paths — no buildings.
        const lawn = new THREE.Mesh(
          new THREE.PlaneGeometry(CONFIG.blockSize, CONFIG.blockSize),
          new THREE.MeshStandardMaterial({ color: 0x4d7a3a, roughness: 1 }),
        );
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(bx, 0.08, bz);
        lawn.receiveShadow = true;
        scene.add(lawn);
        for (let t = 0; t < 8; t += 1) {
          addPalm(scene, bx + rng.range(-24, 24), bz + rng.range(-24, 24), rng);
        }
        continue;
      }
      if (isPort) {
        // Port: stacked containers.
        const contCols = [0x2e6f8e, 0xc25a2e, 0x7a9a3a, 0x8e2e5a];
        for (let c = 0; c < 10; c += 1) {
          const w = 12;
          const h = rng.range(2.4, 7);
          const cont = new THREE.Mesh(
            boxGeo,
            new THREE.MeshStandardMaterial({ color: contCols[c % contCols.length], roughness: 0.8 }),
          );
          cont.scale.set(w, h, 2.6);
          cont.position.set(bx - 18 + (c % 5) * 13, h / 2, bz - 12 + Math.floor(c / 5) * 12);
          cont.castShadow = true;
          cont.receiveShadow = true;
          scene.add(cont);
          addCollider(cont.position.x, cont.position.z, w, 2.6);
        }
        city.landmarks.port = { x: bx, z: bz };
        continue;
      }
      const count = isHotelRow ? 2 : rng.int(1, 3);
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(16, 26);
        const d = rng.range(16, 26);
        const hBase = isHotelRow ? rng.range(22, 34) : rng.range(9, 46) * (1 - distCenter * 0.55);
        let h = Math.max(8, hBase);
        let x = bx + rng.range(-14, 14);
        let z = bz + rng.range(-14, 14);
        if (!towerPlaced && bi === 4 && bj === 4 && k === 0) {
          // Solmar Tower, the skyline's anchor.
          h = 78;
          x = bx;
          z = bz;
          towerPlaced = true;
          city.landmarks.tower = { x, z };
        }
        const mat = buildingMats[Math.floor(rng.next() * buildingMats.length)];
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
        // Rooftop box.
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w * 0.3, 2, d * 0.3);
        roof.position.set(x, h + 1, z);
        scene.add(roof);
        addCollider(x, z, w, d);
        if (isHotelRow && k === 0) city.landmarks.hotel = { x, z };
      }
    }
  }
  if (!city.landmarks.tower) city.landmarks.tower = { x: 0, z: 0 };
  if (!city.landmarks.hotel) city.landmarks.hotel = { x: 0, z: half - 40 };

  // ---- Palms along the beach and the main avenue ----
  for (let x = -half + 20; x < half - 10; x += 42) {
    addPalm(scene, x, half - 18, rng);
  }
  for (let z = -half + 30; z < half - 40; z += 70) {
    addPalm(scene, -half + 24, z, rng);
  }

  // ---- Street lamps along the roads ----
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  const lampHeadMat = new THREE.MeshStandardMaterial({
    color: 0xffe9b0, emissive: 0xffc36b, emissiveIntensity: 1.4,
  });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const headGeo = new THREE.SphereGeometry(0.35, 8, 6);
  for (const x of roadXs) {
    for (let z = -half + 40; z < half - 20; z += 110) {
      const pole = new THREE.Mesh(poleGeo, lampMat);
      pole.position.set(x + CONFIG.roadWidth / 2 + 1.5, 3, z);
      scene.add(pole);
      const head = new THREE.Mesh(headGeo, lampHeadMat);
      head.position.set(x + CONFIG.roadWidth / 2 + 1.5, 6.1, z);
      scene.add(head);
    }
  }

  // ---- Billboards (original Solmar wording only) ----
  const boards = [
    { lines: ['SOLMAR', 'CITY OF SUN'], bg: '#c23b2e', fg: '#ffe9b0', x: -120, z: -180, ry: 0 },
    { lines: ['VISTA HOTEL', 'BEACHFRONT'], bg: '#1e5f7a', fg: '#eaf6ff', x: 60, z: half - 46, ry: Math.PI },
    { lines: ['HEAT', 'TONIGHT'], bg: '#222222', fg: '#ff5a3c', x: 200, z: 40, ry: Math.PI / 2 },
  ];
  for (const bd of boards) {
    const tex = billboardTexture(bd.lines, bd.bg, bd.fg, rng);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 9),
      new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.5 }),
    );
    board.position.set(bd.x, 14, bd.z);
    board.rotation.y = bd.ry;
    scene.add(board);
    const post = new THREE.Mesh(boxGeo, lampMat);
    post.scale.set(1, 14, 1);
    post.position.set(bd.x, 7, bd.z);
    scene.add(post);
  }

  // ---- Named places missions use ----
  city.landmarks.garage = { x: -150, z: -40 };
  // The marina landmark IS the red coupe's parking spot, so the beacon points
  // at the car the player has to steal, not at an empty stretch of beach.
  city.landmarks.marina = { x: -260, z: half - 60 };
  city.landmarks.casino = { x: 150, z: -150 };
  // The casino van waits on the open road east of the casino block — the
  // block itself is full of buildings, so the van must not spawn inside one.
  city.landmarks.van = { x: 185, z: -150 };
  city.landmarks.safehouse = { x: -40, z: 180 };
  city.landmarks.hospital = { x: 40, z: -260 };

  // A small garage building at the garage landmark.
  const garage = new THREE.Mesh(
    boxGeo,
    new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.9 }),
  );
  garage.scale.set(22, 7, 14);
  garage.position.set(city.landmarks.garage.x, 3.5, city.landmarks.garage.z);
  garage.castShadow = true;
  garage.receiveShadow = true;
  scene.add(garage);
  addCollider(garage.position.x, garage.position.z, 22, 14);

  // Parked cars the player can steal: fixed curb spots. Every spot was
  // checked against the building colliders — all of them sit on open ground
  // (two early spots sat inside buildings and were moved to the nearest road).
  city.spawnPoints.parked = [];
  const parkSpots = [
    { x: -260, z: half - 60, angle: Math.PI / 2 },
    { x: -140, z: -20, angle: 0 },
    { x: 120, z: 120, angle: Math.PI },
    { x: 40, z: -120, angle: -Math.PI / 2 },
    { x: -60, z: 37, angle: Math.PI / 2 },
    { x: 220, z: -37, angle: Math.PI / 2 },
    // Two more on the beach road, right by the spawn, so the player can
    // grab wheels immediately and drive west to the marina.
    { x: -60, z: 333, angle: -Math.PI / 2 },
    { x: 200, z: 333, angle: -Math.PI / 2 },
  ];
  for (const s of parkSpots) city.spawnPoints.parked.push(s);
  // The player starts on the beach road, facing west toward the marina and
  // the sunset — open road, palms, the sea on the left.
  city.spawnPoints.player = { x: -100, z: 333, angle: -Math.PI / 2 };

  return city;
}

// One palm: a leaning trunk and a flattened cone crown. Two meshes, cheap.
function addPalm(scene, x, z, rng) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.34, 7, 6),
    new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 }),
  );
  trunk.position.set(x, 3.5, z);
  trunk.rotation.z = rng.range(-0.08, 0.08);
  trunk.castShadow = true;
  scene.add(trunk);
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 2.4, 7),
    new THREE.MeshStandardMaterial({ color: 0x2e6b34, roughness: 1 }),
  );
  crown.position.set(x, 7.6, z);
  crown.scale.y = 0.55;
  crown.castShadow = true;
  scene.add(crown);
}

// Circle (x,z,r) vs the building AABBs: push the circle out, return the corrected position.
export function resolveCircleCollisions(city, x, z, r) {
  let px = x;
  let pz = z;
  for (const c of city.colliders) {
    const cx = Math.max(c.minX, Math.min(px, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * r;
        pz = cz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pushL = px - c.minX + r;
        const pushR = c.maxX - px + r;
        const pushT = pz - c.minZ + r;
        const pushB = c.maxZ - pz + r;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) px = c.minX - r;
        else if (m === pushR) px = c.maxX + r;
        else if (m === pushT) pz = c.minZ - r;
        else pz = c.maxZ + r;
      }
    }
  }
  // World bounds: the city, the beach and a little sea.
  const bound = CONFIG.cityHalf + 100;
  px = Math.max(-bound, Math.min(bound, px));
  pz = Math.max(-bound, Math.min(CONFIG.cityHalf + 100, pz));
  return { x: px, z: pz };
}

// Is a point on a road (used to keep pedestrians and parked cars off blocks)?
export function isOnRoad(city, x, z) {
  const half = CONFIG.roadWidth / 2;
  for (const rx of city.roadXs) {
    if (Math.abs(x - rx) < half + CONFIG.sidewalk) return true;
  }
  for (const rz of city.roadZs) {
    if (Math.abs(z - rz) < half + CONFIG.sidewalk) return true;
  }
  return false;
}
