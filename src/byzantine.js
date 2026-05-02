export const ATTACK = 'attack';
export const RETREAT = 'retreat';
export const DEFAULT_VALUE = RETREAT;
export const MAX_GENERALS = 9;
export const GENERAL_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

export const VALUE_META = {
  [ATTACK]: {
    label: 'Attack',
    short: 'ATK',
    initial: 'A',
  },
  [RETREAT]: {
    label: 'Retreat',
    short: 'RET',
    initial: 'R',
  },
};

export const STRATEGIES = {
  split: 'Split',
  flip: 'Flip',
  noisy: 'Chaos',
};

export function opposite(value) {
  return value === ATTACK ? RETREAT : ATTACK;
}

function hashParts(parts) {
  return parts.reduce((hash, part) => {
    const text = String(part);
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) % 9973;
    }
    return hash;
  }, 17);
}

export function messageKey(path, receiver) {
  return `${path.join('.')}>${receiver}`;
}

export function formatPath(path) {
  return path.map((id) => GENERAL_NAMES[id]).join(' -> ');
}

export function majority(values, defaultValue = DEFAULT_VALUE) {
  const attack = values.filter((value) => value === ATTACK).length;
  const retreat = values.length - attack;

  if (attack === retreat) {
    return {
      value: defaultValue,
      attack,
      retreat,
      tie: true,
    };
  }

  return {
    value: attack > retreat ? ATTACK : RETREAT,
    attack,
    retreat,
    tie: false,
  };
}

function byzantineValue({ incoming, mode, path, receiver, sender, seed }) {
  if (mode === 'flip') {
    return opposite(incoming);
  }

  if (mode === 'noisy') {
    return hashParts([seed, sender, receiver, path.join('-')]) % 3 === 0
      ? incoming
      : opposite(incoming);
  }

  return (sender + receiver + path.length + seed) % 2 === 0 ? ATTACK : RETREAT;
}

function sendValue({ incoming, mode, path, receiver, seed, traitors }) {
  const sender = path[path.length - 1];

  if (!traitors.has(sender)) {
    return incoming;
  }

  return byzantineValue({
    incoming,
    mode,
    path,
    receiver,
    seed,
    sender,
  });
}

export function generateMessages({
  commanderOrder,
  faultTolerance,
  generalCount,
  seed,
  strategy,
  traitors,
}) {
  const messages = [];
  const map = new Map();

  function visit(path, remainingDepth, incoming) {
    const sender = path[path.length - 1];

    for (let receiver = 0; receiver < generalCount; receiver += 1) {
      if (path.includes(receiver)) {
        continue;
      }

      const value = sendValue({
        incoming,
        mode: strategy,
        path,
        receiver,
        seed,
        traitors,
      });

      const message = {
        id: messages.length,
        from: sender,
        fullPath: [...path, receiver],
        path: [...path],
        receiverFaulty: traitors.has(receiver),
        round: path.length,
        senderFaulty: traitors.has(sender),
        to: receiver,
        value,
      };

      messages.push(message);
      map.set(messageKey(path, receiver), value);

      if (remainingDepth > 0) {
        visit([...path, receiver], remainingDepth - 1, value);
      }
    }
  }

  visit([0], faultTolerance, commanderOrder);

  return {
    map,
    messages,
  };
}

export function evaluateOm({ generalCount, map, receiver, remainingDepth, path }) {
  const direct = map.get(messageKey(path, receiver)) ?? DEFAULT_VALUE;

  if (remainingDepth === 0) {
    return {
      breakdown: majority([direct]),
      inputs: [
        {
          from: path[path.length - 1],
          path: [...path],
          value: direct,
        },
      ],
      value: direct,
    };
  }

  const inputs = [
    {
      from: path[path.length - 1],
      path: [...path],
      value: direct,
    },
  ];

  for (let relay = 0; relay < generalCount; relay += 1) {
    if (path.includes(relay) || relay === receiver) {
      continue;
    }

    const child = evaluateOm({
      generalCount,
      map,
      path: [...path, relay],
      receiver,
      remainingDepth: remainingDepth - 1,
    });

    inputs.push({
      from: relay,
      path: [...path, relay],
      value: child.value,
    });
  }

  const breakdown = majority(inputs.map((input) => input.value));

  return {
    breakdown,
    inputs,
    value: breakdown.value,
  };
}

export function createSimulation({
  commanderOrder,
  faultTolerance,
  generalCount,
  seed,
  strategy,
  traitors,
}) {
  const { map, messages } = generateMessages({
    commanderOrder,
    faultTolerance,
    generalCount,
    seed,
    strategy,
    traitors,
  });

  const decisions = [];

  for (let receiver = 1; receiver < generalCount; receiver += 1) {
    const result = evaluateOm({
      generalCount,
      map,
      path: [0],
      receiver,
      remainingDepth: faultTolerance,
    });

    decisions.push({
      ...result,
      id: receiver,
      loyal: !traitors.has(receiver),
    });
  }

  const loyalDecisions = decisions.filter((decision) => decision.loyal);
  const loyalValues = new Set(loyalDecisions.map((decision) => decision.value));
  const agreement = loyalValues.size <= 1;
  const validity = traitors.has(0)
    ? null
    : loyalDecisions.every((decision) => decision.value === commanderOrder);
  const boundHolds = generalCount >= 3 * faultTolerance + 1;
  const actualFaultsCovered = traitors.size <= faultTolerance;

  return {
    actualFaultsCovered,
    agreement,
    boundHolds,
    decisions,
    map,
    messages,
    validity,
  };
}

export function aggregateEdges(messages) {
  const edges = new Map();

  messages.forEach((message) => {
    const key = `${message.from}>${message.to}`;
    const current =
      edges.get(key) ??
      {
        attack: 0,
        count: 0,
        from: message.from,
        retreat: 0,
        senderFaulty: false,
        to: message.to,
      };

    current.count += 1;
    current.senderFaulty = current.senderFaulty || message.senderFaulty;
    current[message.value] += 1;
    edges.set(key, current);
  });

  return [...edges.values()].map((edge) => ({
    ...edge,
    dominant: edge.attack >= edge.retreat ? ATTACK : RETREAT,
    mixed: edge.attack > 0 && edge.retreat > 0,
  }));
}
