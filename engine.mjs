export const fixtures = [
  {
    id: 'northbridge-eastport',
    seed: 3229,
    home: { name: 'Northbridge FC', short: 'NBR', mark: 'N', strength: 0.58, shapes: ['3-2-5', '4-4-2'] },
    away: { name: 'Eastport City', short: 'EPC', mark: 'E', strength: 0.42, shapes: ['2-3-5', '4-2-3-1'] },
  },
  {
    id: 'seaview-southbank',
    seed: 1239,
    home: { name: 'Seaview Athletic', short: 'SVA', mark: 'S', strength: 0.46, shapes: ['2-3-5', '4-1-4-1'] },
    away: { name: 'Southbank United', short: 'SBU', mark: 'U', strength: 0.54, shapes: ['3-2-5', '4-4-2'] },
  },
];

export const sides = ['home', 'away'];
export const eventTypes = ['pass', 'shot', 'tackle', 'pressure', 'interception'];
export const maxEvents = 300;
export const maxFileBytes = 256 * 1024;
const fields = ['minute', 'side', 'type', 'player', 'startX', 'startY', 'endX', 'endY', 'pressure', 'goal'];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomFrom(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function threatAt(x, y) {
  return (x / 100) ** 2 * (1 - Math.abs(y - 50) / 100);
}

export function zoneAt(x, y) {
  if (x >= 88 && y >= 20.5 && y <= 79.5) return 'Penalty area';
  if (x >= 70 && x < 88 && y >= 40 && y <= 60) return 'Zone 14';

  const third = x < 35 ? 'Defensive third' : x < 70 ? 'Middle third' : 'Attacking third';
  if (y < 25 || y > 75) return `${third} / flank`;
  if (y < 40 || y > 60) return `${third} / half-space`;
  return `${third} / central`;
}

function shotValue(x, y, pressure) {
  const distance = Math.hypot((100 - x) * 1.05, (50 - y) * 0.68);
  return round(clamp(0.52 * Math.exp(-distance / 19) * (1 - pressure * 0.55), 0.01, 0.50));
}

function enrich(event, index) {
  const attacking = event.type === 'pass' || event.type === 'shot';
  const startThreat = threatAt(event.startX, event.startY);
  const endThreat = threatAt(event.endX, event.endY);
  return {
    ...event,
    id: index + 1,
    startZone: zoneAt(event.startX, event.startY),
    endZone: zoneAt(event.endX, event.endY),
    xt: attacking ? round(clamp(endThreat - startThreat, -0.2, 1)) : 0,
    xg: event.type === 'shot' ? shotValue(event.startX, event.startY, event.pressure) : 0,
  };
}

export function generateMatch(fixture) {
  const random = randomFrom(fixture.seed);
  const int = (min, max) => min + Math.floor(random() * (max - min + 1));
  return Array.from({ length: 76 }, (_, index) => {
    const choice = random();
    const side = random() < fixture.home.strength ? 'home' : 'away';
    const type = choice < 0.54 ? 'pass' : choice < 0.77 ? 'shot' : choice < 0.87 ? 'tackle' : choice < 0.95 ? 'pressure' : 'interception';
    const player = type === 'shot' ? int(7, 11) : int(2, 11);
    const startX = type === 'shot' ? int(72, 96) : int(12, 84);
    const startY = type === 'shot' ? int(24, 76) : int(8, 92);
    const endX = type === 'shot' ? 100 : type === 'pass' ? clamp(startX + int(-18, 33), 0, 100) : startX;
    const endY = type === 'shot' ? int(33, 67) : type === 'pass' ? clamp(startY + int(-25, 25), 0, 100) : startY;
    const pressure = int(12, 92) / 100;
    const goal = type === 'shot' && random() < shotValue(startX, startY, pressure);
    return enrich({ minute: 1 + Math.floor(index * 89 / 75), side, type, player, startX, startY, endX, endY, pressure, goal }, index);
  });
}

export function parseEvents(source) {
  let events;
  try {
    events = JSON.parse(source);
  } catch {
    throw new Error('Choose a valid JSON file.');
  }
  if (!Array.isArray(events) || events.length < 1 || events.length > maxEvents) {
    throw new Error(`Use a JSON array with 1 to ${maxEvents} events.`);
  }
  let previousMinute = 0;
  return events.map((event, index) => {
    const invalid = (message) => { throw new Error(`Event ${index + 1}: ${message}`); };
    if (!event || typeof event !== 'object' || Array.isArray(event)
        || Object.keys(event).length !== fields.length
        || fields.some((field) => !Object.hasOwn(event, field))) {
      invalid('use exactly the fields in the example file.');
    }
    const { minute, side, type, player, startX, startY, endX, endY, pressure, goal } = event;
    if (!Number.isInteger(minute) || minute < previousMinute || minute < 1 || minute > 90) {
      invalid('minutes must be integers from 1 to 90 in chronological order.');
    }
    if (!sides.includes(side) || !eventTypes.includes(type)) {
      invalid('choose a supported side and event type.');
    }
    if (!Number.isInteger(player) || player < 1 || player > 99) {
      invalid('the shirt number must be an integer from 1 to 99.');
    }
    if (![startX, startY, endX, endY].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)
        || !Number.isFinite(pressure) || pressure < 0 || pressure > 1) {
      invalid('coordinates must be from 0 to 100 and pressure from 0 to 1.');
    }
    if (typeof goal !== 'boolean' || (goal && type !== 'shot')) {
      invalid('only a shot can be marked as a goal.');
    }
    previousMinute = minute;
    return enrich(event, index);
  });
}

export function pitchPoint(event, end = false) {
  const x = end ? event.endX : event.startX;
  const y = end ? event.endY : event.startY;
  return event.side === 'home' ? [x, y] : [100 - x, 100 - y];
}

export function summarize(events) {
  const teamStats = () => ({ goals: 0, shots: 0, passes: 0, xg: 0, xt: 0, zone14: 0 });
  const teams = { home: teamStats(), away: teamStats() };
  const rhythm = Array.from({ length: 18 }, () => ({ home: 0, away: 0 }));
  let topAction = null;
  for (const event of events) {
    const team = teams[event.side];
    team.goals += Number(event.goal);
    team.shots += Number(event.type === 'shot');
    team.passes += Number(event.type === 'pass');
    team.xg += event.xg;
    team.xt += Math.max(0, event.xt);
    team.zone14 += Number(event.type === 'pass' && event.endZone === 'Zone 14' && event.startZone !== 'Zone 14');
    rhythm[Math.floor((event.minute - 1) / 5)][event.side] += Math.max(0, event.xt);
    if (event.xt > (topAction?.xt ?? 0)) topAction = event;
  }
  return { ...teams, rhythm, topAction, minute: events.at(-1)?.minute ?? 0 };
}

export function makeReport(fixture, events, stats, complete) {
  if (!events.length) return ['Advance the replay to collect match events.', 'The pitch will show where actions happen.', 'A coaching cue will appear when there is enough activity.'];
  const { home, away, topAction, minute } = stats;
  const gap = home.xg - away.xg;
  const threatSide = gap >= 0 ? 'home' : 'away';
  const otherSide = threatSide === 'home' ? 'away' : 'home';
  const leaderSide = home.goals === away.goals ? null : home.goals > away.goals ? 'home' : 'away';
  const zoneSide = home.zone14 >= away.zone14 ? 'home' : 'away';
  const topTeam = fixture[zoneSide].name;
  const numbers = Math.abs(gap) < 0.05
    ? `The teams are close in chance quality. ${fixture.home.short} has ${home.xg.toFixed(2)} xG and ${fixture.away.short} has ${away.xg.toFixed(2)} xG.`
    : `${fixture[threatSide].name} ${complete ? 'finished' : 'lead'} with ${stats[threatSide].xg.toFixed(2)} xG from ${stats[threatSide].shots} shots, compared with ${stats[otherSide].xg.toFixed(2)} xG for ${fixture[otherSide].short}.`;
  const shape = stats[zoneSide].zone14 > 0
    ? `${topTeam} found Zone 14 with ${stats[zoneSide].zone14} ${stats[zoneSide].zone14 === 1 ? 'pass' : 'passes'}. Their simulated shape in possession is ${fixture[zoneSide].shapes[0]}.`
    : `The replay ${complete ? 'ended' : 'has reached ' + minute + '′'} with zero passes into Zone 14.`;
  let coach = topAction
    ? `Review the ${topAction.minute}′ ${topAction.type} by ${fixture[topAction.side].short} #${topAction.player}, the largest threat gain (+${topAction.xt.toFixed(2)} xT).`
    : 'Watch the next set of passes for a useful pattern in how either team progresses.';
  if (leaderSide && minute >= 60) {
    const trailingSide = leaderSide === 'home' ? 'away' : 'home';
    coach = `${fixture[leaderSide].name} can protect the middle in ${fixture[leaderSide].shapes[1]}. Look for ${fixture[trailingSide].name} to move the ball into the half-spaces.`;
  }
  return [numbers, shape, coach];
}
