import { createPlayer } from '@videojs/react';
import { Video, videoFeatures } from '@videojs/react/video';
import { VideoSkin } from './VideoSkin.jsx';

const { Player } = createPlayer({ features: videoFeatures });

function NovaMark() {
  return (
    <svg className="nova-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2 29 9.5v13L16 30 3 22.5v-13Z" />
      <path d="m16 8 7 4v8l-7 4-7-4v-8Z" />
      <path d="m13 12 8 4-8 4Z" />
    </svg>
  );
}

function App() {
  const downloadedPackage = window.location.port === '4178';

  return (
    <div className="site-shell forest-world">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="NOVA — The Living Frame">
          <NovaMark />
          <span className="brand-word">NOVA</span>
          <span className="brand-divider" />
          <span className="brand-caption">THE LIVING FRAME</span>
        </a>
          <div className="header-index"><span>FIELD STUDY</span><b>01</b><i> / </i><span>05</span></div>
      </header>

      <main id="top">
        <section className="intro-section" aria-labelledby="page-title">
          <div className="intro-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> SOMETHING MOVES IN THE CANOPY</p>
            <h1 id="page-title">No path stays<br /><em>clear for long.</em></h1>
            <p className="intro-description">One second of pursuit, a split-second face-off, then two hard bites, a horn counter and a final drive in the sunlit clearing. The forest-green and purple T. rex meets a rose-pink Triceratops marked in velvet blue and yellow.</p>
          </div>
          <div className="intro-coordinate" aria-label="Experience details">
            <span className="coordinate-overline">CURRENT STUDY</span>
            <strong>PREDATOR / PREY</strong>
            <span>SUNLIT CLEARING <i>·</i> 05 SEC <i>/</i> 2160P UHD</span>
            <span className="coordinate-axis" aria-hidden="true" />
            <span>ORIGINAL VISUALS &amp; FIGHT SOUND</span>
          </div>
        </section>

        <section className="screening-section" aria-label="Primeval forest dinosaur fight video experience">
          <div className="section-marker">
            <span className="marker-number">01</span>
            <span className="marker-name">THE LIVING FRAME</span>
            <span className="marker-rule" />
            <span className="marker-mode">01 SEC CHASE <i>·</i> 2160P UHD <i>·</i> TRICERATOPS FALLS</span>
          </div>

          <div className="player-frame">
            <Player>
              <VideoSkin>
                <Video
                  src="/primeval-run-2160p.mp4?v=fight-mix-no-synthetic-calls-v31"
                  poster="/forest-chase/forest-chase-poster.png"
                  playsInline
                  preload="metadata"
                />
              </VideoSkin>
            </Player>
            <span className="frame-index frame-index-left" aria-hidden="true">FIG. 01</span>
            <span className="frame-index frame-index-right" aria-hidden="true">NOVA / FOREST-01</span>
          </div>

          <div className="player-caption-row">
            <p><span className="caption-signal">↗</span> 01 SEC CHASE / FACE-TO-FACE FIGHT / TRICERATOPS FALLS</p>
            <p className="caption-shortcut"><kbd>SPACE</kbd> APERTURE <span>·</span> <kbd>M</kbd> SOUND <span>·</span> <kbd>F</kbd> FIELD</p>
          </div>

          <div className="player-package-download">
            <div className="package-download-copy">
              <span>PLAYER + VIDEO</span>
              <p>{downloadedPackage ? 'This download includes the working NOVA controls and the complete 4K film with its fight soundtrack.' : 'The MP4 is one complete 4K video with the fight soundtrack. Download the ZIP for the interactive NOVA player controls.'}</p>
            </div>
            {downloadedPackage ? (
              <span className="package-ready-label">PLAYER READY · CONTROLS INCLUDED</span>
            ) : (
              <a href="/NOVA-player-spatial-dino-audio.zip" download="NOVA-player-spatial-dino-audio.zip" className="package-download-link">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 16v4h14v-4" /></svg>
                <span><b>DOWNLOAD PLAYER + VIDEO</b><small>ZIP · INTERACTIVE CONTROLS INCLUDED</small></span>
              </a>
            )}
          </div>
        </section>

        <section className="film-notes forest-notes" aria-label="About the primeval forest chase">
          <div className="notes-heading">
            <span>PASSAGE</span><i /> <span>N° 001</span>
          </div>
          <div className="notes-content">
            <h2>The ground shakes.<br /><em>Something answers.</em></h2>
            <p>One continuous sunlit clearing, with no scene or season change. After a one-second chase and brief face-off, the T. rex attacks twice. The Triceratops drives it back with a horn counter; the T. rex surges in again, forces it down, and stands over it as it lies still.</p>
            <div className="film-credits">
              <span><b>CREATURES</b> T. REX / GREEN + PURPLE + ASH GREY <i>·</i> TRICERATOPS / PINK + VELVET BLUE + YELLOW</span>
              <span><b>VISUALS</b> ORIGINAL FRAME ANIMATION <i>·</i> 2160P UHD</span>
              <span><b>SOUND</b> ORIGINAL DINOSAUR FIGHT TRACK</span>
            </div>
          </div>
          <div className="notes-stamp" aria-hidden="true"><span>FIELD<br />STUDY</span><i>⌁</i></div>
        </section>
      </main>

      <footer className="site-footer">
        <span>KEEP TO THE TRAIL.</span>
        <span>THE CANOPY IS NO SHELTER <i>⌁</i></span>
      </footer>
    </div>
  );
}

export default App;

