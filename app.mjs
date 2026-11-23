import { fixtures, generateMatch, makeReport, maxFileBytes, parseEvents, summarize } from './engine.mjs';
import { drawMomentum, drawPitch } from './charts.mjs';

const get = (id) => document.getElementById(id);
const layerButtons = document.querySelectorAll('[data-layer]');
const feedSize = 8;
const pageSize = 12;
const names = { pass: 'Pass', shot: 'Shot', tackle: 'Tackle', pressure: 'Pressure', interception: 'Interception' };
const state = {
  fixture: fixtures[0],
  timeline: generateMatch(fixtures[0]),
  count: 24,
  layer: 'actions',
  filter: 'both',
  selected: null,
  tableLimit: pageSize,
  timer: null,
  imported: false,
};
let importVersion = 0;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function signed(value) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function visibleEvents() {
  return state.timeline.slice(0, state.count);
}

function filteredEvents(events) {
  return state.filter === 'both' ? events : events.filter(({ side }) => side === state.filter);
}

function renderFixture() {
  for (const side of ['home', 'away']) {
    const team = state.fixture[side];
    get(`${side}-crest`).textContent = team.mark;
    get(`${side}-name`).textContent = team.name;
    get(`legend-${side}`).textContent = team.short;
  }
}

function renderScore(stats) {
  const complete = state.count === state.timeline.length;
  get('score').replaceChildren(String(stats.home.goals), element('span', '·'), String(stats.away.goals));
  get('score').setAttribute('aria-label', `${state.fixture.home.name} ${stats.home.goals}, ${state.fixture.away.name} ${stats.away.goals}`);
  get('clock').textContent = stats.minute === 90 && complete ? 'FULL TIME' : `${stats.minute}′`;
  get('match-status').textContent = state.imported ? 'IMPORTED REPLAY' : 'SIMULATED REPLAY';
  get('event-count').textContent = `${state.count} / ${state.timeline.length} events`;
  get('progress').value = stats.minute;
  get('replay-caption').textContent = complete ? 'Replay complete' : 'Match progress';
  get('advance').disabled = complete;
  get('play').disabled = complete;
  get('play').textContent = state.timer === null ? 'Play replay' : 'Pause replay';
  get('reset').disabled = state.count === 0;
  get('report-status').textContent = complete ? 'REPLAY COMPLETE' : 'IN PLAY';
}

function renderMetrics(stats) {
  for (const [id, property, digits] of [['xg', 'xg', 2], ['xt', 'xt', 2], ['shots', 'shots', 0], ['zone', 'zone14', 0]]) {
    const home = stats.home[property].toFixed(digits);
    const away = stats.away[property].toFixed(digits);
    const metric = get(`metric-${id}`);
    metric.replaceChildren(home, element('span', '/', 'divider'), element('span', away, 'secondary'));
    metric.setAttribute('aria-label', `${state.fixture.home.name} ${home}, ${state.fixture.away.name} ${away}`);
  }
}

function renderPitch(events) {
  const selected = events.find(({ id }) => id === state.selected);
  const visual = get('pitch');
  drawPitch(visual, events, state.layer, selected);
  get('pitch-subtitle').textContent = state.layer === 'actions' ? 'Latest actions and the central pocket' : 'Starting positions of recorded actions';
  get('pitch-selection').textContent = selected
    ? `${selected.minute}′ · ${state.fixture[selected.side].short} #${selected.player} · ${selected.goal ? 'Goal' : names[selected.type]} · ${selected.startZone} to ${selected.endZone}`
    : 'Select an event to locate it on the pitch.';
  for (const button of layerButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.layer === state.layer));
  }
}

function eventRow(event) {
  const button = element('button', undefined, 'event-button');
  button.type = 'button';
  button.dataset.event = String(event.id);
  button.setAttribute('aria-pressed', String(event.id === state.selected));
  const detail = element('span', undefined, 'event-detail');
  detail.append(element('span', event.goal ? 'Goal' : names[event.type], event.goal ? 'event-name goal-name' : 'event-name'));
  const team = element('span', undefined, 'event-team');
  const dot = element('i', undefined, `dot ${event.side}`);
  dot.setAttribute('aria-hidden', 'true');
  team.append(dot, `${state.fixture[event.side].short} #${event.player}`);
  detail.append(team);
  const label = event.type === 'shot' ? `${event.xg.toFixed(2)} xG`
    : event.type === 'pass' ? `${signed(event.xt)} xT` : ' ';
  button.append(element('span', `${event.minute}′`, 'event-minute'), detail, element('span', label, 'event-value'));
  const item = element('li');
  item.append(button);
  return item;
}

function renderFeed(events) {
  const recent = events.slice(-feedSize).reverse();
  get('event-list').replaceChildren(...recent.map(eventRow));
  get('feed-count').textContent = `${recent.length} shown`;
  get('feed-empty').hidden = recent.length > 0;
  get('feed-empty').textContent = state.count ? 'No recorded actions for this team.' : 'Advance the replay to see match events.';
}

function renderTable(events) {
  const rows = [];
  for (const event of events.slice().reverse().slice(0, state.tableLimit)) {
    const row = element('tr');
    for (const value of [`${event.minute}′`, state.fixture[event.side].name, event.goal ? 'Goal' : names[event.type], `#${event.player}`,
      event.startZone, event.endZone, event.type === 'shot' ? event.xg.toFixed(2) : '—', signed(event.xt)]) {
      row.append(element('td', value));
    }
    rows.push(row);
  }
  if (!rows.length) {
    const empty = element('tr');
    const cell = element('td', 'No events to display.');
    cell.colSpan = 8;
    empty.append(cell);
    rows.push(empty);
  }
  get('event-table').replaceChildren(...rows);
  get('log-count').textContent = `${Math.min(events.length, state.tableLimit)} of ${events.length}`;
  get('more-events').hidden = events.length <= state.tableLimit;
}

function render() {
  const events = visibleEvents();
  const filtered = filteredEvents(events);
  const stats = summarize(events);
  const complete = state.count === state.timeline.length;
  renderFixture();
  renderScore(stats);
  renderMetrics(stats);
  renderPitch(filtered);
  renderFeed(filtered);
  renderTable(filtered);
  drawMomentum(get('momentum'), stats.rhythm, stats.minute);
  get('momentum-summary').textContent = `Total positive threat: ${state.fixture.home.short} ${stats.home.xt.toFixed(2)} xT · ${state.fixture.away.short} ${stats.away.xt.toFixed(2)} xT.`;
  const report = makeReport(state.fixture, events, stats, complete);
  for (const [index, role] of ['analyst', 'tactician', 'coach'].entries()) {
    get(`report-${role}`).textContent = report[index];
  }
}

function stopReplay() {
  window.clearInterval(state.timer);
  state.timer = null;
}

function advance(announce = true) {
  if (state.count === state.timeline.length) return;
  state.count += 1;
  const complete = state.count === state.timeline.length;
  if (complete) stopReplay();
  render();
  const event = state.timeline[state.count - 1];
  if (announce || complete) {
    get('replay-status').textContent = complete ? 'Replay complete.' : `${event.minute}′ ${event.goal ? 'Goal' : names[event.type]} by ${state.fixture[event.side].name}.`;
  }
}

function setTimeline(events, count, imported) {
  stopReplay();
  state.timeline = events;
  state.count = count;
  state.selected = null;
  state.tableLimit = pageSize;
  state.imported = imported;
  state.filter = 'both';
  get('team-filter').value = 'both';
  get('restore-demo').hidden = !imported;
  render();
}

function loadDemoFixture() {
  importVersion += 1;
  setTimeline(generateMatch(state.fixture), 24, false);
  get('import-status').textContent = '';
  get('replay-status').textContent = 'Demo fixture loaded.';
}

get('advance').addEventListener('click', () => advance());
get('play').addEventListener('click', () => {
  if (state.timer === null) {
    state.timer = window.setInterval(() => advance(false), 750);
    get('replay-status').textContent = 'Replay playing.';
  } else {
    stopReplay();
    get('replay-status').textContent = 'Replay paused.';
  }
  get('play').textContent = state.timer === null ? 'Play replay' : 'Pause replay';
});
get('reset').addEventListener('click', () => {
  setTimeline(state.timeline, 0, state.imported);
  get('replay-status').textContent = 'Replay restarted at kickoff.';
});
get('fixture').addEventListener('change', ({ target }) => {
  state.fixture = fixtures.find(({ id }) => id === target.value);
  loadDemoFixture();
});
get('restore-demo').addEventListener('click', () => {
  loadDemoFixture();
  get('import-file').focus();
});
for (const button of layerButtons) {
  button.addEventListener('click', () => {
    state.layer = button.dataset.layer;
    renderPitch(filteredEvents(visibleEvents()));
  });
}
get('team-filter').addEventListener('change', ({ target }) => {
  state.filter = target.value;
  state.selected = null;
  state.tableLimit = pageSize;
  const events = filteredEvents(visibleEvents());
  renderPitch(events);
  renderFeed(events);
  renderTable(events);
});
get('event-list').addEventListener('click', ({ target }) => {
  const button = target.closest('button[data-event]');
  if (!button) return;
  if (state.timer !== null) {
    stopReplay();
    get('play').textContent = 'Play replay';
    get('replay-status').textContent = 'Replay paused.';
  }
  const eventId = Number(button.dataset.event);
  state.selected = state.selected === eventId ? null : eventId;
  for (const row of get('event-list').querySelectorAll('button')) {
    row.setAttribute('aria-pressed', String(Number(row.dataset.event) === state.selected));
  }
  renderPitch(filteredEvents(visibleEvents()));
});
get('more-events').addEventListener('click', () => {
  state.tableLimit += pageSize;
  renderTable(filteredEvents(visibleEvents()));
  if (get('more-events').hidden) get('event-table').closest('.table-scroll').focus();
});
get('import-file').addEventListener('change', async ({ target }) => {
  const [file] = target.files;
  target.value = '';
  if (!file) return;
  const version = ++importVersion;
  const status = get('import-status');
  try {
    if (file.size > maxFileBytes) throw new Error('Choose a file no larger than 256 KiB.');
    const source = await file.text();
    if (version !== importVersion) return;
    const events = parseEvents(source);
    setTimeline(events, 0, true);
    status.textContent = `Loaded ${events.length} ${events.length === 1 ? 'event' : 'events'} locally. Use the replay controls to start.`;
    status.classList.remove('error');
  } catch (error) {
    if (version !== importVersion) return;
    status.textContent = error instanceof TypeError ? 'The file could not be read. Choose it again.' : error.message;
    status.classList.add('error');
  }
});

render();
