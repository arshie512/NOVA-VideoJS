import { createRequire } from 'node:module';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const require = createRequire('C:/Program Files/WindowsApps/OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0/app/resources/cua_node/bin/package.json');
const { chromium } = require('playwright');
const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(root, 'tools', '.nova-showcase-frames');
const inputVideo = path.join(root, 'public', 'primeval-run-2160p.mp4');
const outputVideo = path.join(root, 'public', 'NOVA-player-preview-4K.mp4');
const ffmpeg = path.join(root, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe');
const previewUrl = process.env.NOVA_PREVIEW_URL || 'http://127.0.0.1:5175/';
const captureOnly = process.argv.includes('--capture-only');

await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});

try {
  const page = await browser.newPage({
    viewport: { width: 1365, height: 900 },
    deviceScaleFactor: 3,
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (error) => { throw error; });
  await page.goto(previewUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const video = document.querySelector('.nova-player video');
    return video && video.readyState >= 2 && video.duration >= 4.9;
  }, null, { timeout: 30000 });

  const player = page.locator('.nova-player');
  await player.scrollIntoViewIfNeeded();
  const bounds = await player.boundingBox();
  if (!bounds) throw new Error('Could not locate the NOVA player frame.');

  await page.addStyleTag({ content: [
    'html, body, #root, .site-shell, main, .screening-section, .player-frame, .nova-player { background: transparent !important; }',
    '.nova-player video { opacity: 0 !important; }',
    '.nova-controls-content, .nova-controls-backdrop { visibility: visible !important; opacity: 1 !important; }',
    '.nova-controls-content { translate: 0 0 !important; scale: 1 !important; filter: none !important; }',
    '*, *::before, *::after { cursor: none !important; animation: none !important; transition: none !important; }',
  ].join(' ') });

  for (let second = 0; second < 5; second += 1) {
    await page.evaluate(async (time) => {
      const video = document.querySelector('.nova-player video');
      video.pause();
      if (Math.abs(video.currentTime - time) > 0.02) {
        await new Promise((resolve) => {
          video.addEventListener('seeked', resolve, { once: true });
          video.currentTime = time;
        });
      }
      const button = document.querySelector('.iris-trigger');
      button.removeAttribute('data-paused');
      button.setAttribute('aria-label', 'Pause film');
      button.title = 'Pause film';
      button.querySelector('.iris-index').textContent = 'PAUSE';
      button.querySelector('.aperture-glyph').setAttribute('d', 'M36 31h8v26h-8zm12 0h8v26h-8z');
      video.style.setProperty('opacity', '0', 'important');
    }, second);
    await page.waitForTimeout(80);
    const framePath = path.join(work, 'ui-frame-' + String(second).padStart(3, '0') + '.png');
    await page.screenshot({
      path: framePath,
      omitBackground: true,
      scale: 'device',
      clip: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    });
  }
} finally {
  await browser.close();
}

if (captureOnly) {
  console.log('Captured NOVA player overlays in ' + work);
  process.exit(0);
}

await execFileAsync(ffmpeg, [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-i', inputVideo,
  '-framerate', '1', '-start_number', '0', '-i', path.join(work, 'ui-frame-%03d.png'),
  '-filter_complex',
  '[1:v]scale=3840:2160:force_original_aspect_ratio=decrease[ui];[0:v][ui]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p[composite]',
  '-map', '[composite]', '-map', '0:a:0',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'copy', '-t', '5', '-movflags', '+faststart', outputVideo,
], { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 120000 });

await rm(work, { recursive: true, force: true });
console.log('Saved ' + outputVideo);

