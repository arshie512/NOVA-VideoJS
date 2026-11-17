const WIDTH = 1280;
const HEIGHT = 720;
const OUTPUT_SCALE = 3;
const OUTPUT_WIDTH = WIDTH * OUTPUT_SCALE;
const OUTPUT_HEIGHT = HEIGHT * OUTPUT_SCALE;
const FPS = 30;
const DURATION = 5;
const FRAME_COUNT = DURATION * FPS;

const ASSETS = {
  forest: '/scenes/forest-encounter-background.png',
  tyrannosaurus: '/scenes/tyrannosaurus-run-skin-v2.png',
  triceratops: '/scenes/triceratops-run-skin-v2.png',
  triceratopsMask: '/scenes/triceratops-run-clean.png',
  triceratopsFallen: '/scenes/triceratops-fallen-skin-v2.png',
  triceratopsFallenMask: '/scenes/triceratops-fallen.png',
};

const canvas = document.querySelector('#canvas');
canvas.width = OUTPUT_WIDTH;
canvas.height = OUTPUT_HEIGHT;
const outputContext = canvas.getContext('2d', { alpha: false });
if (!outputContext) throw new Error('This browser does not support the 2160p canvas output.');
const animationCanvas = document.createElement('canvas');
animationCanvas.width = WIDTH;
animationCanvas.height = HEIGHT;
const context = animationCanvas.getContext('2d', { alpha: false });
const button = document.querySelector('#render');
const progress = document.querySelector('#progress');
const status = document.querySelector('#status');
const preview = document.querySelector('#preview');

const random = (seed) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

function removeConnectedPaleBackdrop(image, columns = 1) {
  const surface = document.createElement('canvas');
  surface.width = image.width;
  surface.height = image.height;
  const surfaceContext = surface.getContext('2d', { willReadFrequently: true });
  surfaceContext.drawImage(image, 0, 0);

  const pixels = surfaceContext.getImageData(0, 0, surface.width, surface.height);
  const rgba = pixels.data;
  const pixelCount = surface.width * surface.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const paleAt = (pixel) => {
    const offset = pixel * 4;
    const red = rgba[offset];
    const green = rgba[offset + 1];
    const blue = rgba[offset + 2];
    const alpha = rgba[offset + 3];
    return alpha > 12 && red > 158 && green > 158 && blue > 158
      && Math.max(red, green, blue) - Math.min(red, green, blue) < 48;
  };

  const add = (pixel) => {
    if (!visited[pixel] && paleAt(pixel)) {
      visited[pixel] = 1;
      queue[tail] = pixel;
      tail += 1;
    }
  };

  const width = surface.width;
  const height = surface.height;
  for (let x = 0; x < width; x += 1) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    add(y * width);
    add(y * width + width - 1);
  }
  for (let column = 0; column < columns; column += 1) {
    const left = Math.floor(column * width / columns);
    const right = Math.min(width - 1, Math.ceil((column + 1) * width / columns) - 1);
    for (let y = 0; y < height; y += 1) {
      add(y * width + left);
      add(y * width + right);
    }
  }

  // These sprite sheets include transparent bands around a pale, softly shaded backdrop.
  // Seed pale pixels beside every transparent pixel so that backdrop is removed too.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (rgba[pixel * 4 + 3] > 12) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) add(ny * width + nx);
        }
      }
    }
  }

  while (head < tail) {
    const pixel = queue[head];
    head += 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) add(pixel - 1);
    if (x + 1 < width) add(pixel + 1);
    if (y > 0) add(pixel - width);
    if (y + 1 < height) add(pixel + width);
    if (x > 0 && y > 0) add(pixel - width - 1);
    if (x + 1 < width && y > 0) add(pixel - width + 1);
    if (x > 0 && y + 1 < height) add(pixel + width - 1);
    if (x + 1 < width && y + 1 < height) add(pixel + width + 1);
  }

  for (let index = 0; index < tail; index += 1) rgba[queue[index] * 4 + 3] = 0;
  surfaceContext.putImageData(pixels, 0, 0);
  return surface;
}

function prepareSheet(image, frameCount, removePaleBackdrop = false) {
  let surface;
  if (removePaleBackdrop) {
    surface = removeConnectedPaleBackdrop(image, frameCount);
  } else {
    surface = document.createElement('canvas');
    surface.width = image.width;
    surface.height = image.height;
    surface.getContext('2d').drawImage(image, 0, 0);
  }
  const frameWidth = surface.width / frameCount;
  const alphaPixels = surface.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, surface.width, surface.height).data;
  let top = surface.height;
  let bottom = 0;

  for (let y = 0; y < surface.height; y += 1) {
    let rowVisible = false;
    const start = y * surface.width * 4 + 3;
    for (let x = 0; x < surface.width; x += 1) {
      if (alphaPixels[start + x * 4] > 48) {
        rowVisible = true;
        break;
      }
    }
    if (rowVisible) {
      top = Math.min(top, y);
      bottom = y + 1;
    }
  }

  if (top === surface.height || bottom <= top) {
    throw new Error('A dinosaur animation sheet has no visible frames.');
  }

  return { image: surface, frameCount, frameWidth, top, height: bottom - top };
}

function applyAlphaMask(image, maskImage) {
  const surface = document.createElement('canvas');
  surface.width = image.width;
  surface.height = image.height;
  const surfaceContext = surface.getContext('2d', { willReadFrequently: true });
  surfaceContext.drawImage(image, 0, 0);
  const imagePixels = surfaceContext.getImageData(0, 0, surface.width, surface.height);

  const maskSurface = document.createElement('canvas');
  maskSurface.width = surface.width;
  maskSurface.height = surface.height;
  const maskContext = maskSurface.getContext('2d', { willReadFrequently: true });
  maskContext.drawImage(maskImage, 0, 0, surface.width, surface.height);
  const maskPixels = maskContext.getImageData(0, 0, surface.width, surface.height).data;

  for (let offset = 3; offset < imagePixels.data.length; offset += 4) {
    imagePixels.data[offset] = maskPixels[offset];
  }
  surfaceContext.putImageData(imagePixels, 0, 0);
  return surface;
}

function prepareCutout(image) {
  const surface = document.createElement('canvas');
  surface.width = image.width;
  surface.height = image.height;
  const surfaceContext = surface.getContext('2d', { willReadFrequently: true });
  surfaceContext.drawImage(image, 0, 0);
  const { data } = surfaceContext.getImageData(0, 0, surface.width, surface.height);
  let left = surface.width;
  let right = 0;
  let top = surface.height;
  let bottom = 0;

  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      if (data[(y * surface.width + x) * 4 + 3] <= 48) continue;
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
    }
  }

  if (left === surface.width || right <= left || bottom <= top) {
    throw new Error('The fallen Triceratops cutout is empty.');
  }
  return { image: surface, frameCount: 1, frameWidth: right - left, sourceX: left, top, height: bottom - top };
}

function drawEncounterBackground(image, localTime) {
  const scale = Math.max(WIDTH / image.width, HEIGHT / image.height) * (1.018 + Math.min(0.014, localTime * 0.002));
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const driftX = Math.sin(localTime * 0.16) * 4 + localTime * 0.34;
  const driftY = Math.cos(localTime * 0.14) * 1.5;
  context.drawImage(image, (WIDTH - drawWidth) / 2 + driftX, (HEIGHT - drawHeight) / 2 + driftY, drawWidth, drawHeight);
}

const leaves = (() => {
  const next = random(71240);
  return Array.from({ length: 98 }, () => ({
    x: next() * WIDTH,
    y: next() * HEIGHT,
    depth: 0.25 + next() * 0.75,
    size: 2.5 + next() * 8,
    phase: next() * Math.PI * 2,
    speed: 13 + next() * 49,
    color: ['#8b9b50', '#b78a4a', '#56663c', '#9c7444'][Math.floor(next() * 4)],
  }));
})();

function drawLeaf(x, y, size, rotation, color, alpha) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(-size, 0);
  context.quadraticCurveTo(-size * 0.25, -size * 0.8, size, -size * 0.08);
  context.quadraticCurveTo(size * 0.35, size * 0.62, -size, 0);
  context.fill();
  context.strokeStyle = `rgba(230,222,181,${alpha * 0.52})`;
  context.lineWidth = 0.65;
  context.beginPath();
  context.moveTo(-size * 0.72, 0);
  context.lineTo(size * 0.65, -size * 0.06);
  context.stroke();
  context.restore();
}

function drawLeaves(time, foreground = false) {
  context.save();
  for (const leaf of leaves) {
    if ((leaf.depth > 0.72) !== foreground) continue;
    const x = (leaf.x + time * leaf.speed * (foreground ? 1.25 : 0.6) + WIDTH) % (WIDTH + leaf.size * 2) - leaf.size;
    const y = (leaf.y + Math.sin(time * 1.2 + leaf.phase) * (10 + leaf.depth * 16) + time * (7 + leaf.depth * 12)) % HEIGHT;
    drawLeaf(x, y, leaf.size * (foreground ? 1.3 : 0.8), time * (0.45 + leaf.depth) + leaf.phase, leaf.color, foreground ? 0.62 : 0.46);
  }
  context.restore();
}

function drawVolcanicAsh(time) {
  // A soft ash billow grows with the first bite, blending into the plume in the distant plate.
  const ignition = smoothstep(1.18, 1.48, time);
  const settle = 1 - smoothstep(2.25, 3.15, time) * 0.22;
  const strength = ignition * settle;
  if (strength < 0.015) return;

  context.save();
  context.globalCompositeOperation = 'source-over';
  context.filter = 'blur(7px)';
  for (let index = 0; index < 8; index += 1) {
    const phase = time * (0.22 + index * 0.012) + index * 1.91;
    const lift = (time * (5.8 + index * 0.26) + index * 10.5) % 48;
    const x = 690 + Math.sin(phase) * (5 + index * 1.5);
    const y = 264 - lift;
    const radius = 5 + index * 1.05 + lift * 0.06;
    const alpha = strength * (0.026 + (index % 3) * 0.005) * (1 - lift / 72);
    context.fillStyle = `rgba(79,76,68,${Math.max(0, alpha)})`;
    context.beginPath();
    context.ellipse(x, y, radius * 1.7, radius, phase * 0.15, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawDust(time, x, y, scale = 1) {
  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 30; index += 1) {
    const phase = time * (1.4 + (index % 6) * 0.18) + index * 1.71;
    const rise = ((time * (24 + index % 7 * 9) + index * 23) % 180) * scale;
    const px = x + Math.sin(phase) * (16 + index % 5 * 9) * scale;
    const py = y - rise;
    const alpha = Math.max(0, 0.15 - rise / (145 * scale));
    context.beginPath();
    context.fillStyle = `rgba(183,157,115,${alpha})`;
    context.ellipse(px, py, (2 + index % 4) * scale, (1.2 + index % 3) * scale, phase, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawSplash(time, x, y, active) {
  if (!active) return;
  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 42; index += 1) {
    const phase = index * 2.399 + time * (2 + index % 5 * 0.2);
    const rise = (time * (35 + index % 9 * 9) + index * 13) % 122;
    const px = x + Math.cos(phase) * (22 + index % 6 * 13) + Math.sin(time + index) * 6;
    const py = y - rise;
    const alpha = Math.max(0, 0.48 - rise / 270);
    context.beginPath();
    context.fillStyle = `rgba(204,221,206,${alpha})`;
    context.ellipse(px, py, 1 + (index % 3) * 0.55, 1.7 + (index % 4), phase, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawSprite(sprite, frameIndex, x, groundY, targetHeight, options = {}) {
  const { flip = false, rotation = 0, alpha = 1 } = options;
  const sourceWidth = sprite.frameWidth;
  const sourceHeight = sprite.height;
  const drawWidth = (sourceWidth / sourceHeight) * targetHeight;
  const sourceX = (sprite.sourceX ?? 0) + Math.min(sprite.frameCount - 1, Math.max(0, frameIndex)) * sourceWidth;
  const y = groundY - targetHeight;

  context.save();
  context.globalAlpha = alpha;
  if (flip) {
    context.translate(x * 2 + drawWidth, 0);
    context.scale(-1, 1);
  }
  if (rotation) {
    context.translate(x + drawWidth * 0.5, groundY - targetHeight * 0.52);
    context.rotate(rotation);
    context.translate(-(x + drawWidth * 0.5), -(groundY - targetHeight * 0.52));
  }
  context.drawImage(
    sprite.image,
    sourceX,
    sprite.top,
    sourceWidth,
    sourceHeight,
    x,
    y,
    drawWidth,
    targetHeight,
  );
  context.restore();
  return { width: drawWidth, height: targetHeight, y };
}

function drawGroundShadow(x, groundY, width, alpha = 0.28) {
  context.save();
  context.globalCompositeOperation = 'multiply';
  context.fillStyle = `rgba(8,12,8,${alpha})`;
  context.beginPath();
  context.ellipse(x + width * 0.5, groundY + 1, width * 0.48, 12, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBloodPool(x, y, intensity = 1) {
  const amount = clamp01(intensity);
  if (amount <= 0) return;
  context.save();
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 0.92 * amount;
  const pool = context.createRadialGradient(x, y, 1, x, y, 50 * amount + 4);
  pool.addColorStop(0, 'rgba(132,20,30,0.96)');
  pool.addColorStop(0.52, 'rgba(93,14,23,0.84)');
  pool.addColorStop(1, 'rgba(50,10,15,0)');
  context.fillStyle = pool;
  context.beginPath();
  context.ellipse(x, y, 4 + amount * 50, 2 + amount * 10, -0.035, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 0.58 * amount;
  context.fillStyle = '#811a25';
  context.beginPath();
  context.ellipse(x - amount * 13, y - 1.2, 2 + amount * 27, 1 + amount * 4.2, 0.035, 0, Math.PI * 2);
  context.ellipse(x + amount * 20, y + 1.1, 2 + amount * 15, 1 + amount * 3.2, -0.02, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawFootfalls(time, x, groundY, width, cadence, phase, strength = 1) {
  const cycle = ((time * cadence + phase) % 1 + 1) % 1;
  const hitDistance = Math.min(cycle, Math.abs(cycle - 0.5), 1 - cycle);
  const pulse = Math.max(0, 1 - hitDistance / 0.12);
  if (pulse < 0.02) return;
  context.save();
  const footX = x + width * (cycle > 0.5 ? 0.31 : 0.67);
  context.globalCompositeOperation = 'multiply';
  context.globalAlpha = pulse * 0.25 * strength;
  context.fillStyle = 'rgba(87,75,57,.72)';
  context.beginPath();
  context.ellipse(footX, groundY - 1, 17 + (1 - pulse) * 13, 3.2, 0, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = pulse * 0.28 * strength;
  for (let particle = 0; particle < 8; particle += 1) {
    const angle = particle * 2.4 + phase * 7;
    const rise = (1 - pulse) * (8 + particle % 3 * 3);
    const px = footX + Math.sin(angle) * (6 + particle % 4 * 3);
    const py = groundY - 3 - Math.cos(angle) * 3 - rise;
    context.fillStyle = particle % 2 ? 'rgba(171,151,119,.72)' : 'rgba(125,116,93,.7)';
    context.beginPath();
    context.ellipse(px, py, 1.5 + particle % 2, 1 + particle % 3 * 0.35, angle * 0.2, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smoothstep = (start, end, value) => {
  const amount = clamp01((value - start) / (end - start));
  return amount * amount * (3 - 2 * amount);
};

const fightBeats = [
  { start: 0, end: 1, action: 'chase' },
  { start: 1, end: 1.28, action: 'stand-off' },
  { start: 1.28, end: 2.08, action: 'rex-bite' },
  { start: 2.08, end: 2.72, action: 'horn-check' },
  { start: 2.72, end: 3.56, action: 'rex-bite' },
  { start: 3.56, end: 4.18, action: 'drive' },
  { start: 4.18, end: 4.86, action: 'trike-fall' },
  { start: 4.86, end: 5, action: 'trike-aftermath' },
];

function currentFightBeat(time) {
  return fightBeats.find((beat) => time >= beat.start && time < beat.end) ?? fightBeats.at(-1);
}

function drawFightPair(trex, trike, trikeFallen, time, beat) {
  const localTime = time - beat.start;
  const beatDuration = beat.end - beat.start;
  const beatProgress = clamp01(localTime / beatDuration);
  const contact = beat.action === 'rex-bite' || beat.action === 'horn-check';
  const cameraIndex = 0;
  const cameraMode = cameraIndex % 4;
  const closeAngle = cameraMode === 1 || cameraMode === 2;
  const baseTrexHeight = cameraMode === 2 ? 370 : closeAngle ? 398 : 334;
  const baseTrikeHeight = cameraMode === 2 ? 292 : closeAngle ? 318 : 260;
  let trexX = closeAngle ? 165 : 206;
  let trikeX = closeAngle ? 723 : 766;
  let trexLean = 0;
  let trikeBrace = 0;
  let trexGroundOffset = 0;
  let trikeGroundOffset = 0;
  let trexScale = 1;
  let trikeScale = 1;

  if (beat.action === 'chase') {
    const pursuit = smoothstep(0, beatDuration, localTime);
    trexX = 86 + 120 * pursuit;
    trikeX = 680 + 35 * pursuit;
    trexLean = -0.02 - Math.sin(time * 9) * 0.006;
    trexGroundOffset = Math.sin(time * 18) * 3;
    trikeGroundOffset = Math.sin(time * 17 + 0.6) * 2.5;
  } else if (beat.action === 'rex-bite') {
    const secondBite = beat.start > 2 ? 1 : 0;
    const coil = 1 - smoothstep(0, 0.2, localTime);
    const lunge = smoothstep(0.1, 0.3, localTime) * (1 - smoothstep(0.55, beatDuration, localTime));
    const tug = Math.sin(Math.max(0, localTime - 0.28) * (secondBite ? 31 : 25)) * smoothstep(0.25, 0.39, localTime) * (1 - smoothstep(0.58, beatDuration, localTime));
    const recoil = smoothstep(0.62, beatDuration, localTime);
    trexX += -34 * coil + 138 * lunge + 18 * tug - 22 * recoil;
    trikeX += 12 * coil - 52 * lunge - 15 * tug + 16 * recoil;
    trexLean = 0.03 * coil - 0.075 * lunge - 0.02 * tug + 0.032 * recoil;
    trikeBrace = 0.018 * coil + 0.034 * lunge + 0.012 * tug - 0.015 * recoil;
    trexGroundOffset = -7 * coil + 6 * lunge + 3 * tug;
    trikeGroundOffset = 3 * coil + 8 * lunge + 2 * tug;
  } else if (beat.action === 'stand-off') {
    const settle = smoothstep(0, Math.min(0.3, beatDuration), localTime);
    const breath = Math.sin(time * 3.2);
    trexLean = breath * 0.003 * settle;
    trikeBrace = Math.sin(time * 2.8 + 0.7) * 0.0025 * settle;
    trexGroundOffset = Math.sin(time * 3.2) * 0.7;
    trikeGroundOffset = Math.sin(time * 2.8 + 0.7) * 0.6;
  } else if (beat.action === 'horn-check') {
    const brace = 1 - smoothstep(0, 0.26, localTime);
    const drive = smoothstep(0.18, 0.43, localTime) * (1 - smoothstep(0.62, beatDuration, localTime));
    const recoil = smoothstep(0.48, beatDuration, localTime);
    trikeX += -132 * drive + 27 * recoil;
    trexX += -62 * drive - 54 * recoil;
    trexLean = 0.05 * drive + 0.024 * recoil;
    trikeBrace = -0.052 * brace - 0.042 * drive;
    trexGroundOffset = -8 * drive - 3 * recoil;
    trikeGroundOffset = 7 * drive;
  } else if (beat.action === 'drive') {
    const shove = smoothstep(0.08, 0.22, localTime) * (1 - smoothstep(0.46, beatDuration, localTime));
    trexX += 74 * shove;
    trikeX -= 62 * shove;
    trexLean = -0.052 * shove;
    trikeBrace = -0.028 * shove;
    trexGroundOffset = 4 * shove;
    trikeGroundOffset = 8 * shove;
  } else if (beat.action === 'recover') {
    const recoil = smoothstep(0.02, 0.52, localTime);
    const settle = 1 - smoothstep(0.92, beatDuration, localTime);
    trexX -= 70 * recoil;
    trikeX += 28 * recoil;
    trexLean = 0.018 * recoil + Math.sin(localTime * 4.4) * 0.004 * settle;
    trikeBrace = -0.012 * recoil + Math.sin(localTime * 3.7 + 0.8) * 0.003 * settle;
    trexGroundOffset = -3 * recoil;
    trikeGroundOffset = 2 * recoil;
  } else if (beat.action === 'circle') {
    const orbit = Math.sin(beatProgress * Math.PI * 2);
    const stride = Math.cos(beatProgress * Math.PI * 2);
    trexX -= 38 + orbit * 28;
    trikeX += 18 - orbit * 24;
    trexGroundOffset = stride * 6;
    trikeGroundOffset = -stride * 5;
    trexLean = -orbit * 0.012;
    trikeBrace = orbit * 0.012;
  } else if (beat.action === 'break') {
    const separation = smoothstep(0, Math.min(0.42, beatDuration), localTime);
    trexX -= 76 * separation;
    trikeX += 42 * separation;
    trexLean = 0.02 * separation;
    trikeBrace = -0.012 * separation;
    trexGroundOffset = -4 * separation;
    trikeGroundOffset = 3 * separation;
  } else if (beat.action === 'trike-fall') {
    const collapse = smoothstep(0, beatDuration, localTime);
    trexX -= 18 * collapse;
    trikeX -= 96 * collapse;
    trikeGroundOffset = 8 * collapse;
    trikeBrace = 0.18 * collapse;
    trikeScale = 1 - 0.18 * collapse;
  } else if (beat.action === 'trike-aftermath') {
    trexX -= 18;
    trikeX -= 96;
    trikeGroundOffset = 8;
    trikeBrace = 0.18;
    trikeScale = 0.82;
  }

  const trikeStill = beat.action === 'trike-aftermath';
  const trikeFalling = beat.action === 'trike-fall';
  const chasing = beat.action === 'chase';
  const standingOff = beat.action === 'stand-off';
  const trexCadence = trikeStill ? 0.18 : standingOff ? 0.04 : chasing ? 1.18 : contact ? 1.2 : beat.action === 'drive' ? 1.08 : 0.82;
  const trikeCadence = trikeStill ? 0.04 : standingOff ? 0.04 : trikeFalling ? 0.25 : chasing ? 1.08 : contact ? 1.28 : 0.86;
  const trexPhase = time * trexCadence + (beat.action === 'recover' ? 0.12 : 0);
  const trikePhase = time * trikeCadence + 0.32;
  const trexFrame = Math.floor(trexPhase * trex.frameCount) % trex.frameCount;
  const trikeFrame = Math.floor(trikePhase * trike.frameCount) % trike.frameCount;
  const stepBob = chasing ? 3.6 : standingOff || trikeStill ? 0.2 : contact ? 3.2 : trikeFalling ? 0.6 : 1.8;
  const trexGround = 659 + Math.sin(trexPhase * Math.PI * 2) * stepBob + trexGroundOffset;
  const trikeGround = 659 + Math.sin(trikePhase * Math.PI * 2 + 0.4) * stepBob * 0.75 + trikeGroundOffset;
  const trexHeight = (baseTrexHeight + Math.sin(trexPhase * Math.PI * 2) * (contact ? 1.2 : 2.2)) * trexScale;
  const trikeHeight = (baseTrikeHeight + Math.sin(trikePhase * Math.PI * 2) * (contact ? 1 : 1.8)) * trikeScale;
  const trexWidth = trex.frameWidth / trex.height * trexHeight;
  const trikeWidth = trike.frameWidth / trike.height * trikeHeight;
  const fallenBlend = trikeStill ? 1 : trikeFalling ? smoothstep(0.22, 0.5, localTime) : 0;
  const fallenHeight = baseTrikeHeight * 0.62;
  const fallenWidth = trikeFallen.frameWidth / trikeFallen.height * fallenHeight;
  const fallenX = trikeX - 70;
  const blendedShadowX = trikeX + (fallenX - trikeX) * fallenBlend;
  const blendedShadowWidth = trikeWidth + (fallenWidth - trikeWidth) * fallenBlend;
  const uprightBloodX = trikeX + trikeWidth * 0.5;
  const fallenBloodX = fallenX + fallenWidth * 0.2;
  const bloodX = uprightBloodX + (fallenBloodX - uprightBloodX) * fallenBlend;
  const shake = impactImpulse(time);

  context.save();
  context.translate(shake, -Math.abs(shake) * 0.22);
  drawGroundShadow(trexX, trexGround, trexWidth, 0.4);
  drawGroundShadow(blendedShadowX, trikeGround, blendedShadowWidth, 0.38);
  if (!trikeStill && !trikeFalling) {
    drawFootfalls(time, trexX, trexGround, trexWidth, trexCadence, 0, 0.75);
    drawFootfalls(time, trikeX, trikeGround, trikeWidth, trikeCadence, 0.32, 0.65);
  }
  if (trikeFalling || trikeStill) {
    drawBloodPool(bloodX, Math.min(HEIGHT - 2, trikeGround - 1), trikeStill ? 1 : beatProgress * 0.92);
  }
  drawSprite(trex, trexFrame, trexX, trexGround, trexHeight, { rotation: trexLean });
  if (fallenBlend < 1) {
    drawSprite(trike, trikeFrame, trikeX, trikeGround, trikeHeight, { flip: !chasing, rotation: trikeBrace, alpha: 1 - fallenBlend });
  }
  if (fallenBlend > 0) {
    drawSprite(trikeFallen, 0, fallenX, trikeGround, fallenHeight, { alpha: fallenBlend });
  }

  if (contact) {
    const impactTime = impactMoments.find((moment) => moment >= beat.start && moment < beat.end);
    if (impactTime !== undefined) {
    const age = Math.max(0, time - impactTime);
    const burst = age >= 0 && age < 0.48 ? 1 - age / 0.48 : 0;
    if (burst > 0) {
      drawDust(time + 0.4, (trexX + trikeX) * 0.5, trexGround - 35, 0.92 * burst);
    }
    }
  }
  context.restore();
}

const impactMoments = [1.52, 2.28, 2.92, 3.35, 3.82];
const bodyFallMoment = 4.48;

function impactImpulse(time) {
  let impulse = 0;
  for (const moment of impactMoments) {
    const age = time - moment;
    if (age >= 0 && age < 0.2) impulse += Math.sin((age / 0.2) * Math.PI * 2) * Math.exp(-age * 12) * 13;
  }
  const fallAge = time - bodyFallMoment;
  if (fallAge >= 0 && fallAge < 0.28) impulse += Math.sin((fallAge / 0.28) * Math.PI * 2) * Math.exp(-fallAge * 8) * 18;
  return impulse;
}

function drawGrade() {
  const shade = context.createLinearGradient(0, 0, 0, HEIGHT);
  shade.addColorStop(0, 'rgba(4,7,4,0.12)');
  shade.addColorStop(0.56, 'rgba(5,8,5,0.03)');
  shade.addColorStop(1, 'rgba(3,6,4,0.2)');
  context.fillStyle = shade;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  const vignette = context.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.45, HEIGHT * 0.24, WIDTH * 0.5, HEIGHT * 0.45, WIDTH * 0.76);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(1,4,1,0.26)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawFrame(forest, trex, trike, trikeFallen, time) {
  const safeTime = Math.max(0, Math.min(DURATION, time));
  context.save();
  context.fillStyle = '#10170f';
  context.fillRect(-6, -6, WIDTH + 12, HEIGHT + 12);
  drawEncounterBackground(forest, safeTime);
  drawVolcanicAsh(safeTime);
  drawLeaves(safeTime);

  const beat = currentFightBeat(safeTime);
  drawFightPair(trex, trike, trikeFallen, safeTime, beat);

  drawLeaves(safeTime, true);
  drawGrade();
  context.restore();
}

function upscaleOutputFrame() {
  outputContext.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  outputContext.drawImage(animationCanvas, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
}

function createNoiseBuffer(audioContext, seconds, seed) {
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * seconds, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  const next = random(seed);
  for (let index = 0; index < data.length; index += 1) data[index] = (next() * 2 - 1) * 0.55;
  return buffer;
}

function connectPanned(audioContext, source, destination, pan = 0) {
  if (typeof audioContext.createStereoPanner !== 'function') {
    source.connect(destination);
    return;
  }
  const panner = audioContext.createStereoPanner();
  panner.pan.value = pan;
  source.connect(panner).connect(destination);
}

function scheduleFootstep(audioContext, master, when, weight = 1, texture = 1, pan = 0) {
  const seed = Math.floor(when * 10000) + Math.round(weight * 731);
  const thud = audioContext.createBufferSource();
  const thudFilter = audioContext.createBiquadFilter();
  const thudEnvelope = audioContext.createGain();
  thud.buffer = createNoiseBuffer(audioContext, 0.32, seed);
  thudFilter.type = 'lowpass';
  thudFilter.frequency.setValueAtTime(260, when);
  thudFilter.frequency.exponentialRampToValueAtTime(86, when + 0.22);
  thudFilter.Q.value = 0.8;
  thudEnvelope.gain.setValueAtTime(0.0001, when);
  thudEnvelope.gain.exponentialRampToValueAtTime(0.14 * weight, when + 0.018);
  thudEnvelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.29);
  thud.connect(thudFilter).connect(thudEnvelope);
  connectPanned(audioContext, thudEnvelope, master, pan);
  thud.start(when);
  thud.stop(when + 0.31);

  const debris = audioContext.createBufferSource();
  const debrisFilter = audioContext.createBiquadFilter();
  const debrisEnvelope = audioContext.createGain();
  debris.buffer = createNoiseBuffer(audioContext, 0.24, seed + 97);
  debrisFilter.type = 'bandpass';
  debrisFilter.frequency.value = 1450 + texture * 260;
  debrisFilter.Q.value = 0.48;
  debrisEnvelope.gain.setValueAtTime(0.0001, when);
  debrisEnvelope.gain.exponentialRampToValueAtTime(0.065 * weight * texture, when + 0.014);
  debrisEnvelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
  debris.connect(debrisFilter).connect(debrisEnvelope);
  connectPanned(audioContext, debrisEnvelope, master, pan);
  debris.start(when);
  debris.stop(when + 0.22);
}

function scheduleImpact(audioContext, master, when, strength = 1, pan = 0, duration = 0.42) {
  const seed = Math.floor(when * 8000) + Math.round(strength * 313);
  const body = audioContext.createBufferSource();
  const bodyFilter = audioContext.createBiquadFilter();
  const bodyEnvelope = audioContext.createGain();
  body.buffer = createNoiseBuffer(audioContext, 0.48, seed);
  bodyFilter.type = 'lowpass';
  bodyFilter.frequency.setValueAtTime(390, when);
  bodyFilter.frequency.exponentialRampToValueAtTime(72, when + duration * 0.64);
  bodyFilter.Q.value = 0.92;
  bodyEnvelope.gain.setValueAtTime(0.0001, when);
  bodyEnvelope.gain.exponentialRampToValueAtTime(0.22 * strength, when + 0.014);
  bodyEnvelope.gain.exponentialRampToValueAtTime(0.0001, when + duration * 0.92);
  body.connect(bodyFilter).connect(bodyEnvelope);
  connectPanned(audioContext, bodyEnvelope, master, pan);
  body.start(when);
  body.stop(when + duration + 0.02);

  const crackle = audioContext.createBufferSource();
  const crackleFilter = audioContext.createBiquadFilter();
  const crackleEnvelope = audioContext.createGain();
  crackle.buffer = createNoiseBuffer(audioContext, 0.3, seed + 211);
  crackleFilter.type = 'highpass';
  crackleFilter.frequency.value = 720;
  crackleFilter.Q.value = 0.46;
  crackleEnvelope.gain.setValueAtTime(0.0001, when);
  crackleEnvelope.gain.exponentialRampToValueAtTime(0.075 * strength, when + 0.009);
  crackleEnvelope.gain.exponentialRampToValueAtTime(0.0001, when + duration * 0.72);
  crackle.connect(crackleFilter).connect(crackleEnvelope);
  connectPanned(audioContext, crackleEnvelope, master, pan);
  crackle.start(when);
  crackle.stop(when + duration * 0.74);
}

function createSoundscape(audioContext) {
  const master = audioContext.createGain();
  master.gain.value = 0.82;
  master.connect(audioContext.destination);

  const startAt = audioContext.currentTime + 0.012;

  // Keep the mix on the combat: accelerating footfalls, close calls, grapples and impacts.
  for (const beat of fightBeats) {
    if (beat.action === 'stand-off' || beat.action === 'trike-fall' || beat.action === 'trike-aftermath') continue;
    const rexInterval = beat.action === 'chase' ? 0.19 : beat.action === 'drive' ? 0.13 : beat.action === 'horn-check' ? 0.19 : 0.22;
    const trikeInterval = beat.action === 'chase' ? 0.22 : beat.action === 'horn-check' ? 0.19 : 0.27;
    let rexStep = 0;
    for (let time = beat.start + 0.1; time < beat.end - 0.06; time += rexInterval) {
      const phase = (time - beat.start) / (beat.end - beat.start);
      const basePan = beat.action === 'chase' ? -0.76 + phase * 0.4 : beat.action === 'drive' ? -0.12 : -0.28;
      const weight = beat.action === 'drive' ? 1.72 : beat.action === 'rex-bite' ? 1.55 : 1.26;
      scheduleFootstep(audioContext, master, startAt + time, weight + (rexStep % 2) * 0.08, 0.94, basePan + (rexStep % 2 ? 0.12 : -0.1));
      rexStep += 1;
    }
    let trikeStep = 0;
    for (let time = beat.start + 0.2; time < beat.end - 0.05; time += trikeInterval) {
      const phase = (time - beat.start) / (beat.end - beat.start);
      const basePan = beat.action === 'chase' ? 0.72 - phase * 0.32 : beat.action === 'horn-check' ? 0.32 : 0.23;
      const weight = beat.action === 'horn-check' ? 1.58 : beat.action === 'rex-bite' ? 1.18 : 1.02;
      scheduleFootstep(audioContext, master, startAt + time, weight + (trikeStep % 2) * 0.07, 1.12, basePan + (trikeStep % 2 ? -0.1 : 0.12));
      trikeStep += 1;
    }
  }

  // Keep the fight mix grounded in heavy footfalls and impacts; omit the
  // synthetic, pitch-swept creature calls that sounded like a "peo-peoo".

  impactMoments.forEach((time, index) => {
    const strengths = [1.62, 1.74, 1.66, 1.72, 1.82];
    const pans = [-0.08, 0.12, -0.02, -0.1, 0.08];
    scheduleImpact(audioContext, master, startAt + time, strengths[index], pans[index], index === 4 ? 0.48 : 0.4);
  });
  scheduleImpact(audioContext, master, startAt + bodyFallMoment, 2.0, 0.18, 0.56);
}

function encodeWav(audioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleCount = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const dataLength = sampleCount * channelCount * bytesPerSample;
  const wav = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wav);
  const writeText = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataLength, true);

  const channels = Array.from({ length: channelCount }, (_, channel) => audioBuffer.getChannelData(channel));
  let offset = 44;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const value = Math.max(-1, Math.min(1, channels[channel][sample]));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([wav], { type: 'audio/wav' });
}

async function renderSoundtrack() {
  const sampleRate = 48000;
  const OfflineAudio = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineAudio) throw new Error('This browser cannot render the field-audio track.');
  const audioContext = new OfflineAudio(2, DURATION * sampleRate, sampleRate);
  createSoundscape(audioContext);
  return encodeWav(await audioContext.startRendering());
}

async function renderSequence() {
  button.disabled = true;
  preview.style.display = 'none';
  progress.value = 0;
  status.textContent = 'Loading forest settings and fight poses…';

  try {
    const [forestImage, trexImage, trikeImage, trikeMaskImage, trikeFallenImage, trikeFallenMaskImage] = await Promise.all([
      loadImage(ASSETS.forest),
      loadImage(ASSETS.tyrannosaurus),
      loadImage(ASSETS.triceratops),
      loadImage(ASSETS.triceratopsMask),
      loadImage(ASSETS.triceratopsFallen),
      loadImage(ASSETS.triceratopsFallenMask),
    ]);
    const trex = prepareSheet(trexImage, 8);
    const trike = prepareSheet(applyAlphaMask(trikeImage, trikeMaskImage), 8);
    const trikeFallen = prepareCutout(applyAlphaMask(trikeFallenImage, trikeFallenMaskImage));
    status.textContent = 'Composing the complete five-second dinosaur fight track…';
    const audioBlob = await renderSoundtrack();
    const audioResponse = await fetch('/audio', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: audioBlob });
    if (!audioResponse.ok) throw new Error(await audioResponse.text());
    drawFrame(forestImage, trex, trike, trikeFallen, 0);
    upscaleOutputFrame();

    const posterBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!posterBlob) throw new Error('Could not render the matching chase poster.');
    const posterResponse = await fetch('/poster', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: posterBlob });
    if (!posterResponse.ok) throw new Error(await posterResponse.text());

    const startResponse = await fetch('/frames/start', { method: 'POST' });
    if (!startResponse.ok) throw new Error(await startResponse.text());

    for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex += 1) {
      const time = frameIndex / FPS;
      drawFrame(forestImage, trex, trike, trikeFallen, time);
      upscaleOutputFrame();
      const frameBlob = await new Promise((resolve) => animationCanvas.toBlob(resolve, 'image/jpeg', 0.94));
      if (!frameBlob) throw new Error(`Could not encode animation frame ${frameIndex + 1}.`);
      const frameResponse = await fetch(`/frame?index=${frameIndex}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: frameBlob });
      if (!frameResponse.ok) throw new Error(await frameResponse.text());
      progress.value = ((frameIndex + 1) / FRAME_COUNT) * 82;
      status.textContent = `Preparing fixed-time fight frames · ${frameIndex + 1} / ${FRAME_COUNT}`;
    }

    status.textContent = 'Encoding 150 timed frames with the fight-only soundtrack…';
    const response = await fetch('/assemble', { method: 'POST' });
    if (!response.ok) throw new Error(await response.text());
    const result = await response.json();

    const videoResponse = await fetch('/output');
    if (!videoResponse.ok) throw new Error(await videoResponse.text());
    const videoBlob = await videoResponse.blob();
    preview.src = URL.createObjectURL(videoBlob);
    preview.style.display = 'block';
    progress.value = 100;
    status.textContent = `Saved ${result.file} · ${(result.bytes / 1_048_576).toFixed(1)} MiB · ${result.frameCount} frames · ${result.duration.toFixed(2)} seconds`;
  } catch (error) {
    status.textContent = `Render failed · ${error?.message ?? String(error)}`;
    status.style.color = '#ffc5cb';
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

button.addEventListener('click', renderSequence);

Promise.all([loadImage(ASSETS.forest), loadImage(ASSETS.tyrannosaurus), loadImage(ASSETS.triceratops), loadImage(ASSETS.triceratopsMask), loadImage(ASSETS.triceratopsFallen), loadImage(ASSETS.triceratopsFallenMask)])
  .then(([forest, trexImage, trikeImage, trikeMaskImage, trikeFallenImage, trikeFallenMaskImage]) => {
    drawFrame(forest, prepareSheet(trexImage, 8), prepareSheet(applyAlphaMask(trikeImage, trikeMaskImage), 8), prepareCutout(applyAlphaMask(trikeFallenImage, trikeFallenMaskImage)), 0);
  })
  .catch((error) => {
    status.textContent = error.message;
    status.style.color = '#ffc5cb';
  });

fetch('/output').then(async (response) => {
  if (!response.ok) return;
  const blob = await response.blob();
  preview.src = URL.createObjectURL(blob);
  preview.style.display = 'block';
  status.textContent = `Existing forest encounter · ${Math.round(blob.size / 1_048_576)} MiB · ready to replace`;
}).catch(() => {});

