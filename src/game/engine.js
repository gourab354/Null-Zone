export const FREQUENCIES = {
  RED: '#ef4444',
  GREEN: '#10b981',
  BLUE: '#3b82f6',
};

export const TILE_TYPES = {
  EMPTY: 0,
  WALL: 1,
  SOURCE: 2,
  DESTINATION: 3,
};

export const LEVELS = [
  // Level 1: Easy, straight shot but blocked in middle
  {
    cols: 12,
    rows: 12,
    powerBudget: 2,
    source: { x: 2, y: 5 },
    destination: { x: 9, y: 5 },
    obstacles: [
      { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 5, y: 6 } // Blocks direct line of sight!
    ],
    jammers: []
  },
  // Level 2: Wall blocking the way
  {
    cols: 12,
    rows: 12,
    powerBudget: 3,
    source: { x: 2, y: 5 },
    destination: { x: 9, y: 5 },
    obstacles: [
      { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 },
    ],
    jammers: []
  },
  // Level 3: Introduction to Jammers
  {
    cols: 12,
    rows: 12,
    powerBudget: 3,
    source: { x: 1, y: 5 },
    destination: { x: 10, y: 5 },
    obstacles: [
      { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 },
      { x: 6, y: 5 }, { x: 7, y: 5 },
      { x: 2, y: 8 }, { x: 3, y: 8 },
    ],
    jammers: [
      { x: 5, y: 5, frequency: 'RED', radius: 4 }
    ]
  },
  // Level 4: Complex routing
  {
    cols: 14,
    rows: 14,
    powerBudget: 5,
    source: { x: 1, y: 1 },
    destination: { x: 12, y: 12 },
    obstacles: [
      { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 5 },
      { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 8, y: 7 },
      { x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 },
    ],
    jammers: [
      { x: 3, y: 8, frequency: 'GREEN', radius: 4 },
      { x: 9, y: 5, frequency: 'BLUE', radius: 4 }
    ]
  }
];

// Procedural Level Generator for Infinite Play
export function generateRandomLevel(levelIndex) {
  const size = Math.min(10 + Math.floor(levelIndex / 2), 20); // Scale up to 20x20
  const cols = size;
  const rows = size;
  
  const source = { x: 1, y: Math.floor(Math.random() * (rows - 2)) + 1 };
  const destination = { x: cols - 2, y: Math.floor(Math.random() * (rows - 2)) + 1 };
  
  // Scatter obstacles - much higher density to create tight mazes
  const numObstacles = Math.floor(size * 3.5);
  const obstacles = [];
  for (let i = 0; i < numObstacles; i++) {
    const ox = Math.floor(Math.random() * cols);
    const oy = Math.floor(Math.random() * rows);
    // don't block start/end perfectly
    if (getDistance(source.x, source.y, ox, oy) > 2 && getDistance(destination.x, destination.y, ox, oy) > 2) {
      obstacles.push({ x: ox, y: oy });
    }
  }

  // Ensure there is always a direct obstacle between source and destination to prevent instant wins
  const midX = Math.floor((source.x + destination.x) / 2);
  const midY = Math.floor((source.y + destination.y) / 2);
  obstacles.push({ x: midX, y: midY });

  // Scatter jammers - massive radius and aggressive
  const jammers = [];
  const numJammers = Math.min(Math.floor(levelIndex / 1.5), 12);
  const freqs = Object.keys(FREQUENCIES);
  
  for (let i = 0; i < numJammers; i++) {
    const jx = Math.floor(Math.random() * cols);
    const jy = Math.floor(Math.random() * rows);
    const f = freqs[Math.floor(Math.random() * freqs.length)];
    // Make jammer radius huge (4 to 7 tiles)
    const rad = 4 + Math.floor(Math.random() * 4);
    
    if (getDistance(source.x, source.y, jx, jy) > rad && getDistance(destination.x, destination.y, jx, jy) > rad) {
        jammers.push({ x: jx, y: jy, frequency: f, radius: rad });
    }
  }

  // Brutal power budget
  const mDist = Math.abs(source.x - destination.x) + Math.abs(source.y - destination.y);
  const powerBudget = Math.max(3, Math.floor(mDist / 3.5) + 2);

  return {
    cols,
    rows,
    powerBudget,
    source,
    destination,
    obstacles,
    jammers
  };
}


// Bresenham's line algorithm for line-of-sight
export function getLineOfSight(x0, y0, x1, y1) {
  const points = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = (x0 < x1) ? 1 : -1;
  let sy = (y0 < y1) ? 1 : -1;
  let err = dx - dy;

  while(true) {
    points.push({ x: x0, y: y0 });
    if ((x0 === x1) && (y0 === y1)) break;
    let e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return points;
}

export function checkVisibility(x0, y0, x1, y1, obstaclesSet, jammers = [], freq = null) {
  const points = getLineOfSight(x0, y0, x1, y1);
  for (let p of points) {
    if (obstaclesSet.has(`${p.x},${p.y}`)) {
      return false; // blocked by wall
    }
    // Block line if it passes through a jammer of the same frequency
    if (freq) {
      for (let jam of jammers) {
        if (jam.frequency === freq && getDistance(p.x, p.y, jam.x, jam.y) <= jam.radius) {
          return false; // blocked by jammer
        }
      }
    }
  }
  return true;
}

export function getDistance(x0, y0, x1, y1) {
  return Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
}

export function generateDescriptiveHint(level) {
  let hint = "";
  
  if (level.jammers.length > 0) {
    // Sort jammers by closest to the center of the board
    const midX = level.cols / 2;
    const midY = level.rows / 2;
    const sortedJammers = [...level.jammers].sort((a, b) => getDistance(a.x, a.y, midX, midY) - getDistance(b.x, b.y, midX, midY));
    
    const mainJammer = sortedJammers[0];
    hint += `There is a massive ${mainJammer.frequency} jammer near the center! `;
    
    const safeFreqs = Object.keys(FREQUENCIES).filter(f => f !== mainJammer.frequency);
    hint += `Switch to ${safeFreqs[0]} frequency to safely beam through its radius, or route your ${mainJammer.frequency} towers hugging the edges of the map. `;
  } else {
    hint += `The direct path is heavily walled. Try placing your first tower exactly perpendicular to the transmitter (e.g. at y=2 or y=${level.rows - 3}) to bounce the signal around the central blockade. `;
  }
  
  hint += `Remember, you can switch frequencies at any tower!`;
  
  return hint;
}
