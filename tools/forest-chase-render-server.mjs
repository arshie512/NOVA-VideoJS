import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const renderRoot = path.join(projectRoot, 'tools');
const scenesRoot = path.join(projectRoot, 'src', 'assets', 'forest-chase');
const outputFile = path.join(projectRoot, 'public', 'primeval-run-2160p.mp4');
const audioSourceFile = path.join(renderRoot, '.nova-field-audio.wav');
const frameDirectory = path.join(renderRoot, '.forest-frames');
const assembledFile = `${outputFile}.assembling.mp4`;
const videoOnlyFile = `${outputFile}.video-only.mp4`;
const audioOnlyFile = `${outputFile}.audio-only.m4a`;
const ffmpegFile = path.join(projectRoot, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe');
const posterFile = path.join(projectRoot, 'public', 'forest-chase', 'forest-chase-poster.png');
const renderPort = 5176;
const frameCount = 150;
const sceneFiles = new Set(['forest-environments.png', 'forest-encounter-background.png', 'tyrannosaurus-run.png', 'tyrannosaurus-run-skin-v2.png', 'triceratops-run.png', 'triceratops-run-clean.png', 'triceratops-run-skin-v2.png', 'triceratops-fallen.png', 'triceratops-fallen-skin-v2.png']);

await mkdir(path.dirname(posterFile), { recursive: true });

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(await readFile(path.join(renderRoot, 'forest-chase-render.html')));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/renderer.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(await readFile(path.join(renderRoot, 'forest-chase-renderer.js')));
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/scenes/')) {
    const file = path.basename(url.pathname);
    if (!sceneFiles.has(file)) {
      response.writeHead(404).end('Scene not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
    createReadStream(path.join(scenesRoot, file)).pipe(response);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/output') {
    if (!existsSync(outputFile)) {
      response.writeHead(404).end('The forest chase has not been rendered yet.');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': statSync(outputFile).size });
    createReadStream(outputFile).pipe(response);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/audio') {
    if (!request.headers['content-type']?.startsWith('audio/wav')) {
      response.writeHead(415, { 'Content-Type': 'text/plain' }).end('Expected the complete WAV field-audio track.');
      return;
    }
    try {
      const audio = await readRequestBody(request);
      if (audio.length < 960_044 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error('The generated field-audio track is incomplete.');
      }
      await writeFile(audioSourceFile, audio);
      response.writeHead(201, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ bytes: audio.length, duration: 5 }));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain' }).end(error.message);
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/poster') {
    if (!request.headers['content-type']?.startsWith('image/png')) {
      response.writeHead(415, { 'Content-Type': 'text/plain' }).end('Expected a PNG poster.');
      return;
    }

    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const poster = Buffer.concat(chunks);
      if (poster.length < 1024) throw new Error('The poster render was empty.');
      await writeFile(posterFile, poster);
      response.writeHead(201, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ bytes: poster.length, file: '/forest-chase/forest-chase-poster.png' }));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain' }).end(error.message);
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/frames/start') {
    try {
      if (!existsSync(audioSourceFile)) throw new Error('The complete field-audio track has not been rendered yet.');
      await rm(frameDirectory, { recursive: true, force: true });
      await mkdir(frameDirectory, { recursive: true });
      response.writeHead(201, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ready: true, audioBytes: statSync(audioSourceFile).size }));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain' }).end(error.message);
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/frame') {
    if (!request.headers['content-type']?.startsWith('image/jpeg')) {
      response.writeHead(415, { 'Content-Type': 'text/plain' }).end('Expected a JPEG animation frame.');
      return;
    }

    const index = Number(url.searchParams.get('index'));
    if (!Number.isInteger(index) || index < 0 || index >= frameCount) {
      response.writeHead(400, { 'Content-Type': 'text/plain' }).end('Frame index is outside the five-second sequence.');
      return;
    }
    try {
      const frame = await readRequestBody(request);
      if (frame.length < 1024) throw new Error(`Frame ${index} is empty.`);
      const name = `frame-${String(index).padStart(4, '0')}.jpg`;
      await writeFile(path.join(frameDirectory, name), frame);
      response.writeHead(201, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ index, bytes: frame.length }));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain' }).end(error.message);
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/assemble') {
    try {
      const frames = (await readdir(frameDirectory)).filter((name) => /^frame-\d{4}\.jpg$/.test(name));
      if (frames.length !== frameCount) throw new Error(`Expected ${frameCount} frames; received ${frames.length}.`);
      if (!existsSync(audioSourceFile)) throw new Error('The preserved field-audio track is missing.');

      // Render each stream independently. The bundled Windows FFmpeg build
      // stopped muxing audio at 2.88 seconds when both streams were encoded
      // together, even though the source WAV and video were both five seconds.
      await execFileAsync(ffmpegFile, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-framerate', '30', '-start_number', '0', '-i', path.join(frameDirectory, 'frame-%04d.jpg'),
        '-vf', 'scale=3840:2160:flags=lanczos,setsar=1',
        '-frames:v', String(frameCount),
        '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-t', '5', videoOnlyFile,
      ], { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 120_000 });

      await execFileAsync(ffmpegFile, [
        '-hide_banner', '-loglevel', 'error', '-y', '-i', audioSourceFile,
        '-vn', '-af', 'volume=8dB,alimiter=limit=0.95', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '5', audioOnlyFile,
      ], { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 30_000 });

      await execFileAsync(ffmpegFile, [
        '-hide_banner', '-loglevel', 'error', '-y', '-i', videoOnlyFile, '-i', audioOnlyFile,
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'copy', '-t', '5', '-movflags', '+faststart', assembledFile,
      ], { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 30_000 });

      if (!existsSync(assembledFile) || statSync(assembledFile).size < 100_000) throw new Error('The MP4 encoder did not produce a complete file.');
      await rm(outputFile, { force: true });
      await rename(assembledFile, outputFile);
      await rm(videoOnlyFile, { force: true });
      await rm(audioOnlyFile, { force: true });
      await rm(frameDirectory, { recursive: true, force: true });
      const bytes = statSync(outputFile).size;
      response.writeHead(201, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ bytes, duration: 5, frameCount, file: '/primeval-run-2160p.mp4' }));
      console.log(`Rendered ${bytes} bytes from ${frameCount} fixed-time frames to public/primeval-run-2160p.mp4`);
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain' }).end(error.message);
    }
    return;
  }

  response.writeHead(404).end('Not found');
});

server.listen(renderPort, '0.0.0.0', () => {
  console.log(`Forest chase render studio ready at http://localhost:${renderPort}/`);
});

