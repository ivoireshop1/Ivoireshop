import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 22050;

function envelope(index, length) {
  const attack = Math.min(1, index / (0.02 * sampleRate));
  const release = Math.min(1, (length - index) / (0.09 * sampleRate));
  return Math.max(0, Math.min(1, attack * release));
}

function mixTones(notes, duration) {
  const length = Math.floor(duration * sampleRate);
  const samples = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const env = envelope(i, length);
    let sample = 0;
    for (const note of notes) {
      if (t < note.start || t > note.start + note.len) continue;
      const local = t - note.start;
      const localEnv = Math.min(1, local / 0.02) * Math.min(1, (note.len - local) / 0.08);
      sample += Math.sin(2 * Math.PI * note.freq * local) * localEnv * note.gain;
    }
    samples[i] = Math.max(-32767, Math.min(32767, Math.round(sample * env * 32767)));
  }
  return samples;
}

function wavBuffer(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  Buffer.from(samples.buffer, samples.byteOffset, dataSize).copy(buffer, 44);
  return buffer;
}

const cues = {
  "ivoire-unlock.wav": mixTones([{ freq: 180, start: 0, len: 0.04, gain: 0.02 }], 0.05),
  "ivoire-accepted.wav": mixTones(
    [
      { freq: 392, start: 0, len: 0.28, gain: 0.22 },
      { freq: 523.25, start: 0.22, len: 0.42, gain: 0.24 },
    ],
    0.75,
  ),
  "ivoire-preparing.wav": mixTones(
    [
      { freq: 349.23, start: 0, len: 0.3, gain: 0.2 },
      { freq: 440, start: 0.24, len: 0.4, gain: 0.22 },
    ],
    0.8,
  ),
  "ivoire-ready.wav": mixTones(
    [
      { freq: 440, start: 0, len: 0.22, gain: 0.2 },
      { freq: 554.37, start: 0.18, len: 0.24, gain: 0.22 },
      { freq: 659.25, start: 0.38, len: 0.42, gain: 0.24 },
    ],
    0.95,
  ),
  "ivoire-success.wav": mixTones(
    [
      { freq: 392, start: 0, len: 0.22, gain: 0.2 },
      { freq: 523.25, start: 0.18, len: 0.24, gain: 0.22 },
      { freq: 659.25, start: 0.38, len: 0.5, gain: 0.26 },
    ],
    1.05,
  ),
  "ivoire-welcome.wav": mixTones(
    [
      { freq: 329.63, start: 0, len: 0.28, gain: 0.2 },
      { freq: 415.3, start: 0.24, len: 0.3, gain: 0.22 },
      { freq: 523.25, start: 0.5, len: 0.55, gain: 0.24 },
    ],
    1.2,
  ),
};

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");
mkdirSync(dir, { recursive: true });
for (const [name, samples] of Object.entries(cues)) {
  writeFileSync(join(dir, name), wavBuffer(samples));
}
