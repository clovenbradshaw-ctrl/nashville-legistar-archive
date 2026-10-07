// the legacy engine · perceiver/audio — promoted verbatim from eoreader5's
// perceiver/audio/wav.js. Minimal RIFF/WAVE decoder: no dependency, runs in
// browser and plain node. Multi-channel stays separated; the perceiver
// collapses to mono and records it as a discard.
//
// EO: SIG(Void → Field, Tending) — a minimal WAV decoder
// RIFF/WAVE is simple enough to read without a dependency: a 12-byte header,
// then a sequence of [id(4) size(4) data(size)] chunks. We read the `fmt `
// chunk for the sample layout and the `data` chunk for the samples.
// Multi-channel audio is kept as separate channels (mono-summed later by
// the perceiver, not here) so the perceiver's own channel-collapse discard
// entry stays honest about what happened.

const readAscii = (view, offset, len) => {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
};

// Sign-extend a 24-bit little-endian sample read as three bytes.
const readInt24LE = (view, offset) => {
  const b0 = view.getUint8(offset), b1 = view.getUint8(offset + 1), b2 = view.getUint8(offset + 2);
  let v = b0 | (b1 << 8) | (b2 << 16);
  if (v & 0x800000) v -= 0x1000000;
  return v;
};

// sniffWav(bytes) — true if the bytes look like a RIFF/WAVE container.
export const sniffWav = (bytes) => {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 12) return false;
  const riff = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  const wave = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
  return riff === 'RIFF' && wave === 'WAVE';
};

// decodeWav(bytes) — bytes is anything DataView accepts (ArrayBuffer, or a
// Uint8Array). Returns { sampleRate, channels, bitDepth, channelData },
// where channelData is an array of Float32Array (one per channel, in
// [-1, 1]) — the shape the perceiver's monoSum expects.
export const decodeWav = (bytes) => {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (view.byteLength < 12 || readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
    throw new Error('decodeWav: not a RIFF/WAVE file');
  }

  let sampleRate = null, channels = null, bitDepth = null, audioFormat = null;
  let dataOffset = null, dataSize = 0;

  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = readAscii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const bodyStart = offset + 8;
    if (id === 'fmt ') {
      audioFormat = view.getUint16(bodyStart, true);
      channels = view.getUint16(bodyStart + 2, true);
      sampleRate = view.getUint32(bodyStart + 4, true);
      bitDepth = view.getUint16(bodyStart + 14, true);
    } else if (id === 'data') {
      dataOffset = bodyStart;
      dataSize = Math.min(size, view.byteLength - bodyStart);
    }
    offset = bodyStart + size + (size % 2); // chunks are word-aligned
  }

  if (sampleRate == null || dataOffset == null) {
    throw new Error('decodeWav: missing fmt or data chunk');
  }

  const bytesPerSample = bitDepth / 8;
  const frameCount = Math.floor(dataSize / (bytesPerSample * channels));

  const channelData = [];
  for (let c = 0; c < channels; c++) channelData.push(new Float32Array(frameCount));

  const readSample = (byteOffset) => {
    if (audioFormat === 3 && bitDepth === 32) return view.getFloat32(byteOffset, true);
    if (audioFormat === 3 && bitDepth === 64) return view.getFloat64(byteOffset, true);
    if (bitDepth === 8) return (view.getUint8(byteOffset) - 128) / 128;
    if (bitDepth === 16) return view.getInt16(byteOffset, true) / 32768;
    if (bitDepth === 24) return readInt24LE(view, byteOffset) / 8388608;
    if (bitDepth === 32) return view.getInt32(byteOffset, true) / 2147483648;
    throw new Error(`decodeWav: unsupported bit depth ${bitDepth} (format ${audioFormat})`);
  };

  for (let f = 0; f < frameCount; f++) {
    const frameStart = dataOffset + f * bytesPerSample * channels;
    for (let c = 0; c < channels; c++) {
      channelData[c][f] = readSample(frameStart + c * bytesPerSample);
    }
  }

  return { sampleRate, channels, bitDepth, channelData };
};
