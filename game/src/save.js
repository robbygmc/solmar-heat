// SOLMAR HEAT — saving to the browser's localStorage.
// One clear job: persist cash, mission progress, health and position, and read
// them back. Nothing leaves the player's own browser.
const KEY = 'solmar-heat.save.v1';

export function saveGame(game) {
  try {
    const data = {
      cash: game.player.cash,
      missionIndex: game.missions.state.index,
      missionDone: game.missions.state.done,
      health: game.player.health,
      ammo: game.player.ammo,
      x: game.player.pos.x,
      z: game.player.pos.z,
      angle: game.player.angle,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable; the game still plays.
  }
}
