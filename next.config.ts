import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ffmpeg-static ships a native binary; keep it out of the bundle and trace it into
  // the pronunciation routes, which convert the teacher's recording to WAV once.
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: {
    '/api/analyze-pronunciation': ['./node_modules/ffmpeg-static/ffmpeg'],
    '/api/analyze-word': ['./node_modules/ffmpeg-static/ffmpeg'],
  },
};

export default nextConfig;
