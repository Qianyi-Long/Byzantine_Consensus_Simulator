import { useMemo, useState } from 'react';
import {
  Flag,
  Swords,
} from 'lucide-react';
import {
  ATTACK,
  GENERAL_NAMES,
  MAX_GENERALS,
  RETREAT,
  STRATEGIES,
  VALUE_META,
  aggregateEdges,
  createSimulation,
  formatPath,
} from './byzantine.js';

function getPositions(generalCount) {
  const center = {
    x: 320,
    y: 230,
  };
  const positions = [
    {
      ...center,
      id: 0,
    },
  ];
  const lieutenants = generalCount - 1;

  for (let index = 0; index < lieutenants; index += 1) {
    const angle = -Math.PI / 2 + (index / lieutenants) * Math.PI * 2;
    positions.push({
      id: index + 1,
      x: center.x + Math.cos(angle) * 238,
      y: center.y + Math.sin(angle) * 158,
    });
  }

  return positions;
}

function SegmentedControl({ label, onChange, options, value }) {
  return (
    <div className="control-block">
      <span className="control-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            className={value === option.value ? 'active' : ''}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.icon ? <option.icon size={16} aria-hidden="true" /> : null}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeControl({ label, max, min, onChange, suffix, value }) {
  return (
    <label className="control-block range-control">
      <span className="control-row">
        <span className="control-label">{label}</span>
        <strong>
          {value}
          {suffix}
        </strong>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
  );
}

function NetworkView({
  decisions,
  generalCount,
  messages,
  onSelectGeneral,
  selectedGeneral,
  traitors,
}) {
  const positions = useMemo(() => getPositions(generalCount), [generalCount]);
  const positionMap = useMemo(
    () => new Map(positions.map((position) => [position.id, position])),
    [positions],
  );
  const edges = useMemo(() => aggregateEdges(messages), [messages]);
  const edgeLookup = useMemo(
    () => new Set(edges.map((edge) => `${edge.from}>${edge.to}`)),
    [edges],
  );
  const decisionsById = useMemo(
    () => new Map(decisions.map((decision) => [decision.id, decision])),
    [decisions],
  );

  return (
    <div className="network-stage" aria-label="Byzantine generals network">
      <svg className="network-lines" viewBox="0 0 640 460" aria-hidden="true">
        <defs>
          <marker
            id="arrow"
            markerHeight="9"
            markerWidth="9"
            orient="auto"
            refX="8"
            refY="4.5"
          >
            <path d="M0,0 L9,4.5 L0,9 Z" fill="context-stroke" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const from = positionMap.get(edge.from);
          const to = positionMap.get(edge.to);
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const length = Math.max(Math.hypot(dx, dy), 1);
          const trim = 46;
          const start = {
            x: from.x + (dx / length) * trim,
            y: from.y + (dy / length) * trim,
          };
          const end = {
            x: to.x - (dx / length) * trim,
            y: to.y - (dy / length) * trim,
          };
          const hasReturnEdge = edgeLookup.has(`${edge.to}>${edge.from}`);
          const curve = hasReturnEdge ? 34 : 0;
          const laneOffset = hasReturnEdge ? 10 : 0;
          const normal = {
            x: -dy / length,
            y: dx / length,
          };
          const shiftedStart = {
            x: start.x + normal.x * laneOffset,
            y: start.y + normal.y * laneOffset,
          };
          const shiftedEnd = {
            x: end.x + normal.x * laneOffset,
            y: end.y + normal.y * laneOffset,
          };
          const control = {
            x: (shiftedStart.x + shiftedEnd.x) / 2 + normal.x * curve,
            y: (shiftedStart.y + shiftedEnd.y) / 2 + normal.y * curve,
          };
          const path = curve
            ? `M ${shiftedStart.x} ${shiftedStart.y} Q ${control.x} ${control.y} ${shiftedEnd.x} ${shiftedEnd.y}`
            : `M ${shiftedStart.x} ${shiftedStart.y} L ${shiftedEnd.x} ${shiftedEnd.y}`;
          const label = {
            x: (shiftedStart.x + control.x * 2 + shiftedEnd.x) / 4,
            y: (shiftedStart.y + control.y * 2 + shiftedEnd.y) / 4,
          };

          return (
            <g
              className={`edge ${edge.dominant} ${edge.mixed ? 'mixed' : ''} ${
                edge.senderFaulty ? 'faulty' : ''
              }`}
              key={`${edge.from}-${edge.to}`}
            >
              <path d={path} markerEnd="url(#arrow)" />
              {edge.count > 1 ? (
                <text x={label.x} y={label.y}>
                  {edge.count}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {positions.map((position) => {
        const isTraitor = traitors.has(position.id);
        const decision = decisionsById.get(position.id);
        const selectable = position.id !== 0;

        return (
          <button
            aria-label={`${position.id === 0 ? 'Commander' : 'General'} ${
              GENERAL_NAMES[position.id]
            }, ${isTraitor ? 'Byzantine' : 'loyal'}`}
            aria-pressed={selectable ? selectedGeneral === position.id : undefined}
            className={`general-node ${position.id === 0 ? 'commander' : ''} ${
              isTraitor ? 'traitor' : 'loyal'
            } ${selectable ? '' : 'static'} ${
              selectable && selectedGeneral === position.id ? 'selected' : ''
            }`}
            disabled={!selectable}
            key={position.id}
            onClick={() => {
              if (selectable) {
                onSelectGeneral(position.id);
              }
            }}
            style={{
              left: `${(position.x / 640) * 100}%`,
              top: `${(position.y / 460) * 100}%`,
            }}
            type="button"
          >
            <span className="node-name">{GENERAL_NAMES[position.id]}</span>
            <span className="node-role">
              {position.id === 0 ? 'CMD' : isTraitor ? 'BYZ' : 'LOY'}
            </span>
            {decision ? (
              <span className={`node-vote ${decision.value}`}>
                {VALUE_META[decision.value].initial}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function MessageTable({ messages }) {
  const visibleMessages = messages.slice(0, 72);
  const hiddenCount = Math.max(messages.length - visibleMessages.length, 0);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Path</th>
            <th>From</th>
            <th>To</th>
            <th>Order</th>
          </tr>
        </thead>
        <tbody>
          {visibleMessages.map((message) => (
            <tr key={message.id}>
              <td>{formatPath(message.path)}</td>
              <td>
                {GENERAL_NAMES[message.from]}
                {message.senderFaulty ? <span className="mark">Byz</span> : null}
              </td>
              <td>{GENERAL_NAMES[message.to]}</td>
              <td>
                <span className={`value-chip ${message.value}`}>
                  {VALUE_META[message.value].short}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hiddenCount > 0 ? (
        <p className="table-note">{hiddenCount} more messages in this round.</p>
      ) : null}
    </div>
  );
}

function DecisionPanel({ decision }) {
  if (!decision) {
    return null;
  }

  const voteTotal = Math.max(
    decision.breakdown.attack + decision.breakdown.retreat,
    1,
  );

  return (
    <div className="decision-detail">
      <div className="detail-heading">
        <div>
          <span className="eyebrow">Decision trace</span>
          <h3>General {GENERAL_NAMES[decision.id]}</h3>
        </div>
        <span className={`result-token ${decision.value}`}>
          {VALUE_META[decision.value].label}
        </span>
      </div>

      <div className="vote-meter" aria-label="Majority vote">
        <span
          className="attack-bar"
          style={{
            width: `${(decision.breakdown.attack / voteTotal) * 100}%`,
          }}
        />
        <span
          className="retreat-bar"
          style={{
            width: `${(decision.breakdown.retreat / voteTotal) * 100}%`,
          }}
        />
      </div>
      <p className="vote-caption">
        {decision.breakdown.attack} attack votes, {decision.breakdown.retreat} retreat
        votes{decision.breakdown.tie ? ', retreat chosen on tie' : ''}.
      </p>

      <div className="input-list">
        {decision.inputs.map((input) => (
          <div className="input-row" key={`${input.path.join('-')}-${input.from}`}>
            <span>{formatPath(input.path)}</span>
            <span className={`value-chip ${input.value}`}>
              {VALUE_META[input.value].short}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [commanderOrder, setCommanderOrder] = useState(ATTACK);
  const [generalCount, setGeneralCount] = useState(4);
  const [roundView, setRoundView] = useState(1);
  const [selectedGeneral, setSelectedGeneral] = useState(1);
  const [strategy, setStrategy] = useState('split');
  const [traitorIds, setTraitorIds] = useState(() => new Set([2]));

  const traitors = useMemo(() => traitorIds, [traitorIds]);
  const faultTolerance = traitors.size;

  const simulation = useMemo(
    () =>
      createSimulation({
        commanderOrder,
        faultTolerance,
        generalCount,
        seed: 8,
        strategy,
        traitors,
      }),
    [commanderOrder, faultTolerance, generalCount, strategy, traitors],
  );

  const maxRound = Math.min(faultTolerance + 1, generalCount - 1);
  const selectedRound = Math.min(roundView, maxRound);
  const roundMessages = simulation.messages.filter(
    (message) => message.round === selectedRound,
  );
  const selectedDecision =
    simulation.decisions.find((decision) => decision.id === selectedGeneral) ??
    simulation.decisions[0];

  const consensusSolved =
    simulation.agreement &&
    (simulation.validity !== false) &&
    simulation.boundHolds &&
    simulation.actualFaultsCovered;

  function updateGeneralCount(nextCount) {
    setGeneralCount(nextCount);
    setSelectedGeneral((current) => (current < nextCount ? current : nextCount - 1));
    setTraitorIds((current) => {
      const next = new Set([...current].filter((id) => id < nextCount));
      return next;
    });
  }

  function toggleTraitor(id) {
    setTraitorIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });

    if (id !== 0) {
      setSelectedGeneral(id);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>Byzantine Consensus Simulator</h1>
      </header>

      <div className="workspace">
        <aside className="panel controls-panel">
          <div className="panel-heading">
            <h2>Scenario</h2>
          </div>

          <SegmentedControl
            label="Commander order"
            onChange={setCommanderOrder}
            options={[
              { icon: Swords, label: 'Attack', value: ATTACK },
              { icon: Flag, label: 'Retreat', value: RETREAT },
            ]}
            value={commanderOrder}
          />

          <RangeControl
            label="Generals"
            max={MAX_GENERALS}
            min={4}
            onChange={updateGeneralCount}
            suffix=""
            value={generalCount}
          />

          <SegmentedControl
            label="Byzantine strategy"
            onChange={setStrategy}
            options={Object.entries(STRATEGIES).map(([value, label]) => ({
              label,
              value,
            }))}
            value={strategy}
          />

          <div className="behavior-section">
            <span className="control-label">Commander behavior</span>
            <button
              aria-pressed={traitors.has(0)}
              className={`commander-card ${traitors.has(0) ? 'traitor' : 'loyal'}`}
              onClick={() => toggleTraitor(0)}
              type="button"
            >
              <strong>{GENERAL_NAMES[0]}</strong>
              <span>{traitors.has(0) ? 'Byzantine commander' : 'Loyal commander'}</span>
            </button>
          </div>

          <div className="behavior-section">
            <span className="control-label">Lieutenant behavior</span>
            <div className="roster" aria-label="Toggle Byzantine lieutenants">
              {Array.from({ length: generalCount - 1 }, (_, index) => index + 1).map(
                (id) => (
                  <button
                    aria-pressed={traitors.has(id)}
                    className={traitors.has(id) ? 'traitor' : 'loyal'}
                    key={id}
                    onClick={() => toggleTraitor(id)}
                    type="button"
                  >
                    <strong>{GENERAL_NAMES[id]}</strong>
                    <span>{traitors.has(id) ? 'Byzantine' : 'Loyal'}</span>
                  </button>
                ),
              )}
            </div>
          </div>
        </aside>

        <section className="panel simulator-panel">
          <div className="panel-heading split-heading">
            <div>
              <h2>Message Network</h2>
            </div>
            <span className={`solution-badge ${consensusSolved ? 'good' : 'bad'}`}>
              {consensusSolved ? 'Consensus reached' : 'Consensus at risk'}
            </span>
          </div>

          <NetworkView
            decisions={simulation.decisions}
            generalCount={generalCount}
            messages={roundMessages}
            onSelectGeneral={setSelectedGeneral}
            selectedGeneral={selectedGeneral}
            traitors={traitors}
          />

          <div className="round-tabs" role="tablist" aria-label="Message rounds">
            {Array.from({ length: maxRound }, (_, index) => index + 1).map((round) => (
              <button
                aria-selected={selectedRound === round}
                className={selectedRound === round ? 'active' : ''}
                key={round}
                onClick={() => setRoundView(round)}
                role="tab"
                type="button"
              >
                Round {round}
              </button>
            ))}
          </div>

          <div className="decision-grid">
            {simulation.decisions.map((decision) => (
              <button
                className={`decision-tile ${decision.value} ${
                  selectedDecision?.id === decision.id ? 'selected' : ''
                } ${decision.loyal ? 'loyal' : 'traitor'}`}
                key={decision.id}
                onClick={() => setSelectedGeneral(decision.id)}
                type="button"
              >
                <span>{GENERAL_NAMES[decision.id]}</span>
                <strong>{VALUE_META[decision.value].label}</strong>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel trace-panel">
          <div className="panel-heading">
            <h2>Consensus Trace</h2>
          </div>

          <DecisionPanel decision={selectedDecision} />

          <div className="messages-heading">
            <div>
              <span className="eyebrow">Messages</span>
              <h3>Round {selectedRound}</h3>
            </div>
            <span>{roundMessages.length}</span>
          </div>

          <MessageTable messages={roundMessages} />
        </aside>
      </div>
    </main>
  );
}
