# Audio Files Setup

## Missing Audio Files

The app is looking for audio files at:
```
public/sounds/reference/om-namo-bhagavate-vasudevaya.wav
```

## To Fix:

1. Copy your reference audio files to:
```bash
cd "/Users/adityaaman/Desktop/Desktop - Aditya's MacBook Pro/All Development/n8n Workflows/Tapaswe Sanskrit Pronounciation/tapaswe-app"

# Copy audio files
cp /path/to/your/audio/files/*.wav public/sounds/reference/
```

2. Restart the dev server:
```bash
npm run dev
```

## File Names Expected:
- om-namo-bhagavate-vasudevaya.wav
- yada-yada-hi-dharmasya.wav
- idam-tu-te-guhyatamam.wav
(or whatever your mantras are named)
