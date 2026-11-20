// The DOM HUD over the canvas: health, money, wanted stars, the objective banner, the rotating
// minimap, the vehicle panel, notifications, the contracts list and the title / paused / game over
// screens. Nothing here touches the three.js scene; the game tells it what changed and it draws.

const el = (id) => document.getElementById(id);

export function createHUD() {
  const healthBar = el('health');
  const money = el('money');
  const stars = el('stars');
  const objective = el('objective');
  const notifications = el('notifications');
  const missionPanel = el('missions');
  const missionList = el('mission-list');
  const vehicle = el('vehicle');
  const vehicleName = el('vehicle-name');
  const vehicleSpeedNum = el('vehicle-speed-num');
  const vehicleHealth = el('vehicle-health');
  const district = el('district');
  const screens = { title: el('screen-title'), paused: el('screen-paused'), over: el('screen-over') };
  const controls = el('controls-help');
  let muted = false;

  function notify(text) {
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = text;
    notifications.appendChild(div);
    requestAnimationFrame(() => div.classList.add('show'));
    setTimeout(() => {
      div.classList.remove('show');
      setTimeout(() => div.remove(), 400);
    }, 3600);
  }

  function setScreen(name) {
    for (const [key, node] of Object.entries(screens)) node.classList.toggle('hidden', key !== name);
  }

  function showControls(on) {
    controls.classList.toggle('hidden', !on);
  }

  function update(state) {
    healthBar.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    money.textContent = `$${state.money.toLocaleString('en-US')}`;
    let starString = '';
    for (let i = 0; i < 5; i++) starString += i < state.wanted ? '★' : '☆';
    stars.textContent = starString;
    stars.classList.toggle('hot', state.wanted > 0);
    objective.textContent = state.objective ?? '';
    if (state.inCar) {
      vehicle.classList.remove('hidden');
      vehicleName.textContent = state.vehicleName;
      vehicleSpeedNum.textContent = String(Math.round(Math.abs(state.speed) * 3.6));
      vehicleHealth.style.width = `${Math.max(0, state.vehicleHealth)}%`;
    } else {
      vehicle.classList.add('hidden');
    }
    district.textContent = state.district ?? 'Lumen Bay';
    void muted;
  }

  function renderMissions(missions, currentIndex, completed) {
    missionList.innerHTML = '';
    missions.forEach((mission, index) => {
      const li = document.createElement('li');
      const done = completed.includes(mission.id);
      li.className = done ? 'done' : index === currentIndex ? 'active' : '';
      li.textContent = `${index + 1}. ${mission.title}${done ? ' — done' : ''}`;
      missionList.appendChild(li);
    });
  }

  function toggleMissions(force) {
    const show = force ?? missionPanel.classList.contains('hidden');
    missionPanel.classList.toggle('hidden', !show);
    return show;
  }

  function setOverStats(value, reason) {
    el('over-money').textContent = `$${value.toLocaleString('en-US')}`;
    el('over-reason').textContent = reason ?? 'You were taken down.';
  }

  function showContinue(hasSave) {
    el('btn-continue').classList.toggle('hidden', !hasSave);
  }

  function setMute(value) {
    muted = value;
  }

  return { notify, setScreen, showControls, update, renderMissions, toggleMissions, setOverStats, showContinue, setMute };
}
