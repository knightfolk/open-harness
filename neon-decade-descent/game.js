const TILE = 32;
const COLS = 24;
const ROWS = 16;
const FLOORS_TO_WIN = 5;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ui = {
  floor: document.getElementById('floor'),
  hp: document.getElementById('hp'),
  signal: document.getElementById('signal'),
  deck: document.getElementById('deck'),
  inventory: document.getElementById('inventory'),
  log: document.getElementById('log'),
  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlayTitle'),
  overlayText: document.getElementById('overlayText'),
  overlayButton: document.getElementById('overlayButton'),
};

const districts = [
  { name: 'Arcade Mall', floor: '#171322', wall: '#2c1d39', accent: '#ff3da6' },
  { name: 'Mixtape Subway', floor: '#101e25', wall: '#173447', accent: '#38d8ff' },
  { name: 'Cold-War Broadcast Tower', floor: '#181d21', wall: '#33382e', accent: '#f9f1a5' },
  { name: 'Aerobics Studio', floor: '#211727', wall: '#3a2847', accent: '#88f75b' },
  { name: 'Video-Rental Labyrinth', floor: '#15151f', wall: '#2b2e58', accent: '#ff8b3d' },
];

const itemTypes = [
  { id: 'mixtape', name: 'Mixtape Charm', color: '#ff3da6', glyph: '♫', description: '+2 HP' },
  { id: 'token', name: 'Arcade Token', color: '#f9f1a5', glyph: '¢', description: '+4 Signal' },
  { id: 'floppy', name: 'Floppy Disk Map', color: '#38d8ff', glyph: '▣', description: 'Reveal exit' },
  { id: 'shades', name: 'Plastic Sunglasses', color: '#88f75b', glyph: '◒', description: 'Shield next hit' },
  { id: 'keycard', name: 'Neon Keycard', color: '#ff8b3d', glyph: '▤', description: 'Open checkpoint doors' },
  { id: 'cassette', name: 'Portable Cassette', color: '#d8c7ff', glyph: '▭', description: 'Slow enemies' },
];

const enemyTypes = [
  { name: 'Cabinet Ghost', color: '#38d8ff', glyph: 'G', hp: 2, damage: 1 },
  { name: 'Mall Sentry', color: '#ff3da6', glyph: 'M', hp: 3, damage: 1 },
  { name: 'Breakdance Duelist', color: '#f9f1a5', glyph: 'B', hp: 2, damage: 2 },
  { name: 'Synth Phantom', color: '#a78bfa', glyph: 'S', hp: 3, damage: 2 },
  { name: 'Mascot Mimic', color: '#88f75b', glyph: 'K', hp: 4, damage: 2 },
];

const eventTypes = [
  {
    name: 'Market-Panic Terminal',
    color: '#f9f1a5',
    glyph: '$',
    run(game) {
      const swing = game.rng() > 0.45 ? 6 : -3;
      game.player.signal = Math.max(0, game.player.signal + swing);
      game.log(swing > 0 ? 'A ticker surge boosts your Signal.' : 'A ticker crash drains your Signal.');
    },
  },
  {
    name: 'Space-Shuttle Newsroom',
    color: '#38d8ff',
    glyph: '▲',
    run(game) {
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 2);
      game.revealRadius = Math.max(game.revealRadius, 7);
      game.log('Broadcast courage restores 2 HP and widens your view.');
    },
  },
  {
    name: 'Berlin-Wall Checkpoint',
    color: '#ff8b3d',
    glyph: '▥',
    run(game) {
      if (game.player.inventory.keycard) {
        game.player.signal += 5;
        game.log('Your Neon Keycard clears the checkpoint. +5 Signal.');
      } else {
        game.damagePlayer(2, 'Checkpoint static shocks you for 2 HP.');
      }
    },
  },
  {
    name: 'Cable-TV Signal Storm',
    color: '#ff3da6',
    glyph: '≋',
    run(game) {
      game.enemyDelay = 2;
      game.log('Cable snow scrambles enemy movement for two turns.');
    },
  },
  {
    name: 'Mall Directory Kiosk',
    color: '#88f75b',
    glyph: '?',
    run(game) {
      game.exit.revealed = true;
      game.player.signal += 2;
      game.log('The directory marks the Exit Gate. +2 Signal.');
    },
  },
];

function mulberry32(seed) {
  return function next() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function choice(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function keyAt(x, y) {
  return `${x},${y}`;
}

class Game {
  constructor() {
    this.seed = Date.now() % 1000000;
    this.rng = mulberry32(this.seed);
    this.player = {
      x: 1,
      y: 1,
      hp: 10,
      maxHp: 10,
      signal: 0,
      deck: 0,
      inventory: {},
      shield: 0,
      slow: 0,
    };
    this.floor = 0;
    this.revealRadius = 5;
    this.enemyDelay = 0;
    this.messages = [];
    this.over = false;
    this.win = false;
    this.nextFloor();
  }

  nextFloor() {
    this.floor += 1;
    this.district = districts[(this.floor - 1) % districts.length];
    this.map = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => '#'));
    this.items = [];
    this.enemies = [];
    this.events = [];
    this.exit = { x: COLS - 2, y: ROWS - 2, revealed: false };
    this.generateMap();
    this.placeContents();
    this.player.x = 1;
    this.player.y = 1;
    this.player.deck = this.floor - 1;
    this.log(`Floor ${this.floor}: ${this.district.name}. Find the Exit Gate.`);
    if (this.floor === 1) this.log('Every move advances the decade. Bump enemies to attack.');
  }

  generateMap() {
    const rooms = [{ x: 1, y: 1, w: 5 + Math.floor(this.rng() * 3), h: 4 + Math.floor(this.rng() * 2) }];
    const targetRooms = 5 + Math.floor(this.rng() * 3);

    for (let attempt = 0; rooms.length < targetRooms && attempt < 180; attempt += 1) {
      const room = {
        w: 4 + Math.floor(this.rng() * 5),
        h: 3 + Math.floor(this.rng() * 4),
        x: 1 + Math.floor(this.rng() * (COLS - 10)),
        y: 1 + Math.floor(this.rng() * (ROWS - 8)),
      };
      room.x = Math.min(room.x, COLS - room.w - 2);
      room.y = Math.min(room.y, ROWS - room.h - 2);
      const overlaps = rooms.some((other) =>
        room.x <= other.x + other.w + 1
        && room.x + room.w + 1 >= other.x
        && room.y <= other.y + other.h + 1
        && room.y + room.h + 1 >= other.y
      );
      if (!overlaps) rooms.push(room);
    }

    while (rooms.length < 5) {
      const fallback = [
        { x: 10, y: 2, w: 7, h: 4 },
        { x: 16, y: 9, w: 6, h: 5 },
        { x: 3, y: 10, w: 8, h: 4 },
        { x: 12, y: 6, w: 7, h: 5 },
      ][rooms.length - 1];
      rooms.push(fallback);
    }
    this.rooms = rooms.map((room) => ({ ...room }));

    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) this.map[y][x] = '.';
      }
    }

    const centers = rooms.map((room) => ({
      x: Math.floor(room.x + room.w / 2),
      y: Math.floor(room.y + room.h / 2),
    }));
    for (let i = 0; i < centers.length - 1; i += 1) {
      this.carveCorridor(centers[i], centers[i + 1]);
    }

    this.exit.x = centers[centers.length - 1].x;
    this.exit.y = centers[centers.length - 1].y;
  }

  carveCorridor(a, b) {
    let x = a.x;
    let y = a.y;
    while (x !== b.x) {
      this.map[y][x] = '.';
      x += Math.sign(b.x - x);
    }
    while (y !== b.y) {
      this.map[y][x] = '.';
      y += Math.sign(b.y - y);
    }
    this.map[y][x] = '.';
  }

  randomOpenCell(avoidStart = true) {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const x = 1 + Math.floor(this.rng() * (COLS - 2));
      const y = 1 + Math.floor(this.rng() * (ROWS - 2));
      const nearStart = Math.abs(x - 1) + Math.abs(y - 1) < 5;
      if (this.map[y][x] === '.' && (!avoidStart || !nearStart) && !this.occupied(x, y)) return { x, y };
    }
    return { x: 2, y: 2 };
  }

  occupied(x, y) {
    if (this.player.x === x && this.player.y === y) return true;
    if (this.items.some((item) => item.x === x && item.y === y)) return true;
    if (this.events.some((event) => event.x === x && event.y === y)) return true;
    if (this.enemies.some((enemy) => enemy.x === x && enemy.y === y && enemy.hp > 0)) return true;
    return this.exit.x === x && this.exit.y === y;
  }

  placeContents() {
    const itemCount = 5 + this.floor;
    const enemyCount = 4 + this.floor;
    const eventCount = 2 + Math.floor(this.floor / 2);

    for (let i = 0; i < itemCount; i += 1) {
      const spot = this.randomOpenCell();
      this.items.push({ ...choice(this.rng, itemTypes), ...spot });
    }

    for (let i = 0; i < enemyCount; i += 1) {
      const type = choice(this.rng, enemyTypes);
      const spot = this.randomOpenCell();
      this.enemies.push({ ...type, ...spot, hp: type.hp + Math.floor(this.floor / 2) });
    }

    for (let i = 0; i < eventCount; i += 1) {
      const event = choice(this.rng, eventTypes);
      const spot = this.randomOpenCell();
      this.events.push({ ...event, ...spot, used: false });
    }
  }

  log(message) {
    this.messages.unshift(message);
    this.messages = this.messages.slice(0, 8);
  }

  tryMove(dx, dy) {
    if (this.over) return;
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    if (!this.inBounds(nx, ny) || this.map[ny][nx] === '#') {
      this.log('A wall of VHS static blocks the way.');
      render();
      return;
    }

    const enemy = this.enemies.find((unit) => unit.x === nx && unit.y === ny && unit.hp > 0);
    if (enemy) {
      enemy.hp -= 2;
      this.log(`You strike the ${enemy.name}.`);
      if (enemy.hp <= 0) {
        this.player.signal += 3;
        this.log(`${enemy.name} dissolves into neon dust. +3 Signal.`);
      } else {
        this.damagePlayer(enemy.damage, `${enemy.name} counters.`);
      }
      this.afterTurn();
      return;
    }

    this.player.x = nx;
    this.player.y = ny;
    this.pickupItem();
    this.triggerEvent();
    this.checkExit();
    this.afterTurn();
  }

  waitTurn() {
    if (this.over) return;
    this.log('You wait under humming fluorescent lights.');
    this.afterTurn();
  }

  pickupItem() {
    const index = this.items.findIndex((item) => item.x === this.player.x && item.y === this.player.y);
    if (index < 0) return;
    const item = this.items.splice(index, 1)[0];
    this.log(`Found ${item.name}: ${item.description}.`);
    if (item.id === 'mixtape') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
    if (item.id === 'token') this.player.signal += 4;
    if (item.id === 'floppy') this.exit.revealed = true;
    if (item.id === 'shades') this.player.shield += 1;
    if (item.id === 'cassette') this.player.slow += 4;
    this.player.inventory[item.id] = (this.player.inventory[item.id] || 0) + 1;
  }

  triggerEvent() {
    const event = this.events.find((candidate) =>
      candidate.x === this.player.x && candidate.y === this.player.y && !candidate.used
    );
    if (!event) return;
    event.used = true;
    this.log(`Event: ${event.name}.`);
    event.run(this);
  }

  checkExit() {
    if (this.player.x !== this.exit.x || this.player.y !== this.exit.y) return;
    if (this.floor >= FLOORS_TO_WIN) {
      this.win = true;
      this.over = true;
      this.log('You escape the neon time loop.');
      showOverlay('Signal Restored', 'You cleared five floors and turned the decade into a playable legend.');
      return;
    }
    this.player.signal += 8;
    this.nextFloor();
  }

  afterTurn() {
    if (this.over) {
      render();
      return;
    }
    if (this.enemyDelay > 0) this.enemyDelay -= 1;
    else this.moveEnemies();
    if (this.player.slow > 0) this.player.slow -= 1;
    render();
  }

  moveEnemies() {
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      if (this.player.slow > 0 && this.rng() < 0.45) continue;

      const distance = Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y);
      if (distance === 1) {
        this.damagePlayer(enemy.damage, `${enemy.name} hits you.`);
        continue;
      }
      if (distance > 8) continue;

      const options = [
        { x: enemy.x + Math.sign(this.player.x - enemy.x), y: enemy.y },
        { x: enemy.x, y: enemy.y + Math.sign(this.player.y - enemy.y) },
      ].filter((spot) => this.canEnemyMove(spot.x, spot.y));

      if (options.length > 0) {
        const next = choice(this.rng, options);
        enemy.x = next.x;
        enemy.y = next.y;
      }
    }
  }

  canEnemyMove(x, y) {
    if (!this.inBounds(x, y) || this.map[y][x] === '#') return false;
    if (this.player.x === x && this.player.y === y) return false;
    if (this.enemies.some((enemy) => enemy.x === x && enemy.y === y && enemy.hp > 0)) return false;
    return !(this.exit.x === x && this.exit.y === y);
  }

  damagePlayer(amount, message) {
    if (this.player.shield > 0) {
      this.player.shield -= 1;
      this.log(`${message} Plastic Sunglasses absorb the hit.`);
      return;
    }
    this.player.hp -= amount;
    this.log(`${message} -${amount} HP.`);
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.over = true;
      showOverlay('Run Lost', 'The neon loop claims another mixtape. Restart and chase a cleaner seed.');
    }
  }

  inBounds(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  }
}

let game = new Game();

function drawRect(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
}

function drawGlyph(x, y, glyph, color, size = 18) {
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px "IBM Plex Mono", Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x * TILE + TILE / 2, y * TILE + TILE / 2 + 1);
}

function isVisible(x, y) {
  const distance = Math.abs(x - game.player.x) + Math.abs(y - game.player.y);
  if (game.exit.revealed && x === game.exit.x && y === game.exit.y) return true;
  return distance <= game.revealRadius;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#07090e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!isVisible(x, y)) {
        drawRect(x, y, '#05060a');
        continue;
      }
      drawRect(x, y, game.map[y][x] === '#' ? game.district.wall : game.district.floor);
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  if (isVisible(game.exit.x, game.exit.y)) {
    drawRect(game.exit.x, game.exit.y, '#1b2330');
    drawGlyph(game.exit.x, game.exit.y, 'EXIT', game.district.accent, 11);
  }

  for (const event of game.events) {
    if (!event.used && isVisible(event.x, event.y)) drawGlyph(event.x, event.y, event.glyph, event.color, 20);
  }

  for (const item of game.items) {
    if (isVisible(item.x, item.y)) drawGlyph(item.x, item.y, item.glyph, item.color, 20);
  }

  for (const enemy of game.enemies) {
    if (enemy.hp > 0 && isVisible(enemy.x, enemy.y)) drawGlyph(enemy.x, enemy.y, enemy.glyph, enemy.color, 20);
  }

  drawRect(game.player.x, game.player.y, '#f7fbff');
  drawGlyph(game.player.x, game.player.y, '@', '#111827', 20);

  updateHud();
}

function updateHud() {
  ui.floor.textContent = `Floor ${game.floor}`;
  ui.hp.textContent = `HP ${game.player.hp}/${game.player.maxHp}`;
  ui.signal.textContent = `Signal ${game.player.signal}`;
  ui.deck.textContent = `Deck ${game.player.deck}`;

  const inventoryEntries = Object.entries(game.player.inventory)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => {
      const item = itemTypes.find((candidate) => candidate.id === id);
      return `<li>${item ? item.name : id} × ${count}</li>`;
    });
  if (game.player.shield > 0) inventoryEntries.push(`<li>Shielded hits × ${game.player.shield}</li>`);
  if (game.player.slow > 0) inventoryEntries.push(`<li>Cassette slow turns × ${game.player.slow}</li>`);
  ui.inventory.innerHTML = inventoryEntries.length > 0 ? inventoryEntries.join('') : '<li>Empty pockets, loud sneakers.</li>';
  ui.log.innerHTML = game.messages.map((message) => `<li>${message}</li>`).join('');
}

function showOverlay(title, text) {
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = text;
  ui.overlay.classList.remove('hidden');
}

function restart() {
  ui.overlay.classList.add('hidden');
  game = new Game();
  render();
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const moves = {
    arrowup: [0, -1],
    w: [0, -1],
    arrowdown: [0, 1],
    s: [0, 1],
    arrowleft: [-1, 0],
    a: [-1, 0],
    arrowright: [1, 0],
    d: [1, 0],
  };

  if (key === 'r') {
    restart();
    return;
  }
  if (key === '.') {
    event.preventDefault();
    game.waitTurn();
    return;
  }
  if (moves[key]) {
    event.preventDefault();
    game.tryMove(moves[key][0], moves[key][1]);
  }
});

for (const button of document.querySelectorAll('[data-move]')) {
  button.addEventListener('click', () => {
    const [dx, dy] = button.dataset.move.split(',').map(Number);
    game.tryMove(dx, dy);
  });
}

document.querySelector('[data-wait]').addEventListener('click', () => game.waitTurn());
ui.overlayButton.addEventListener('click', restart);
window.neonDecadeDescent = {
  getState() {
    return {
      floor: game.floor,
      district: game.district.name,
      player: {
        x: game.player.x,
        y: game.player.y,
        hp: game.player.hp,
        signal: game.player.signal,
      },
      enemiesRemaining: game.enemies.filter((enemy) => enemy.hp > 0).length,
      itemsRemaining: game.items.length,
      eventsRemaining: game.events.filter((event) => !event.used).length,
      rooms: game.rooms,
      over: game.over,
      win: game.win,
    };
  },
};
render();
