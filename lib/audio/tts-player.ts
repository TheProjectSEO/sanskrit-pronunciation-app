let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export async function playTTS(text: string): Promise<void> {
  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.onended = null;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
    currentAudio = null;
  }

  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error('TTS request failed');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  currentAudio = audio;
  currentUrl = url;

  return new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) {
        currentAudio = null;
        currentUrl = null;
      }
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) {
        currentAudio = null;
        currentUrl = null;
      }
      reject(new Error('Audio playback failed'));
    };
    audio.play().catch(reject);
  });
}

export function stopTTS(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.onended = null;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
    currentAudio = null;
  }
}
