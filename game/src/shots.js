// SOLMAR HEAT — the screenshot scenes behind ?shot=1|2|3|4.
// One clear job: stage a real, playable moment (a chase, a street, a mission,
// a skyline) and hand the main loop a scripted driver for it, so the frame a
// screenshot takes is what a short game really looks like. Same seed, same frame.
import { CONFIG } from './config.js';

function putPlayerInCar(game, car) {
  if (!game.playerCars.includes(car)) game.playerCars.push(car);
  game.playerController.setCar(car);
  game.player.carDamage = 0;
}

// Repaint a car bright so it reads at sunset (the parked palette is random).
function repaint(car, color) {
  const paint = car.group.userData.paint;
  if (paint) paint.color.set(color);
}

export function stageShot(name, game) {
  const city = game.city;
  const half = CONFIG.cityHalf;
  const player = game.player;
  const police = game.police;
  const missions = game.missions;

  // Clear any heat and put Mara back on foot first.
  police.reset();
  if (player.car) game.playerController.setCar(null);
  player.health = CONFIG.playerMaxHealth;
  player.ammo = CONFIG.pistolAmmo;

  if (name === '2') {
    // On foot downtown, traffic and pedestrians around, the tower ahead.
    // Mara stands on the east-west avenue looking east down the street, the
    // Solmar Tower on her left, traffic and pedestrians in frame.
    player.pos.set(-60, 0, -37);
    player.angle = Math.PI / 2;
    player.camYaw = -Math.PI / 2;
    player.camPitch = 0.12;
    // Bring the street to life around her: two traffic cars and three
    // pedestrians on this avenue, so the shot is not an empty road.
    const t = game.traffic.cars;
    if (t[0]) { t[0].pos.set(-20, 0, -37); t[0].angle = Math.PI / 2; t[0].speed = 6; }
    if (t[1]) { t[1].pos.set(30, 0, -37); t[1].angle = -Math.PI / 2; t[1].speed = 6; }
    const p = game.peds.peds;
    if (p[0]) p[0].pos.set(-30, 0, -30);
    if (p[1]) p[1].pos.set(-10, 0, -44);
    if (p[2]) p[2].pos.set(10, 0, -30);
    missions.start(1);
    return { drive: false, walk: true, seconds: 6 };
  }
  if (name === '3') {
    // A getaway on the beach road: two stars, police cruisers chasing, the
    // sunset and the sea on the left. The beach road has no lamp poles, so
    // the chase camera has a clear view.
    const car = game.playerCars[0];
    repaint(car, 0x7a4fc2); // a purple coupe, distinct from the red cover car
    car.pos.set(60, 0, 333);
    car.angle = -Math.PI / 2;
    car.speed = 18;
    putPlayerInCar(game, car);
    police.setWanted(2);
    missions.start(2);
    return { drive: true, walk: false, seconds: 5 };
  }
  if (name === '4') {
    // The skyline: the coastal road at sunset, the tower ahead, no heat.
    const car = game.playerCars[1] || game.playerCars[0];
    repaint(car, 0xe8b93b); // a yellow coupe, warm against the skyline
    car.pos.set(-40, 0, 333);
    car.angle = Math.PI; // facing north, into the city and the tower
    car.speed = 10;
    putPlayerInCar(game, car);
    missions.start(3);
    return { drive: true, walk: false, seconds: 5 };
  }
  // Shot 1 (default): the cover — a sunset chase on the beach road, three stars.
  const car = game.playerCars[0];
  repaint(car, 0xc23b2e); // a red coupe, bright against the beach road
  car.pos.set(120, 0, 333);
  car.angle = -Math.PI / 2; // heading west along the beach road
  car.speed = 24;
  putPlayerInCar(game, car);
  police.setWanted(3);
  missions.start(0);
  return { drive: true, walk: false, seconds: 5 };
}
