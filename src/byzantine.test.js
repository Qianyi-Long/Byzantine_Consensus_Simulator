import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATTACK,
  RETREAT,
  createSimulation,
  generateMessages,
  majority,
} from './byzantine.js';

function combinations(items, size) {
  if (size === 0) {
    return [[]];
  }

  if (items.length < size) {
    return [];
  }

  const [first, ...rest] = items;
  return [
    ...combinations(rest, size - 1).map((combo) => [first, ...combo]),
    ...combinations(rest, size),
  ];
}

function faultSets(generalCount, maxFaults) {
  const ids = Array.from({ length: generalCount }, (_, id) => id);
  const sets = [];

  for (let size = 0; size <= maxFaults; size += 1) {
    combinations(ids, size).forEach((combo) => {
      sets.push(new Set(combo));
    });
  }

  return sets;
}

test('majority uses retreat as the deterministic tie default', () => {
  assert.equal(majority([ATTACK, RETREAT]).value, RETREAT);
  assert.equal(majority([ATTACK, ATTACK, RETREAT]).value, ATTACK);
});

test('OM(m) generates exactly m + 1 message rounds', () => {
  const { messages } = generateMessages({
    commanderOrder: ATTACK,
    faultTolerance: 2,
    generalCount: 7,
    seed: 8,
    strategy: 'split',
    traitors: new Set([2, 5]),
  });

  const counts = messages.reduce((roundCounts, message) => {
    roundCounts[message.round] = (roundCounts[message.round] ?? 0) + 1;
    return roundCounts;
  }, {});

  assert.deepEqual(counts, {
    1: 6,
    2: 30,
    3: 120,
  });
});

test('loyal commander validity holds when n >= 3m + 1 and faults <= m', () => {
  for (const command of [ATTACK, RETREAT]) {
    for (const traitors of faultSets(7, 2).filter((set) => !set.has(0))) {
      const simulation = createSimulation({
        commanderOrder: command,
        faultTolerance: 2,
        generalCount: 7,
        seed: 13,
        strategy: 'noisy',
        traitors,
      });

      assert.equal(simulation.boundHolds, true);
      assert.equal(simulation.actualFaultsCovered, true);
      assert.equal(simulation.agreement, true);
      assert.equal(simulation.validity, true);
    }
  }
});

test('loyal lieutenants still agree when the commander is Byzantine within the bound', () => {
  for (const traitors of faultSets(7, 2).filter((set) => set.has(0))) {
    const simulation = createSimulation({
      commanderOrder: ATTACK,
      faultTolerance: 2,
      generalCount: 7,
      seed: 21,
      strategy: 'split',
      traitors,
    });

    assert.equal(simulation.boundHolds, true);
    assert.equal(simulation.actualFaultsCovered, true);
    assert.equal(simulation.agreement, true);
    assert.equal(simulation.validity, null);
  }
});
