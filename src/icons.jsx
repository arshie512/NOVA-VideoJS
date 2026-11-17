export function PlayIcon({ size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 5.8c0-.8.9-1.3 1.6-.9l9.2 5.3a2.1 2.1 0 0 1 0 3.6l-9.2 5.3A1.05 1.05 0 0 1 8 18.2V5.8Z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8.1 5.5h2.6c.6 0 1 .4 1 1v11c0 .6-.4 1-1 1H8.1c-.6 0-1-.4-1-1v-11c0-.6.4-1 1-1Zm5.2 0h2.6c.6 0 1 .4 1 1v11c0 .6-.4 1-1 1h-2.6c-.6 0-1-.4-1-1v-11c0-.6.4-1 1-1Z" fill="currentColor" />
    </svg>
  );
}

export function VolumeIcon({ muted = false, size = 19 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6.5 8.5H3.8v7h2.7L11 19V5Z" fill={muted ? 'none' : 'currentColor'} fillOpacity=".14" />
      {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15 9a4.2 4.2 0 0 1 0 6" /><path d="M17.8 6.5a8 8 0 0 1 0 11" /></>}
    </svg>
  );
}

export function FullscreenIcon({ active = false, size = 18 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {active ? <path d="M8.5 3.8v4.7H3.8m16.4 0h-4.7V3.8m0 16.4v-4.7h4.7m-16.4 0h4.7v4.7" /> : <path d="M8.5 3.8H3.8v4.7m16.4 0V3.8h-4.7m0 16.4h4.7v-4.7m-16.4 0v4.7h4.7" />}
    </svg>
  );
}

