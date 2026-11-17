import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Container,
  Controls,
  ErrorDialog,
  Hotkey,
  MuteButton,
  PlayButton,
  StatusAnnouncer,
  Time,
  TimeSlider,
  VolumeSlider,
} from '@videojs/react';

function ApertureMark({ paused }) {
  return (
    <svg className="aperture-art" viewBox="0 0 88 88" aria-hidden="true">
      <path className="aperture-outline" d="M44 4 77 23v38L44 80 11 61V23Z" />
      <g className="iris-blades">
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <path key={angle} className="iris-blade" transform={`rotate(${angle} 44 44)`} d="M44 13 61 23 55 39 44 47 34 29Z" />
        ))}
      </g>
      <path className="aperture-center" d="m44 31 12 7v14l-12 7-12-7V38Z" />
      {paused ? (
        <path className="aperture-glyph" d="M37 32 58 44 37 56Z" />
      ) : (
        <path className="aperture-glyph" d="M36 31h8v26h-8zm12 0h8v26h-8z" />
      )}
      <path className="aperture-ticks" d="M44 0v6m0 76v6M0 44h6m76 0h6" />
    </svg>
  );
}

function SoundMark({ muted }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10v4h3l4 3V7l-4 3H4Z" />
      {muted ? (
        <path d="m15 9 5 6m0-6-5 6" />
      ) : (
        <>
          <path d="M14 9.5a4 4 0 0 1 0 5" />
          <path d="M16.5 7a7.5 7.5 0 0 1 0 10" />
        </>
      )}
    </svg>
  );
}

function FullscreenMark({ active }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {active ? (
        <path d="M8 4v4H4m16 0h-4V4M4 16h4v4m12-4h-4v4" />
      ) : (
        <path d="M4 9V4h5m6 0h5v5M20 15v5h-5m-6 0H4v-5" />
      )}
    </svg>
  );
}

function DownloadMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 16v4h14v-4" />
    </svg>
  );
}

function ContourField() {
  return (
    <svg className="contour-field" viewBox="0 0 1200 70" preserveAspectRatio="none" aria-hidden="true">
      <path d="M-18 47c69-33 109-33 174-8 61 23 97 25 160-3 69-31 102-29 164 2 63 31 104 29 166-2 65-32 105-30 169 1 60 29 99 31 159 4 67-31 112-33 181-2 55 25 94 24 153-6" />
      <path d="M-23 39c64-29 109-31 176-6 61 23 97 23 161-5 63-28 103-27 164 3 62 30 103 27 165-4 64-31 107-28 170 3 60 29 99 29 160 2 66-29 113-32 180 0 57 27 94 26 158-3" />
      <path d="M-18 55c73-37 112-36 179-10 61 24 96 27 159 0 71-31 103-31 166 0 64 32 104 32 168 1 66-32 105-31 168 0 62 30 101 34 162 7 67-31 112-35 183-2 54 24 92 22 149-8" />
      <path d="M56 31c43-17 71-16 116 1 43 17 69 17 115-2 47-20 75-20 120 1 45 21 74 20 119-1 45-20 74-20 119 1 45 21 75 20 120 0 47-20 76-20 122 2 43 20 72 20 116 1" />
      <path d="M88 24c35-12 60-11 97 4 36 14 59 13 97-2 39-16 62-16 99 1 36 17 60 16 97-1 37-16 61-16 97 1 37 17 61 16 98-1 38-17 62-16 99 1 35 17 60 17 96 3" />
      <path d="M135 59c36-17 62-17 98-2 37 15 61 16 99-1 39-17 62-18 99 0 36 18 61 18 99 0 37-18 62-18 99 0 37 18 62 17 100 0 38-17 63-16 99 1 34 16 59 16 94 2" />
      <path d="M263 14c22-8 38-7 61 2 23 9 38 8 61-1 24-10 39-10 62 1 23 11 39 10 62-1 23-10 39-10 62 1 24 11 39 10 63 0 23-10 39-10 62 1 22 10 38 10 61 1" />
      <path d="M312 64c25-11 42-11 67 0 24 11 40 11 66 0 25-11 42-11 67 0 25 11 42 11 67 0 25-11 42-11 67 0 25 11 42 11 67 0 26-11 43-10 67 1" />
    </svg>
  );
}

export function VideoSkin({ children }) {
  const playerRef = useRef(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const fullscreen = nativeFullscreen || cssFullscreen;

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        setCssFullscreen(false);
      }
      return;
    }
    if (cssFullscreen) {
      setCssFullscreen(false);
      return;
    }

    try {
      const requestFullscreen = playerRef.current?.requestFullscreen;
      if (typeof requestFullscreen !== 'function') {
        setCssFullscreen(true);
        return;
      }
      await requestFullscreen.call(playerRef.current);
      if (!document.fullscreenElement) setCssFullscreen(true);
    } catch {
      setCssFullscreen(true);
    }
  }, [cssFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setNativeFullscreen(active);
      if (active) setCssFullscreen(false);
    };
    const onKeyboard = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'));
      if (typing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.key === 'Escape' && cssFullscreen) {
        event.preventDefault();
        setCssFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', onKeyboard);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('keydown', onKeyboard);
    };
  }, [cssFullscreen, toggleFullscreen]);

  return (
    <Container
      ref={playerRef}
      className={`nova-player${cssFullscreen ? ' nova-css-fullscreen' : ''}`}
      aria-label="NOVA Living Frame cinema player"
    >
      {children}

      <div className="frame-coordinate frame-coordinate-top" aria-hidden="true">
        <span className="coordinate-cross">+</span>
        <span>CANOPY RUN <i>/</i> 01</span>
        <span className="coordinate-rule" />
          <span>SUNLIT CLEARING</span>
      </div>

      <Controls.Root>
        <Controls.Backdrop className="nova-controls-backdrop" />
        <Controls.Content className="nova-controls-content">
          <div className="download-zone">
            <a
              className="download-trigger"
              href="/primeval-run-2160p.mp4?v=fight-mix-no-synthetic-calls-v31"
              download="NOVA-4K-Dinosaur-Fight.mp4"
              aria-label="Download the complete 4K video with dinosaur fight soundtrack"
              title="Download the complete 4K video with fight soundtrack"
            >
              <DownloadMark />
              <span className="download-copy"><b>SAVE VIDEO</b><small>4K + FIGHT TRACK</small></span>
            </a>
          </div>
          <div className="instrument-state" aria-hidden="true">
            <span className="state-beacon" />
          <span>ENCOUNTER ACTIVE</span>
            <span className="state-divider">/</span>
            <span>FIGHT AUDIO</span>
          </div>

          <Controls.Group className="aperture-zone" aria-label="Film transport">
            <PlayButton
              className="iris-trigger"
              render={(props, state) => (
                <button
                  {...props}
                  className="iris-trigger"
                  aria-label={state.ended ? 'Replay film' : state.paused ? 'Play film' : 'Pause film'}
                  title={state.ended ? 'Replay film' : state.paused ? 'Play film' : 'Pause film'}
                >
                  <ApertureMark paused={state.paused || state.ended} />
                  <span className="iris-index">{state.ended ? 'REPLAY' : state.paused ? 'PLAY' : 'PAUSE'}</span>
                </button>
              )}
            />
          </Controls.Group>

          <Controls.Group className="living-timeline" aria-label="Film timeline">
            <div className="temporal-readout">
              <div className="temporal-now">
                <span className="temporal-label">FRAME POSITION</span>
                <Time.Value type="current" className="temporal-current" />
              </div>
              <span className="temporal-axis" aria-hidden="true"><i /></span>
              <div className="temporal-end">
                <span className="temporal-label">TOTAL RUN</span>
                <Time.Value type="duration" className="temporal-duration" />
              </div>
            </div>
            <TimeSlider.Root className="nova-time-slider" label="Seek through the film">
              <TimeSlider.Track className="nova-slider-track">
                <ContourField />
                <TimeSlider.Buffer className="nova-slider-buffer" />
                <TimeSlider.Fill className="nova-slider-fill" />
              </TimeSlider.Track>
              <TimeSlider.Thumb className="nova-slider-thumb" />
              <TimeSlider.Value type="pointer" className="nova-slider-preview" />
            </TimeSlider.Root>
          </Controls.Group>

          <Controls.Group className="sound-spine" aria-label="Sound and display controls">
            <span className="spine-label">VOLUME</span>
            <MuteButton
              className="sound-trigger"
              render={(props, state) => (
                <button
                  {...props}
                  className="sound-trigger"
                  aria-label={state.muted || state.volumeLevel === 'off' ? 'Unmute audio' : 'Mute audio'}
                  title={state.muted || state.volumeLevel === 'off' ? 'Unmute audio' : 'Mute audio'}
                >
                  <SoundMark muted={state.muted || state.volumeLevel === 'off'} />
                </button>
              )}
            />
            <VolumeSlider.Root className="nova-volume-slider" label="Volume">
              <VolumeSlider.Track className="nova-volume-track">
                <VolumeSlider.Fill className="nova-volume-fill" />
              </VolumeSlider.Track>
              <VolumeSlider.Thumb className="nova-volume-thumb" />
            </VolumeSlider.Root>
            <span className="spine-rule" aria-hidden="true" />
            <button
              type="button"
              className="fullscreen-trigger"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              aria-pressed={fullscreen}
              title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              onClick={toggleFullscreen}
            >
              <FullscreenMark active={fullscreen} />
              <span className="fullscreen-label">
                <span className="fullscreen-label-long">{fullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}</span>
                <span className="fullscreen-label-short">{fullscreen ? 'EXIT' : 'FULL'}</span>
              </span>
            </button>
          </Controls.Group>

          <span className="field-annotation field-annotation-left" aria-hidden="true">SIGNAL / 01</span>
          <span className="field-annotation field-annotation-right" aria-hidden="true">NOVA · 30 FPS</span>
        </Controls.Content>
      </Controls.Root>

      <Hotkey keys="Space" action="togglePaused" />
      <Hotkey keys="m" action="toggleMuted" />
      <Hotkey keys="ArrowLeft" action="seekStep" value={-5} />
      <Hotkey keys="ArrowRight" action="seekStep" value={5} />
      <StatusAnnouncer />

      <ErrorDialog.Root>
        <ErrorDialog.Popup className="nova-error-dialog">
          <span className="error-kicker">SIGNAL LOST</span>
          <ErrorDialog.Title />
          <ErrorDialog.Description />
          <ErrorDialog.Close />
        </ErrorDialog.Popup>
      </ErrorDialog.Root>
    </Container>
  );
}

