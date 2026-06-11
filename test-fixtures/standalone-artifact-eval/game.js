const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const size = 16;
const tile = canvas.width / size;
const player = { x: 1, y: 1, hp: 12 };
let score = 0;
let depth = 1;
let turn = 0;
let enemies = [];
let items = [];

function resetLevel() {
  enemies = [
    { x: 9, y: 3, hp: 2, name: 'VHS Sentry' },
    { x: 5, y: 11, hp: 2, name: 'Arcade Rival' }
  ];
  items = [
    { x: 3, y: 4, name: 'mixtape powerup' },
    { x: 12, y: 10, name: 'floppy disk relic' }
  ];
}

function blocked(x, y) {
  return x < 0 || y < 0 || x >= size || y >= size || (x === 7 && y > 1 && y < 14);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      ctx.fillStyle = blocked(x, y) ? '#2b2740' : '#101826';
      ctx.fillRect(x * tile, y * tile, tile - 1, tile - 1);
    }
  }
  ctx.fillStyle = '#66ff99';
  for (const item of items) ctx.fillText('♫', item.x * tile + 10, item.y * tile + 24);
  ctx.fillStyle = '#ff4d6d';
  for (const enemy of enemies) ctx.fillText('V', enemy.x * tile + 10, enemy.y * tile + 24);
  ctx.fillStyle = '#00f5ff';
  ctx.fillText('@', player.x * tile + 10, player.y * tile + 24);
  document.getElementById('hp').textContent = 'HP ' + player.hp;
  document.getElementById('score').textContent = 'Score ' + score;
  document.getElementById('depth').textContent = 'Depth ' + depth;
  document.getElementById('turn').textContent = 'Turn ' + turn;
}

function move(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!blocked(nx, ny)) {
    player.x = nx;
    player.y = ny;
    turn += 1;
    const found = items.findIndex((item) => item.x === nx && item.y === ny);
    if (found >= 0) {
      score += 50;
      player.hp = Math.min(12, player.hp + 2);
      document.getElementById('log').textContent = 'Collected an 80s relic: ' + items[found].name;
      items.splice(found, 1);
    }
    for (const enemy of enemies) {
      if (Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y) <= 1) player.hp -= 1;
    }
    if (player.x === 15 && player.y === 15) {
      depth += 1;
      score += 100;
      player.x = 1;
      player.y = 1;
      resetLevel();
    }
    if (player.hp <= 0) document.getElementById('log').textContent = 'Game over in the neon mall.';
    render();
  }
}

function restart() {
  player.x = 1;
  player.y = 1;
  player.hp = 12;
  score = 0;
  depth = 1;
  turn = 0;
  resetLevel();
  document.getElementById('log').textContent = 'New run: arcade lights flicker back on.';
  render();
}

document.addEventListener('keydown', (event) => {
  const keys = {
    ArrowLeft: [-1, 0], a: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0],
    ArrowUp: [0, -1], w: [0, -1],
    ArrowDown: [0, 1], s: [0, 1],
  };
  const step = keys[event.key];
  if (step) move(step[0], step[1]);
  if (event.key === 'r') restart();
});
document.getElementById('restart').addEventListener('click', restart);
restart();
