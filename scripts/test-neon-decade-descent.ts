import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

type Listener = () => void;

function makeElement() {
  return {
    textContent: '',
    innerHTML: '',
    dataset: {},
    classList: {
      add() {},
      remove() {},
    },
    addEventListener(_event: string, _listener: Listener) {},
  };
}

const elements = new Map<string, any>();
for (const id of [
  'floor',
  'hp',
  'signal',
  'deck',
  'threat',
  'inventory',
  'log',
  'overlay',
  'overlayTitle',
  'overlayText',
  'overlayButton',
  'seedForm',
  'seedInput',
  'seedReadout',
]) {
  elements.set(id, makeElement());
}

const canvasContext = {
  fillStyle: '',
  font: '',
  textAlign: '',
  textBaseline: '',
  strokeStyle: '',
  clearRect() {},
  fillRect() {},
  strokeRect() {},
  fillText() {},
};

const canvas = {
  width: 768,
  height: 512,
  getContext() {
    return canvasContext;
  },
};

const listeners = new Map<string, (event: any) => void>();
const context = {
  console,
  window: {
    addEventListener(event: string, listener: (event: any) => void) {
      listeners.set(event, listener);
    },
  },
  document: {
    getElementById(id: string) {
      if (id === 'game') return canvas;
      return elements.get(id) || makeElement();
    },
    querySelector(selector: string) {
      if (selector === '[data-wait]') return makeElement();
      return makeElement();
    },
    querySelectorAll(selector: string) {
      if (selector !== '[data-move]') return [];
      return [
        { ...makeElement(), dataset: { move: '0,-1' } },
        { ...makeElement(), dataset: { move: '-1,0' } },
        { ...makeElement(), dataset: { move: '1,0' } },
        { ...makeElement(), dataset: { move: '0,1' } },
      ];
    },
  },
};

const gameDir = resolve(process.argv[2] || process.env.OPENHARNESS_NEON_DECADE_DIR || '../neon-decade-descent');
const gameScript = resolve(gameDir, 'game.js');

vm.createContext(context);
vm.runInContext(readFileSync(gameScript, 'utf8'), context, {
  filename: gameScript,
});

const api = (context.window as any).neonDecadeDescent;
assert.ok(api, 'game should expose smoke-test API');

api.restart(1984);
const seededA = api.getState();
api.restart(1984);
const seededB = api.getState();
assert.equal(seededA.seed, 1984);
assert.deepEqual(seededB.rooms, seededA.rooms, 'same seed should reproduce room layout');
assert.deepEqual(seededB.exit, seededA.exit, 'same seed should reproduce exit placement');

const exitKeys = new Set<string>();
for (let seed = 1980; seed < 1995; seed += 1) {
  api.restart(seed);
  const state = api.getState();
  exitKeys.add(`${state.exit.x},${state.exit.y}`);
}
assert.ok(exitKeys.size >= 4, `seeded exits should vary across runs, got ${exitKeys.size} unique exits`);

const before = api.getState();
listeners.get('keydown')?.({ key: 'd', preventDefault() {} });
listeners.get('keydown')?.({ key: 's', preventDefault() {} });
const after = api.getState();
assert.notDeepEqual(after.player, before.player, 'keyboard movement should update player position');
assert.ok(after.seenTiles >= before.seenTiles, 'movement should preserve or expand explored map memory');
assert.equal(elements.get('deck').textContent.startsWith('Depth '), true, 'HUD should use Depth label');
assert.equal(elements.get('seedInput').value, String(after.seed), 'HUD should expose the active replay seed');
assert.equal(elements.get('seedReadout').textContent, `Seed ${after.seed}`, 'HUD should display the active replay seed');

api.restart(1987);
const enemyState = api.getState();
assert.ok(enemyState.enemies.length > 0, 'game should expose enemy state for regression checks');
const target = enemyState.enemies[0];
api.restart(1987);
const liveState = api.getState();
const dx = Math.sign(target.x - liveState.player.x);
const dy = Math.sign(target.y - liveState.player.y);
assert.equal(typeof api.move, 'function', 'game should expose deterministic move helper');
assert.equal(typeof api.wait, 'function', 'game should expose deterministic wait helper');
assert.ok(Number.isFinite(dx) && Number.isFinite(dy));
assert.ok(elements.get('threat').textContent.startsWith('Threat '), 'HUD should display adjacent threat count');

console.log('Neon Decade Descent regression checks passed.');
