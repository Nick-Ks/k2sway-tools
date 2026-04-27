export interface MediaSessionStatus {
  title: string;
  artist: string;
  album?: string;
}

let indicatorAudio: HTMLAudioElement | null = null;

const SILENT_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

function getIndicatorAudio() {
  if (indicatorAudio) return indicatorAudio;
  const audio = document.createElement('audio');
  audio.src = SILENT_WAV_DATA_URL;
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0.01;
  audio.setAttribute('playsinline', 'true');
  indicatorAudio = audio;
  return audio;
}

export function startMediaSessionIndicator(status: MediaSessionStatus, onPause: () => void) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.playbackState = 'playing';
  navigator.mediaSession.metadata = new MediaMetadata({
    title: status.title,
    artist: status.artist,
    album: status.album ?? ''
  });
  navigator.mediaSession.setActionHandler('pause', onPause);

  const audio = getIndicatorAudio();
  const playPromise = audio.play();
  if (playPromise) {
    playPromise.catch(() => {
      // Ignore autoplay/runtime rejections. MediaSession metadata is still applied.
    });
  }
}

export function stopMediaSessionIndicator() {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  if (!indicatorAudio) return;
  indicatorAudio.pause();
  indicatorAudio.currentTime = 0;
}
