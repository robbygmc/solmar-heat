// SOLMAR HEAT — the HUD: minimap, stars, cash, health, objective, toasts.
// One clear job: everything drawn over the 3D view, in DOM and one 2D canvas.
// The game never touches the DOM directly; it calls hud.toast and hud.show.
import { CONFIG } from './config.js';

export function createHud(game) {
  const el = (id) => document.getElementById(id);
  const objectiveEl = el('objective');
  const starsEl = el('stars');
  const cashEl = el('cash');
  const musicEl = el('music');
  const healthFill = el('health-fill');
  const speedEl = el('speed');
  const ammoEl = el('ammo');
  const toastEl = el('toast');
  const compassEl = el('compass');
  const compassArrow = el('compass-arrow');
  const compassDist = el('compass-dist');
  const minimap = el('minimap');
  const ctx = minimap.getContext('2d');
  const crosshair = el('crosshair');
  let toastTimer = 0;
  let toastQueue = [];

  function drawMinimap() {
    const S = 200;
    const half = CONFIG.cityHalf + 40;
    const toPx = (v) => ((v + half) / (2 * half)) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(12, 16, 24, 0.82)';
    ctx.fillRect(0, 0, S, S);
    // Sea strip at the bottom.
    ctx.fillStyle = '#1e6f8e';
    ctx.fillRect(0, toPx(CONFIG.cityHalf), S, S - toPx(CONFIG.cityHalf));
    // Roads.
    ctx.strokeStyle = '#5a5a66';
    ctx.lineWidth = 3;
    for (const x of game.city.roadXs) {
      ctx.beginPath();
      ctx.moveTo(toPx(x), 0);
      ctx.lineTo(toPx(x), S);
      ctx.stroke();
    }
    for (const z of game.city.roadZs) {
      ctx.beginPath();
      ctx.moveTo(0, toPx(z));
      ctx.lineTo(S, toPx(z));
      ctx.stroke();
    }
    // Mission marker: a yellow diamond.
    const marker = game.missions.markerPos();
    if (marker) {
      ctx.fillStyle = '#ffc23b';
      const mx = toPx(marker.x);
      const my = toPx(marker.z);
      ctx.beginPath();
      ctx.moveTo(mx, my - 7);
      ctx.lineTo(mx + 6, my);
      ctx.lineTo(mx, my + 7);
      ctx.lineTo(mx - 6, my);
      ctx.closePath();
      ctx.fill();
    }
    // Police: blue dots.
    ctx.fillStyle = '#4aa0ff';
    for (const unit of game.police.cars) {
      ctx.beginPath();
      ctx.arc(toPx(unit.car.pos.x), toPx(unit.car.pos.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of game.police.footCops) {
      ctx.beginPath();
      ctx.arc(toPx(cop.pos.x), toPx(cop.pos.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player: a white arrow rotated to the heading.
    const p = game.player;
    ctx.save();
    ctx.translate(toPx(p.pos.x), toPx(p.pos.z));
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('N', 6, 14);
  }

  function updateCompass(camera) {
    const marker = game.missions.markerPos();
    if (!marker || !game.missions.state.active) {
      compassEl.style.display = 'none';
      return;
    }
    const p = game.player;
    const dx = marker.x - p.pos.x;
    const dz = marker.z - p.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 12) {
      compassEl.style.display = 'none';
      return;
    }
    // Screen-space angle: world angle minus the camera yaw.
    const worldAngle = Math.atan2(dx, dz);
    const camYaw = p.car ? p.car.angle : p.camYaw;
    let rel = worldAngle - camYaw;
    while (rel > Math.PI) rel -= 2 * Math.PI;
    while (rel < -Math.PI) rel += 2 * Math.PI;
    compassEl.style.display = 'block';
    // Only the arrow rotates to point at the objective; the distance text
    // stays upright so it is always readable.
    compassArrow.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`;
    compassDist.textContent = `${Math.round(dist)}m`;
  }

  return {
    toast(text, seconds = 3.5) {
      toastQueue.push({ text, seconds });
    },
    show(screen) {
      // screen: 'title' | 'play' | 'pause' | 'wasted' | 'busted' | null
      for (const name of ['title', 'pause', 'end']) {
        const s = el(`screen-${name}`);
        if (s) s.style.display = name === screen || (screen === 'wasted' && name === 'end') || (screen === 'busted' && name === 'end') ? 'flex' : 'none';
      }
      const endTitle = el('end-title');
      const endText = el('end-text');
      if (screen === 'wasted' && endTitle) {
        endTitle.textContent = 'WASTED';
        endText.textContent = 'Mara is down. The hospital patched her up — minus a hospital bill.';
      }
      if (screen === 'busted' && endTitle) {
        endTitle.textContent = 'BUSTED';
        endText.textContent = 'The Solmar PD caught up with Mara. Bail was not cheap.';
      }
      el('hud').style.display = screen === 'play' ? 'block' : 'none';
      crosshair.style.display = screen === 'play' ? 'block' : 'none';
    },
    update(dt, camera) {
      // Toast queue.
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toastEl.style.opacity = '0';
      }
      if (toastTimer <= 0 && toastQueue.length > 0) {
        const t = toastQueue.shift();
        toastEl.textContent = t.text;
        toastEl.style.opacity = '1';
        toastTimer = t.seconds;
      }
      const p = game.player;
      objectiveEl.textContent = game.missions.objectiveText();
      const w = game.police.wanted;
      starsEl.textContent = '★'.repeat(w) + '☆'.repeat(CONFIG.wantedMax - w);
      starsEl.style.color = w >= 3 ? '#ff5040' : w > 0 ? '#ffc23b' : '#888888';
      cashEl.textContent = `$${p.cash.toLocaleString('en-US')}`;
      if (musicEl) {
        const on = game.audio ? game.audio.musicOn() : false;
        musicEl.textContent = on ? '♪ MUSIC ON' : '♪ MUSIC OFF';
        musicEl.style.opacity = on ? '0.9' : '0.45';
      }
      healthFill.style.width = `${Math.max(0, p.health)}%`;
      healthFill.style.background = p.health > 50 ? '#3aa655' : p.health > 25 ? '#e8b93b' : '#c23b2e';
      speedEl.textContent = p.car ? `${Math.round(Math.abs(p.car.speed) * 3.6)} km/h` : '';
      ammoEl.textContent = `◉ ${p.ammo} / ${CONFIG.pistolAmmo}`;
      // No crosshair while driving: the pistol only fires on foot.
      crosshair.style.display = game.screen === 'play' && !p.car ? 'block' : 'none';
      drawMinimap();
      updateCompass(camera);
    },
  };
}
