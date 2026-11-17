import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire('C:/Program Files/WindowsApps/OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0/app/resources/cua_node/bin/package.json');
const { chromium } = require('playwright');
const flags = new Set(process.argv.slice(2));
const shouldRender = !flags.has('--verify-only');
const renderOnly = flags.has('--render-only');
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-frame-rate-limit', '--disable-features=CalculateNativeWinOcclusion'],
});
const context = await browser.newContext();
const errors = [];
let renderStatus = 'Skipped render';

if (shouldRender) {
  const render = await context.newPage();
  render.on('pageerror', (error) => errors.push(error.message));
  await render.setViewportSize({ width: 1440, height: 1000 });
  await render.goto('http://127.0.0.1:5176/', { waitUntil: 'networkidle' });
  await render.bringToFront();
  await render.waitForFunction(() => document.querySelector('#render') && !document.querySelector('#render').disabled, null, { timeout: 20000 });
  await render.locator('#render').click();
  await render.waitForFunction(() => document.querySelector('#status')?.textContent.startsWith('Saved '), null, { timeout: 120000 });
  renderStatus = await render.locator('#status').innerText();
}

if (renderOnly) {
  console.log(JSON.stringify({ renderStatus, errors }));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
}

const app = await context.newPage();
app.on('pageerror', (error) => errors.push(error.message));
app.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const previewUrl = process.env.NOVA_PREVIEW_URL ?? 'http://127.0.0.1:5174/';
const response = await app.goto(previewUrl, { waitUntil: 'networkidle' });
await app.waitForSelector('video');
await app.waitForFunction(() => document.querySelector('video')?.readyState >= 1, null, { timeout: 30000 });
const isDownloadedPackage = new URL(previewUrl).port === '4178';
let packageDownload = 'downloaded package controls ready';
if (isDownloadedPackage) {
  if (await app.getByText('PLAYER READY · CONTROLS INCLUDED').count() !== 1) throw new Error('The extracted download must clearly show that its player controls are included.');
} else {
  if (await app.locator('.package-download-link').count() !== 1) throw new Error('The main preview must offer the NOVA player and video ZIP download.');
  packageDownload = await app.evaluate(async () => {
    const result = await fetch('/NOVA-player-spatial-dino-audio.zip', { method: 'HEAD' });
    return `${result.status} · ${result.headers.get('content-length')} bytes`;
  });
  if (!packageDownload.startsWith('200 · ')) throw new Error(`The player package download returned ${packageDownload}.`);
}
const video = app.locator('video').first();
const metadata = await video.evaluate((element) => ({ duration: element.duration, width: element.videoWidth, height: element.videoHeight, currentSrc: element.currentSrc, readyState: element.readyState }));
const controls = app.locator('.nova-controls-content');
const controlsVisibility = await controls.evaluate((element) => ({
  visible: getComputedStyle(element).visibility !== 'hidden' && Number(getComputedStyle(element).opacity) > 0.95,
  display: getComputedStyle(element).display,
  hasAutoHideState: element.hasAttribute('data-visible'),
}));
await app.screenshot({ path: 'tools/player-controls-preview.png', fullPage: true });
const requiredButtons = ['Play film', 'Mute audio', 'Enter fullscreen'];
for (const name of requiredButtons) {
  if (await app.getByRole('button', { name }).count() !== 1) throw new Error(`Expected visible control: ${name}`);
}
const seekSlider = app.locator('.nova-time-slider');
const volumeSlider = app.locator('.nova-volume-slider');
if (await seekSlider.count() !== 1 || await volumeSlider.count() !== 1) throw new Error('Seek and volume sliders must be present.');
const sampleTimes = [[0.55, 'chase-2160'], [1.65, 'bite-2160'], [2.95, 'second-bite-2160'], [Math.max(0, metadata.duration - 0.2), 'ending-2160']];
await video.evaluate((element) => { element.currentTime = 0; });
await app.waitForFunction(() => (document.querySelector('video')?.currentTime ?? 1) < 0.08, null, { timeout: 12000 });
await app.getByRole('button', { name: 'Play film' }).click();
await app.waitForFunction(() => (document.querySelector('video')?.currentTime ?? 0) > 0.2, null, { timeout: 5000 });
await app.getByRole('button', { name: 'Pause film' }).click();
await app.waitForFunction(() => document.querySelector('video')?.paused, null, { timeout: 3000 });
await app.getByRole('button', { name: 'Mute audio' }).click();
if (!(await video.evaluate((element) => element.muted))) throw new Error('Mute button did not mute the video.');
await app.getByRole('button', { name: 'Unmute audio' }).click();
if (await video.evaluate((element) => element.muted)) throw new Error('Mute button did not restore audio.');
const volumeThumb = volumeSlider.locator('[role="slider"]');
const seekThumb = seekSlider.locator('[role="slider"]');
if (await volumeThumb.count() !== 1 || await seekThumb.count() !== 1) throw new Error('Both sliders need keyboard-focusable thumbs.');
await volumeThumb.focus();
await volumeThumb.press('ArrowLeft');
const adjustedVolume = await video.evaluate((element) => element.volume);
if (!(adjustedVolume < 1)) throw new Error('Volume slider did not adjust playback volume with the keyboard.');
await seekThumb.focus();
await seekThumb.press('ArrowRight');
const keyboardSeek = await video.evaluate((element) => element.currentTime);
if (!(keyboardSeek > 0)) throw new Error('Seek slider did not respond to keyboard input.');
await video.evaluate((element) => { element.currentTime = 0; });
await app.waitForFunction(() => (document.querySelector('video')?.currentTime ?? 1) < 0.08, null, { timeout: 12000 });
await app.getByRole('button', { name: 'Enter fullscreen' }).click();
await app.waitForFunction(() => Boolean(document.fullscreenElement) || document.querySelector('.nova-player')?.classList.contains('nova-css-fullscreen'), null, { timeout: 5000 });
await app.getByRole('button', { name: 'Exit fullscreen' }).click();
const mobile = await context.newPage();
mobile.on('pageerror', (error) => errors.push(error.message));
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(previewUrl, { waitUntil: 'networkidle' });
await mobile.waitForFunction(() => document.querySelector('video')?.readyState >= 1, null, { timeout: 30000 });
const mobileControls = mobile.locator('.nova-controls-content');
const mobileVisible = await mobileControls.evaluate((element) => getComputedStyle(element).opacity !== '0' && element.getBoundingClientRect().width > 0);
for (const name of requiredButtons) {
  if (await mobile.getByRole('button', { name }).count() !== 1) throw new Error(`Mobile layout is missing control: ${name}`);
}
if (!mobileVisible) throw new Error('Player controls are not visible at mobile width.');
await mobile.screenshot({ path: 'tools/player-controls-mobile.png', fullPage: true });
await mobile.close();
await video.evaluate((element) => {
  element.__novaPresentedFrames = [];
  const record = (_now, frame) => {
    element.__novaPresentedFrames.push(frame.mediaTime);
    if (!element.ended) element.requestVideoFrameCallback(record);
  };
  element.requestVideoFrameCallback(record);
});
await app.getByRole('button', { name: 'Play film' }).click();
for (const [time, name] of sampleTimes) {
  await app.waitForFunction((value) => {
    const element = document.querySelector('video');
    return element && element.currentTime >= value;
  }, time, { timeout: 12000 });
  await video.evaluate((element) => new Promise((resolve) => {
    if (!element.requestVideoFrameCallback) return requestAnimationFrame(() => requestAnimationFrame(resolve));
    const timer = setTimeout(resolve, 1500);
    element.requestVideoFrameCallback(() => { clearTimeout(timer); resolve(); });
  }));
  const frame = await video.evaluate((element) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    canvas.getContext('2d').drawImage(element, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  });
  writeFileSync(`tools/${name}.png`, Buffer.from(frame.split(',')[1], 'base64'));
}
await app.waitForFunction(() => document.querySelector('video')?.ended, null, { timeout: 15000 });
const playback = await video.evaluate((element) => {
  const quality = element.getVideoPlaybackQuality?.();
  const frames = element.__novaPresentedFrames ?? [];
  return { currentTime: element.currentTime, paused: element.paused, ended: element.ended, totalVideoFrames: quality?.totalVideoFrames ?? null, droppedVideoFrames: quality?.droppedVideoFrames ?? null, sampledMediaFrames: frames.length, sampledMediaTime: frames.length ? [frames[0], frames.at(-1)] : [] };
});
console.log(JSON.stringify({ renderStatus, httpStatus: response.status(), metadata, packageDownload, controlsVisibility, pauseResumed: true, adjustedVolume, keyboardSeek, mobileVisible, playback, errors }));
await browser.close();

