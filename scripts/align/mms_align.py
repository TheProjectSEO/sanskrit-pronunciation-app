"""
Forced alignment of a known mantra text to the teacher's recording (Meta MMS, via torchaudio).
Reads JSON lines on stdin: {"id": str, "pcm": path to 16 kHz mono s16le, "words": [ascii words]}
Writes JSON lines: {"id": str, "spans": [[start_s, end_s], ...]} or {"id": str, "error": str}
Run with the project's .venv-align (torch/torchaudio 2.6).
"""
import json
import sys

import numpy as np
import torch
from torchaudio.pipelines import MMS_FA

bundle = MMS_FA
model = bundle.get_model()
tokenizer = bundle.get_tokenizer()
aligner = bundle.get_aligner()
RATE = bundle.sample_rate  # 16000

for line in sys.stdin:
    if not line.strip():
        continue
    job = json.loads(line)
    try:
        pcm = np.fromfile(job["pcm"], dtype="<i2").astype(np.float32) / 32768.0
        wave = torch.from_numpy(pcm).unsqueeze(0)
        with torch.inference_mode():
            emission, _ = model(wave)
            spans = aligner(emission[0], tokenizer(job["words"]))
        ratio = wave.size(1) / emission.size(1) / RATE
        out = [[round(s[0].start * ratio, 3), round(s[-1].end * ratio, 3)] for s in spans]
        print(json.dumps({"id": job["id"], "spans": out}), flush=True)
    except Exception as e:  # report per job, keep going
        print(json.dumps({"id": job.get("id"), "error": str(e)}), flush=True)
