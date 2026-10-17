import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const soundsDir = path.join(root, "public", "sounds");
const TARGET_PEAK = 29200; // ~ -1 dBFS, leaves headroom

function readWavPcm16(filePath) {
  const buf = fs.readFileSync(filePath);
  const dataOffset = 44;
  const samples = [];
  for (let i = dataOffset; i + 1 < buf.length; i += 2) {
    samples.push(buf.readInt16LE(i));
  }
  return { header: buf.subarray(0, 44), samples, buf };
}

function writeWavPcm16(filePath, header, samples) {
  const out = Buffer.alloc(44 + samples.length * 2);
  header.copy(out, 0, 0, 44);
  for (let i = 0; i < samples.length; i += 1) {
    const clipped = Math.max(-32767, Math.min(32767, Math.round(samples[i])));
    out.writeInt16LE(clipped, 44 + i * 2);
  }
  fs.writeFileSync(filePath, out);
}

function normalize(samples, target = TARGET_PEAK) {
  let peak = 1;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const gain = target / peak;
  return samples.map((sample) => sample * gain);
}

function sineTone({ sampleRate = 44100, freq, ms, peak = TARGET_PEAK }) {
  const n = Math.floor((sampleRate * ms) / 1000);
  const samples = new Array(n);
  const attack = Math.floor(sampleRate * 0.008);
  const release = Math.floor(sampleRate * 0.05);
  for (let i = 0; i < n; i += 1) {
    let env = 1;
    if (i < attack) env = i / attack;
    else if (i > n - release) env = Math.max(0, (n - i) / release);
    samples[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * peak * env;
  }
  return samples;
}

function writeGeneratedWav(filePath, samples, sampleRate = 44100) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i]))), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

const loudFiles = ["ivoire-accepted.wav", "ivoire-preparing.wav", "ivoire-ready.wav", "ivoire-success.wav", "ivoire-welcome.wav"];
for (const name of loudFiles) {
  const filePath = path.join(soundsDir, name);
  const { header, samples } = readWavPcm16(filePath);
  writeWavPcm16(filePath, header, normalize(samples));
}

const gap = new Array(Math.floor(44100 * 0.06)).fill(0);
const newOrder = [
  ...sineTone({ freq: 880, ms: 140 }),
  ...gap,
  ...sineTone({ freq: 1320, ms: 220 }),
];
writeGeneratedWav(path.join(soundsDir, "ivoire-new-order.wav"), newOrder);

const cueMap = {
  accepted: "ivoire-accepted.wav",
  preparing: "ivoire-preparing.wav",
  ready: "ivoire-ready.wav",
  success: "ivoire-success.wav",
  welcome: "ivoire-welcome.wav",
  unlock: "ivoire-unlock.wav",
  new_order: "ivoire-new-order.wav",
};

const entries = Object.entries(cueMap).map(([key, file]) => {
  const encoded = fs.readFileSync(path.join(soundsDir, file)).toString("base64");
  return `  ${key}: "${encoded}"`;
});

const contents = `export const ivoireCueWav: Record<string, string> = {\n${entries.join(",\n")},\n};\n`;
fs.writeFileSync(path.join(root, "src/lib/audio/cue-data.ts"), contents);
console.log("normalized cues and wrote cue-data.ts");
