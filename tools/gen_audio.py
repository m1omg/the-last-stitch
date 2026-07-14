#!/usr/bin/env python3
"""Synthesize the full OST + SFX for THE LAST STITCH.

One lullaby leitmotif ("Little Poppy-Flower", a 3/4 waltz) is recolored across
the whole soundtrack — music box on the title, sparse piano in the cottage,
detuned and half-speed under static in the White Rooms, full and warm at the
ending. Everything is rendered from scratch with numpy and encoded to OGG via
ffmpeg. Loops are made seamless by folding the reverb/echo tail back onto the
start of the loop.

Usage: python3 tools/gen_audio.py [--only name] [--wav]
"""

import argparse
import math
import os
import subprocess
import sys

import numpy as np

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_MUSIC = os.path.join(ROOT, 'assets', 'audio', 'music')
OUT_SFX = os.path.join(ROOT, 'assets', 'audio', 'sfx')

rng = np.random.default_rng(20260714)


# ───────────────────────── helpers ─────────────────────────

def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def N(name):
    """'C4' → midi number; 'Eb3'/'F#5' supported."""
    letter = name[0]
    rest = name[1:]
    acc = 0
    if rest and rest[0] in '#b':
        acc = 1 if rest[0] == '#' else -1
        rest = rest[1:]
    octave = int(rest)
    return 12 * (octave + 1) + NOTE[letter] + acc


def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.1):
    t = np.arange(n) / SR
    total = n / SR
    e = np.ones(n) * s
    ai = min(n, int(a * SR))
    di = min(n - ai, int(d * SR))
    ri = min(n, int(r * SR))
    if ai: e[:ai] = np.linspace(0, 1, ai)
    if di: e[ai:ai + di] = np.linspace(1, s, di)
    if ri: e[-ri:] = e[-ri:] * np.linspace(1, 0, ri)
    return e


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (SR * tau))


def fir_lowpass(x, cutoff, taps=127):
    """Linear-phase windowed-sinc lowpass via FFT convolution."""
    if cutoff >= SR / 2 - 100:
        return x
    m = np.arange(taps) - (taps - 1) / 2
    h = np.sinc(2 * cutoff / SR * m) * np.hamming(taps)
    h /= h.sum()
    n = len(x) + taps - 1
    nfft = 1 << (n - 1).bit_length()
    X = np.fft.rfft(x, nfft)
    Hf = np.fft.rfft(h, nfft)
    y = np.fft.irfft(X * Hf, nfft)[:n]
    off = (taps - 1) // 2
    return y[off:off + len(x)]


def fir_highpass(x, cutoff, taps=127):
    return x - fir_lowpass(x, cutoff, taps)


def echo(x, delay_s, fb=0.35, mix=0.4, tail_s=2.0):
    d = int(delay_s * SR)
    n = len(x) + int(tail_s * SR)
    y = np.zeros(n)
    y[:len(x)] = x
    out = y.copy()
    buf = y.copy()
    g = mix
    for k in range(1, 6):
        shifted = np.zeros(n)
        s = d * k
        if s >= n:
            break
        shifted[s:] = buf[:n - s] * (fb ** (k - 1)) * g
        out += shifted
    return out


def small_room(x, tail_s=1.2):
    """Cheap 'space': a few decaying comb delays, lowpassed."""
    n = len(x) + int(tail_s * SR)
    out = np.zeros(n)
    out[:len(x)] += x
    for ds, g in ((0.031, 0.28), (0.047, 0.22), (0.061, 0.17), (0.089, 0.12)):
        d = int(ds * SR)
        out[d:d + len(x)] += fir_lowpass(x, 4200) * g
    return out


def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / math.tanh(max(drive, 1e-6))


def normalize(x, peak=0.86):
    m = np.max(np.abs(x)) or 1.0
    return x * (peak / m)


def vinyl(n, crackle_rate=1.6, hiss=0.0035, level=1.0):
    """Sparse crackle impulses + gentle hiss."""
    out = rng.normal(0, hiss, n)
    n_cr = int(crackle_rate * n / SR)
    idx = rng.integers(0, max(1, n - 50), max(1, n_cr))
    for i in idx:
        amp = rng.uniform(0.02, 0.09)
        w = rng.integers(8, 40)
        out[i:i + w] += amp * np.hanning(w)[: len(out[i:i + w])] * rng.choice([-1, 1])
    return fir_lowpass(out, 6000) * level


# ───────────────────────── instruments ─────────────────────────
# each: f(freq, dur_s, vel) → mono array (may be longer than dur for release)

def i_musicbox(freq, dur, vel):
    n = int((dur + 1.6) * SR)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * freq * t)
         + 0.42 * np.sin(2 * np.pi * freq * 2.01 * t)
         + 0.18 * np.sin(2 * np.pi * freq * 4.02 * t)
         + 0.06 * np.sin(2 * np.pi * freq * 6.3 * t))
    x *= env_exp(n, 0.45) * vel
    ping = rng.normal(0, 1, 300) * np.hanning(300) * 0.05 * vel
    x[:300] += fir_highpass(np.pad(ping, (0, 0)), 3000, 63)[:300]
    return x


def i_piano(freq, dur, vel):
    n = int((dur + 1.8) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for det, g in ((1.0, 1.0), (1.0015, 0.55), (0.9985, 0.55)):
        x += g * np.sign(np.sin(2 * np.pi * freq * det * t)) * 0.3
        x += g * np.sin(2 * np.pi * freq * det * t) * 0.7
    x += 0.25 * np.sin(2 * np.pi * freq * 2 * t) * env_exp(n, 0.3)
    x *= env_exp(n, max(0.5, dur * 0.9)) * vel
    x = fir_lowpass(x, min(5200, freq * 7))
    th = rng.normal(0, 1, 240) * np.hanning(240) * 0.10 * vel
    x[:240] += fir_lowpass(np.pad(th, (0, 0)), 900, 63)[:240]
    return x


def i_pluck(freq, dur, vel):
    """Karplus-Strong string."""
    n = int((dur + 1.0) * SR)
    period = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, period)
    out = np.zeros(n)
    damp = 0.996 if freq < 400 else 0.992
    prev = 0.0
    for i in range(n):
        v = buf[i % period]
        out[i] = v
        nv = damp * 0.5 * (v + prev)
        prev = v
        buf[i % period] = nv
    out *= env_exp(n, max(0.4, dur)) * vel
    return fir_lowpass(out, 6500)


def i_glock(freq, dur, vel):
    n = int((dur + 1.4) * SR)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * freq * t)
         + 0.5 * np.sin(2 * np.pi * freq * 2.76 * t) * env_exp(n, 0.12)
         + 0.25 * np.sin(2 * np.pi * freq * 5.4 * t) * env_exp(n, 0.06))
    x *= env_exp(n, 0.9) * vel
    return x


def i_pad(freq, dur, vel):
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for det in (0.996, 1.0, 1.004):
        ph = rng.uniform(0, 2 * np.pi)
        x += ((t * freq * det * 2) % 2 - 1)  # saw
        x += 0.4 * np.sin(2 * np.pi * freq * det * t + ph)
    x = fir_lowpass(x, max(500, freq * 3.2))
    x *= env_adsr(n, a=min(0.8, dur * 0.4), d=0.3, s=0.8, r=1.0) * vel * 0.35
    return x


def i_humchoir(freq, dur, vel):
    n = int((dur + 1.5) * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 4.6 * t + rng.uniform(0, 6))
    x = np.zeros(n)
    for det, g in ((1.0, 1.0), (1.007, 0.6), (0.993, 0.6), (2.0, 0.18)):
        x += g * np.sin(2 * np.pi * freq * det * t * vib)
    x = fir_lowpass(x, 900)
    x *= env_adsr(n, a=min(0.9, dur * 0.5), d=0.2, s=0.85, r=1.2) * vel * 0.5
    return x


def i_accordion(freq, dur, vel):
    n = int((dur + 0.4) * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t)
    x = np.zeros(n)
    for det, g in ((1.0, 1.0), (1.004, 0.7)):
        ph = 2 * np.pi * freq * det * np.cumsum(vib) / SR
        x += g * (2 * ((ph / (2 * np.pi)) % 1) - 1) * 0.5
        x += g * np.sign(np.sin(ph)) * 0.3
    trem = 1 + 0.12 * np.sin(2 * np.pi * 5.2 * t)
    x = fir_lowpass(x, 2800) * trem
    x *= env_adsr(n, a=0.06, d=0.1, s=0.85, r=0.25) * vel * 0.55
    return x


def i_square(freq, dur, vel):
    n = int((dur + 0.25) * SR)
    t = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * freq * t)) * 0.6 + 0.4 * np.sin(2 * np.pi * freq * t)
    x = fir_lowpass(x, 3800)
    x *= env_adsr(n, a=0.008, d=0.08, s=0.75, r=0.12) * vel * 0.6
    return x


def i_bass(freq, dur, vel):
    n = int((dur + 0.3) * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2 * t)
    x *= env_adsr(n, a=0.01, d=0.15, s=0.7, r=0.2) * vel * 0.8
    return fir_lowpass(x, 900)


def i_strings(freq, dur, vel):
    n = int((dur + 0.6) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for det in (0.995, 1.0, 1.006):
        x += ((t * freq * det * 2) % 2 - 1)
    x = fir_lowpass(x, max(1400, freq * 4))
    x *= env_adsr(n, a=0.05, d=0.1, s=0.9, r=0.3) * vel * 0.4
    return x


def d_kick(vel=1.0):
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = 130 * np.exp(-t * 26) + 42
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.05) * vel
    return x


def d_tick(vel=1.0):
    n = int(0.05 * SR)
    x = rng.normal(0, 1, n) * env_exp(n, 0.012) * vel * 0.5
    return fir_highpass(x, 4000, 63)


def d_snare(vel=1.0):
    n = int(0.14 * SR)
    x = rng.normal(0, 1, n) * env_exp(n, 0.035) * vel * 0.6
    t = np.arange(n) / SR
    x += 0.4 * np.sin(2 * np.pi * 190 * t) * env_exp(n, 0.03) * vel
    return fir_highpass(x, 900, 63)


INSTR = {
    'musicbox': i_musicbox, 'piano': i_piano, 'pluck': i_pluck, 'glock': i_glock,
    'pad': i_pad, 'hum': i_humchoir, 'accordion': i_accordion, 'square': i_square,
    'bass': i_bass, 'strings': i_strings,
}


# ───────────────────────── sequencer ─────────────────────────

def render(events, drum_events, bpm, loop_beats, swing=0.0, detune_cents=0.0):
    """events: (beat, dur_beats, note_or_name, vel, instr). Returns loop-ready mono."""
    spb = 60.0 / bpm
    loop_s = loop_beats * spb
    total = np.zeros(int(loop_s * SR) + int(3.5 * SR))
    for beat, dur, note, vel, instr in events:
        b = beat + (swing * 0.5 if (int(beat * 2) % 2 == 1) else 0)
        t0 = int(b * spb * SR)
        nmid = N(note) if isinstance(note, str) else note
        f = midi(nmid) * (2 ** (detune_cents / 1200))
        x = INSTR[instr](f, dur * spb, vel)
        end = min(len(total), t0 + len(x))
        if t0 < len(total):
            total[t0:end] += x[: end - t0]
    for beat, kind, vel in drum_events:
        t0 = int(beat * spb * SR)
        x = {'kick': d_kick, 'tick': d_tick, 'snare': d_snare}[kind](vel)
        end = min(len(total), t0 + len(x))
        if t0 < len(total):
            total[t0:end] += x[: end - t0]
    return total, int(loop_s * SR)


def fold_loop(x, loop_n):
    """Fold the tail past loop_n back onto the start → seamless loop.
    A short fade into the seam keeps percussive loops click-free (the restart
    then reads as a natural attack)."""
    out = x[:loop_n].copy()
    tail = x[loop_n:]
    m = min(len(tail), loop_n)
    out[:m] += tail[:m]
    return out


def to_stereo(x, width=0.012):
    d = int(width * SR)
    left = x
    right = np.roll(x, d)
    right[:d] *= np.linspace(0, 1, d)
    return np.stack([left, right], axis=1)


def write_wav(path, stereo):
    import struct
    import wave
    data = np.clip(stereo, -1, 1)
    pcm = (data * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(name, mono_or_stereo, outdir, keep_wav=False):
    x = mono_or_stereo
    if x.ndim == 1:
        x = to_stereo(x)
    os.makedirs(outdir, exist_ok=True)
    wav = os.path.join(outdir, f'{name}.wav')
    ogg = os.path.join(outdir, f'{name}.ogg')
    write_wav(wav, x)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', ogg], check=True)
    if not keep_wav:
        os.remove(wav)
    dur = len(x) / SR
    size = os.path.getsize(ogg) // 1024
    print(f'  {name:>16}  {dur:6.1f}s  {size:5d} KB')


# ───────────────────────── the leitmotif ─────────────────────────
# "Little Poppy-Flower" — 8-bar waltz phrase (3/4). Beats are 1-per-quarter.

def motif_a(oct_shift=0, vel=0.9):
    """Returns [(beat, dur, note, vel)] for the 8-bar A phrase (24 beats)."""
    s = 12 * oct_shift
    seq = [
        (0, 1, N('E4') + s, vel), (1, 1, N('G4') + s, vel), (2, 1, N('A4') + s, vel),
        (3, 2, N('G4') + s, vel), (5, 1, N('E4') + s, vel * 0.9),
        (6, 1, N('D4') + s, vel), (7, 1, N('E4') + s, vel), (8, 1, N('G4') + s, vel),
        (9, 3, N('E4') + s, vel),
        (12, 1, N('E4') + s, vel), (13, 1, N('G4') + s, vel), (14, 1, N('A4') + s, vel),
        (15, 2, N('C5') + s, vel), (17, 1, N('A4') + s, vel * 0.9),
        (18, 1, N('G4') + s, vel), (19, 1, N('E4') + s, vel), (20, 1, N('D4') + s, vel),
        (21, 3, N('C4') + s, vel),
    ]
    return seq


def motif_a_minor(oct_shift=0, vel=0.9):
    """A-phrase recolored to minor (E→E, G→G, A→A stays; C→C, but harmony minor;
    melodic tweak: A4→Ab4? Keep natural minor feel by lowering the 3rd where it lands)."""
    s = 12 * oct_shift
    seq = [
        (0, 1, N('E4') + s, vel), (1, 1, N('G4') + s, vel), (2, 1, N('A4') + s, vel),
        (3, 2, N('G4') + s, vel), (5, 1, N('E4') + s, vel * 0.9),
        (6, 1, N('D4') + s, vel), (7, 1, N('E4') + s, vel), (8, 1, N('F4') + s, vel),
        (9, 3, N('E4') + s, vel),
        (12, 1, N('E4') + s, vel), (13, 1, N('G4') + s, vel), (14, 1, N('A4') + s, vel),
        (15, 2, N('B4') + s, vel), (17, 1, N('A4') + s, vel * 0.9),
        (18, 1, N('G4') + s, vel), (19, 1, N('E4') + s, vel), (20, 1, N('B3') + s, vel),
        (21, 3, N('A3') + s, vel),
    ]
    return seq


CHORDS_A = [  # per bar (3 beats each): (root, third, fifth)
    ('C3', 'E3', 'G3'), ('C3', 'E3', 'G3'), ('G2', 'D3', 'B2'), ('C3', 'E3', 'G3'),
    ('A2', 'C3', 'E3'), ('F2', 'C3', 'A2'), ('G2', 'B2', 'D3'), ('C3', 'E3', 'G3'),
]
CHORDS_A_MIN = [
    ('A2', 'C3', 'E3'), ('A2', 'C3', 'E3'), ('E2', 'B2', 'G3'), ('A2', 'C3', 'E3'),
    ('A2', 'C3', 'E3'), ('D3', 'F3', 'A3'), ('E2', 'B2', 'G3'), ('A2', 'C3', 'E3'),
]


def waltz_accomp(chords, instr, bars_offset=0, vel=0.45, bass_instr='bass', bass_vel=0.7):
    """Oom-pah-pah: bass on 1, chord dyads on 2 and 3."""
    ev = []
    for i, (r, t3, t5) in enumerate(chords):
        b = (bars_offset + i) * 3
        ev.append((b, 1.2, N(r), bass_vel, bass_instr))
        for bb in (1, 2):
            ev.append((b + bb, 0.9, N(t3), vel, instr))
            ev.append((b + bb, 0.9, N(t5), vel * 0.9, instr))
    return ev


# ───────────────────────── tracks ─────────────────────────

def t_title():
    ev = []
    for rep in range(2):
        off = rep * 24
        for (b, d, n, v) in motif_a(1, 0.8):
            ev.append((b + off, d, n, v, 'musicbox'))
        if rep == 1:  # soft echo line a 6th below on the repeat
            for (b, d, n, v) in motif_a(0, 0.30):
                ev.append((b + off + 0.06, d, n, v, 'musicbox'))
    # faint pad roots
    for i, (r, t3, t5) in enumerate(CHORDS_A * 2):
        ev.append((i * 3, 3, N(r) + 12, 0.16, 'pad'))
    x, loop = render(ev, [], bpm=76, loop_beats=48)
    x = echo(x, 60 / 76 * 0.75, fb=0.3, mix=0.22)
    x = fold_loop(x, loop)
    x += vinyl(loop, crackle_rate=1.1, hiss=0.002)
    return normalize(soft_clip(x, 1.1), 0.8)


def t_cottage():
    """A + A' — second pass adds a music-box echo an octave up and pad roots."""
    ev = []
    def phrase(off, mb=False):
        for (b, d, n, v) in motif_a_minor(0, 0.55):
            ev.append((off + b * 2, d * 2, n, v, 'piano'))
            if mb:
                ev.append((off + b * 2 + 0.05, d * 1.6, n + 12, 0.20, 'musicbox'))
        for i, (r, t3, t5) in enumerate(CHORDS_A_MIN):
            ev.append((off + i * 6, 4, N(r) - 12, 0.5, 'piano'))
            ev.append((off + i * 6 + 3, 2.4, N(t3), 0.28, 'piano'))
            if mb:
                ev.append((off + i * 6, 6, N(r) + 12, 0.11, 'pad'))
    phrase(0)
    phrase(48, mb=True)
    x, loop = render(ev, [], bpm=66, loop_beats=96)
    x = small_room(x)
    x = fold_loop(x, loop)
    x += vinyl(loop, crackle_rate=2.2, hiss=0.004)
    return normalize(x, 0.72)


def t_harbor():
    """A · A(echo) · B (glockenspiel takes the tune, chords turn) · A(echo)."""
    ev = []
    CHORDS_B = [('A2', 'C3', 'E3'), ('F2', 'C3', 'A2'), ('C3', 'E3', 'G3'), ('G2', 'B2', 'D3')] * 2
    SPARK = [(9.5, 0.5, 'G5', 0.5), (10, 0.5, 'E5', 0.45), (10.5, 1, 'C5', 0.4),
             (21.5, 0.5, 'E5', 0.5), (22, 0.5, 'G5', 0.45), (22.5, 1, 'C6', 0.4)]
    def section(off, mel_instr, chords, sparkle=False, echo=False, vel=0.85):
        for (b, d, n, v) in motif_a(0, vel):
            ev.append((off + b, d, n, v, mel_instr))
            if echo:
                ev.append((off + b + 0.07, d, n + 12, v * 0.32, 'glock'))
        ev.extend(waltz_accomp(chords, 'pluck', bars_offset=off // 3, vel=0.38))
        if sparkle:
            for (b, d, n, v) in SPARK:
                ev.append((off + b, d, N(n), v, 'glock'))
    section(0, 'pluck', CHORDS_A, sparkle=True)
    section(24, 'pluck', CHORDS_A, sparkle=True, echo=True)
    section(48, 'glock', CHORDS_B, vel=0.58)
    section(72, 'pluck', CHORDS_A, sparkle=True, echo=True)
    x, loop = render(ev, [], bpm=104, loop_beats=96, swing=0.06)
    x = small_room(x, 0.8)
    x = fold_loop(x, loop)
    return normalize(x, 0.8)


def t_orchard():
    """Layers accrete per pass: arps → +hum → +glock motif → +pluck answer."""
    ev = []
    arp = [('F2', 'C3', 'A3', 'C4'), ('F2', 'C3', 'A3', 'C4'), ('C3', 'G3', 'E4', 'G3'), ('F2', 'C3', 'A3', 'C4'),
           ('D3', 'A3', 'F4', 'A3'), ('B2', 'F3', 'D4', 'F3'), ('C3', 'G3', 'E4', 'G3'), ('F2', 'C3', 'A3', 'C4')]
    for sec in range(4):
        off = sec * 24
        for i, chord in enumerate(arp):
            b0 = off + i * 3
            for k in range(6):
                note = chord[[0, 1, 2, 3, 2, 1][k]]
                ev.append((b0 + k * 0.5, 0.6, N(note), 0.4, 'pluck'))
        if sec >= 1:
            for i, chord in enumerate(arp):
                ev.append((off + i * 3, 3, N(chord[0]) + 24, 0.13, 'hum'))
        if sec == 2:
            for (b, d, n, v) in motif_a(1, 0.55):
                ev.append((off + b, d, n + 5, v, 'glock'))
        if sec == 3:
            for (b, d, n, v) in motif_a(0, 0.5):
                ev.append((off + b, d, n + 5, v, 'pluck'))
                ev.append((off + b + 0.08, d, n + 17, 0.2, 'glock'))
    x, loop = render(ev, [], bpm=92, loop_beats=96)
    x = small_room(x, 1.0)
    x = fold_loop(x, loop)
    return normalize(x, 0.78)


def t_sea():
    """A (accordion) · B (pluck takes the tune under the stars) · A (fuller)."""
    ev = []
    chords = [('D3', 'F3', 'A3'), ('D3', 'F3', 'A3'), ('A2', 'E3', 'C4'), ('D3', 'F3', 'A3'),
              ('B2', 'F3', 'D4'), ('G2', 'D3', 'B3'), ('A2', 'E3', 'C4'), ('D3', 'F3', 'A3')]
    mel = [(0, 2, 'D4'), (2, 1, 'F4'), (3, 2, 'A4'), (5, 1, 'G4'), (6, 2, 'F4'), (8, 1, 'E4'),
           (9, 3, 'D4'), (12, 2, 'F4'), (14, 1, 'A4'), (15, 2, 'C5'), (17, 1, 'A4'),
           (18, 1, 'G4'), (19, 1, 'F4'), (20, 1, 'E4'), (21, 3, 'D4')]
    for sec in range(4):
        off = sec * 24
        ev.extend(waltz_accomp(chords, 'pluck', bars_offset=off // 3, vel=0.34, bass_vel=0.75))
        if sec in (0, 1):
            for (b, d, n) in mel:
                ev.append((off + b, d, N(n), 0.5 if sec == 0 else 0.56, 'accordion'))
        elif sec == 2:
            for (b, d, n) in mel:
                ev.append((off + b, d, N(n) + 12, 0.42, 'pluck'))
                ev.append((off + b + 0.06, d * 0.6, N(n) + 24, 0.18, 'glock'))
        else:
            for (b, d, n) in mel:
                ev.append((off + b, d, N(n), 0.6, 'accordion'))
                ev.append((off + b + 0.05, d, N(n) + 12, 0.2, 'glock'))
    x, loop = render(ev, [], bpm=88, loop_beats=96)
    n = loop
    t = np.arange(n) / SR
    wash = rng.normal(0, 1, n)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * t / (60 / 88 * 12) - 1.2)
    wash = fir_lowpass(wash, 700) * lfo * 0.05
    x = small_room(x, 0.9)
    x = fold_loop(x, loop) + wash
    return normalize(x, 0.78)


def t_white():
    """The horror version: lullaby at half speed, two detuned music boxes,
    one wrong note, low drone, static."""
    ev = []
    for (b, d, n, v) in motif_a(0, 0.5):
        nn = n + (1 if b == 15 else 0)  # the wrong note, once
        ev.append((b * 2, d * 2.4, nn, v, 'musicbox'))
    x1, loop = render(ev, [], bpm=60, loop_beats=48, detune_cents=-27)
    ev2 = [(b * 2 + 0.13, d * 2.4, n, v * 0.8, 'musicbox') for (b, d, n, v) in motif_a(0, 0.5)]
    x2, _ = render(ev2, [], bpm=60, loop_beats=48, detune_cents=31)
    n = len(x1)
    t = np.arange(n) / SR
    drone = (np.sin(2 * np.pi * 55 * t) + np.sin(2 * np.pi * 55.7 * t)) * 0.16
    drone *= 0.6 + 0.4 * np.sin(2 * np.pi * t / 13)
    x = x1 + x2 + fir_lowpass(drone, 220)
    x = echo(x, 1.1, fb=0.45, mix=0.3, tail_s=3.0)
    x = fold_loop(x, loop)
    stat = rng.normal(0, 1, loop)
    gate = (rng.random(loop) < 0.0012).astype(float)
    gate = fir_lowpass(gate, 8) * 40
    x += fir_highpass(stat, 2500) * np.clip(gate, 0, 1) * 0.05
    x += vinyl(loop, crackle_rate=3.5, hiss=0.006)
    return normalize(x, 0.72)


def t_battle():
    """32 bars: the 16-bar chip tune, then again with the lead an octave up
    and busier drums."""
    ev = []
    bpm = 122
    bars = 32
    prog = [('C3', 'E3', 'G3'), ('A2', 'C3', 'E3'), ('F2', 'A2', 'C3'), ('G2', 'B2', 'D3')] * 8
    for i, (r, t3, t5) in enumerate(prog):
        b = i * 4
        for k in range(8):
            ev.append((b + k * 0.5, 0.5, N(r) + (12 if k % 2 else 0), 0.5, 'bass'))
        ev.append((b + 1.5, 0.5, N(t3) + 12, 0.3, 'square'))
        ev.append((b + 3.5, 0.5, N(t5) + 12, 0.3, 'square'))
    lead = [(0, .5, 'E5'), (.5, .5, 'G5'), (1, .5, 'A5'), (1.5, 1, 'G5'), (2.5, .5, 'E5'),
            (3, .5, 'D5'), (3.5, .5, 'E5'), (4, .5, 'G5'), (4.5, 1.5, 'E5'),
            (8, .5, 'E5'), (8.5, .5, 'G5'), (9, .5, 'A5'), (9.5, 1, 'C6'), (10.5, .5, 'A5'),
            (11, .5, 'G5'), (11.5, .5, 'E5'), (12, .5, 'D5'), (12.5, 1.5, 'C5'),
            (16, .5, 'C5'), (16.5, .5, 'C5'), (17, .5, 'E5'), (17.5, .5, 'G5'), (18, 1, 'A5'),
            (19, .5, 'G5'), (19.5, .5, 'E5'), (20, 2, 'G5'),
            (24, .5, 'A5'), (24.5, .5, 'G5'), (25, .5, 'E5'), (25.5, .5, 'D5'), (26, 1, 'E5'),
            (27, .5, 'D5'), (27.5, .5, 'C5'), (28, 2, 'C5')]
    for (b, d, n) in lead:
        ev.append((b, d, N(n), 0.5, 'square'))
        ev.append((b + 32, d, N(n), 0.5, 'square'))
        ev.append((b + 64, d, N(n) + 12, 0.42, 'square'))
        ev.append((b + 96, d, N(n) + 12, 0.42, 'square'))
        if b + 96 >= 96:
            ev.append((b + 96 + 0.06, d, N(n), 0.2, 'glock'))
    dr = []
    for bar in range(bars):
        b = bar * 4
        dr += [(b, 'kick', 1.0), (b + 1, 'tick', 0.7), (b + 1.5, 'tick', 0.5), (b + 2, 'snare', 0.9),
               (b + 2.5, 'kick', 0.7), (b + 3, 'tick', 0.7), (b + 3.5, 'tick', 0.5)]
        if bar >= 16:
            dr += [(b + 0.5, 'tick', 0.4), (b + 3.75, 'tick', 0.45)]
        if bar % 8 == 7:
            dr += [(b + 3, 'snare', 0.7), (b + 3.5, 'snare', 0.85)]
    x, loop = render(ev, dr, bpm=bpm, loop_beats=bars * 4)
    x = fold_loop(x, loop)
    return normalize(soft_clip(x, 1.3), 0.78)


def t_boss():
    ev = []
    bpm = 148
    chords = [('A2', 'C3', 'E3'), ('A2', 'C3', 'E3'), ('F2', 'A2', 'C3'), ('E2', 'Ab2', 'B2'),
              ('A2', 'C3', 'E3'), ('D3', 'F3', 'A3'), ('E2', 'Ab2', 'B2'), ('A2', 'C3', 'E3')] * 2
    for i, (r, t3, t5) in enumerate(chords):
        b = i * 3
        ev.append((b, 1, N(r) - 12, 0.95, 'bass'))
        ev.append((b + 1, 1, N(t3), 0.5, 'strings'))
        ev.append((b + 1, 1, N(t5), 0.45, 'strings'))
        ev.append((b + 2, 1, N(t3) + 12, 0.5, 'strings'))
        ev.append((b + 2, 1, N(t5) + 12, 0.45, 'strings'))
    for rep in range(2):
        for (b, d, n, v) in motif_a_minor(1, 0.72):
            ev.append((b + rep * 24, d, n, v, 'strings'))
    # chromatic dread line under second half
    creep = [(24, 3, 'A2'), (27, 3, 'Bb2'), (30, 3, 'B2'), (33, 3, 'C3'), (36, 3, 'B2'), (39, 3, 'Bb2'), (42, 6, 'A2')]
    for (b, d, n) in creep:
        ev.append((b, d, N(n) + 12, 0.35, 'pad'))
    dr = []
    for bar in range(16):
        b = bar * 3
        dr += [(b, 'kick', 1.0), (b + 1, 'tick', 0.6), (b + 2, 'tick', 0.6)]
        if bar % 4 == 3:
            dr += [(b + 2.5, 'snare', 0.8)]
    x, loop = render(ev, dr, bpm=bpm, loop_beats=48)
    x = fold_loop(x, loop)
    return normalize(soft_clip(x, 1.25), 0.78)


def t_fog():
    ev = []
    frag1 = [(0, 1, 'E5'), (1, 1, 'G5'), (2, 1, 'A5'), (3, 3, 'G5')]
    frag2 = [(9, 1, 'E5'), (10, 1, 'D5'), (11, 4, 'C5')]
    frag3 = [(18, 1, 'E5'), (19, 1, 'G5'), (20, 1, 'A5'), (21, 2, 'C6'), (23, 4, 'A5')]
    frag4 = [(30, 1, 'G5'), (31, 1, 'E5'), (32, 1, 'D5'), (33, 5, 'C5')]
    for fr in (frag1, frag2, frag3, frag4):
        for (b, d, n) in fr:
            ev.append((b, d, N(n), 0.42, 'piano'))
    ev.append((12, 6, N('C3'), 0.25, 'piano'))
    ev.append((26, 6, N('A2'), 0.25, 'piano'))
    x, loop = render(ev, [], bpm=60, loop_beats=40)
    x = echo(x, 0.9, fb=0.5, mix=0.35, tail_s=3)
    x = small_room(x, 1.5)
    x = fold_loop(x, loop)
    x += vinyl(loop, crackle_rate=1.6, hiss=0.005)
    return normalize(x, 0.7)


def t_ending():
    ev = []
    # full warm arrangement: piano lead, pad + hum, glock echoes, both phrases
    for (b, d, n, v) in motif_a(0, 0.8):
        ev.append((b, d, n, v, 'piano'))
    for (b, d, n, v) in motif_a(1, 0.75):
        ev.append((b + 24, d, n, v, 'piano'))
        ev.append((b + 24.05, d, n - 24, 0.2, 'glock'))
    for rep in range(2):
        for i, (r, t3, t5) in enumerate(CHORDS_A):
            b = rep * 24 + i * 3
            ev.append((b, 3, N(r) - 12, 0.6, 'piano'))
            ev.append((b, 3, N(r) + 12, 0.16, 'pad'))
            if rep == 1:
                ev.append((b, 3, N(t3) + 12, 0.16, 'hum'))
                ev.append((b, 3, N(t5), 0.13, 'hum'))
    x, loop = render(ev, [], bpm=84, loop_beats=48)
    x = small_room(x, 1.4)
    x = fold_loop(x, loop)
    return normalize(x, 0.8)


def t_gameover():
    ev = [(0, 2, N('E4'), 0.5, 'musicbox'), (2, 2, N('C4'), 0.45, 'musicbox'),
          (4, 2, N('B3'), 0.4, 'musicbox'), (6, 5, N('A3'), 0.42, 'musicbox'),
          (0, 8, N('A2'), 0.2, 'pad')]
    x, loop = render(ev, [], bpm=60, loop_beats=12)
    x = echo(x, 1.0, fb=0.4, mix=0.3)
    x = fold_loop(x, loop)
    x += vinyl(loop, 1.5, 0.004)
    return normalize(x, 0.7)


TRACKS = {
    'mus_title': t_title, 'mus_cottage': t_cottage, 'mus_harbor': t_harbor,
    'mus_orchard': t_orchard, 'mus_sea': t_sea, 'mus_white': t_white,
    'mus_battle': t_battle, 'mus_boss': t_boss, 'mus_fog': t_fog,
    'mus_ending': t_ending, 'mus_gameover': t_gameover,
}


# ───────────────────────── SFX ─────────────────────────

def blip(freq, dur=0.055, kind='square'):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * freq * t)) if kind == 'square' else np.sin(2 * np.pi * freq * t)
    return x * env_adsr(n, 0.004, 0.02, 0.6, 0.02) * 0.5


def s_blip1(): return blip(880)
def s_blip2(): return blip(660)
def s_blip3(): return blip(440, kind='sine') * 1.2
def s_blip4(): return blip(550, 0.05, 'sine')


def s_ok():
    return np.concatenate([blip(660, 0.05, 'sine'), blip(990, 0.07, 'sine')]) * 0.9


def s_cancel():
    return np.concatenate([blip(660, 0.05, 'sine'), blip(440, 0.08, 'sine')]) * 0.8


def s_move():
    return blip(1200, 0.03, 'sine') * 0.5


def s_talk():
    return blip(520, 0.045, 'sine') * 0.7


def s_hit():
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    f = 220 * np.exp(-t * 18) + 60
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.06)
    x += fir_highpass(rng.normal(0, 1, n), 1500) * env_exp(n, 0.02) * 0.5
    return soft_clip(x * 1.4, 1.5) * 0.8


def s_heal():
    parts = [blip(midi(N(x)), 0.09, 'sine') for x in ('C5', 'E5', 'G5')]
    x = np.concatenate(parts)
    return echo(x, 0.09, 0.3, 0.3, 0.4)[:int(0.7 * SR)] * 0.8


def s_remind():
    notes = ['C5', 'E5', 'G5', 'C6', 'E6']
    x = np.zeros(int(1.4 * SR))
    for i, nn in enumerate(notes):
        y = i_musicbox(midi(N(nn)), 0.12, 0.8)
        t0 = int(i * 0.07 * SR)
        x[t0:t0 + len(y)] += y[: len(x) - t0]
    return normalize(x, 0.7)


def s_fade():
    n = int(0.8 * SR)
    x = rng.normal(0, 1, n)
    t = np.arange(n) / SR
    x = fir_lowpass(x, 2000) * np.exp(-t * 3.5)
    sweep = np.sin(2 * np.pi * (600 * np.exp(-t * 2.2)) * t) * 0.3 * np.exp(-t * 3)
    return (x * 0.5 + sweep) * 0.8


def s_flutter():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    fl = (np.sin(2 * np.pi * 26 * t) > 0).astype(float)
    x = rng.normal(0, 1, n) * fl
    return fir_lowpass(x, 1800) * env_adsr(n, 0.02, 0.1, 0.7, 0.15) * 0.5


def s_static():
    n = int(0.5 * SR)
    x = rng.normal(0, 1, n)
    gate = (rng.random(n) < 0.4).astype(float)
    return fir_highpass(x * gate, 1200) * env_adsr(n, 0.01, 0.1, 0.8, 0.1) * 0.5


def s_lamp():
    n = int(1.8 * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for nn, g in (('C3', 0.8), ('G3', 0.6), ('E4', 0.5), ('C5', 0.35)):
        x += np.sin(2 * np.pi * midi(N(nn)) * t) * g
    x *= env_adsr(n, 1.1, 0.2, 0.9, 0.5) * 0.4
    return fir_lowpass(x, 2400)


def s_save():
    x = np.zeros(int(1.0 * SR))
    for i, nn in enumerate(('G5', 'C6')):
        y = i_glock(midi(N(nn)), 0.3, 0.7)
        t0 = int(i * 0.12 * SR)
        x[t0:t0 + len(y)] += y[: len(x) - t0]
    return normalize(x, 0.65)


def s_battlestart():
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    swoosh = fir_lowpass(rng.normal(0, 1, n), 2500) * np.exp(-((t - 0.18) ** 2) / 0.012)
    f = 90 + 500 * np.exp(-t * 9)
    stab = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * env_exp(n, 0.12) * 0.5
    return soft_clip(swoosh * 0.8 + stab, 1.4) * 0.8


def s_unravel():
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = 500 * np.exp(-t * 4) + 60
    x = ((np.cumsum(f) / SR * 2) % 2 - 1) * env_exp(n, 0.3)
    x += fir_highpass(rng.normal(0, 1, n), 2500) * env_exp(n, 0.15) * 0.3
    return fir_lowpass(x, 3000) * 0.75


def s_levelup():
    x = np.zeros(int(1.3 * SR))
    for i, nn in enumerate(('C5', 'E5', 'G5', 'C6')):
        y = i_glock(midi(N(nn)), 0.25, 0.8)
        t0 = int(i * 0.11 * SR)
        x[t0:t0 + len(y)] += y[: len(x) - t0]
    y = i_pad(midi(N('C4')), 0.9, 0.8)
    x[: len(y)] += y[: len(x)] * 0.4
    return normalize(x, 0.7)


def s_item():
    return np.concatenate([blip(500, 0.04, 'sine'), blip(750, 0.09, 'sine')]) * 0.7


def s_waves():
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    x = rng.normal(0, 1, n)
    lfo = 0.4 + 0.6 * np.sin(2 * np.pi * t / 2.6 - 1.4) ** 2
    return fir_lowpass(x, 800) * lfo * 0.35


SFX = {
    'sfx_blip1': s_blip1, 'sfx_blip2': s_blip2, 'sfx_blip3': s_blip3, 'sfx_blip4': s_blip4,
    'sfx_ok': s_ok, 'sfx_cancel': s_cancel, 'sfx_move': s_move, 'sfx_talk': s_talk,
    'sfx_hit': s_hit, 'sfx_heal': s_heal, 'sfx_fade': s_fade, 'sfx_remind': s_remind,
    'sfx_flutter': s_flutter, 'sfx_static': s_static, 'sfx_lamp': s_lamp, 'sfx_save': s_save,
    'sfx_battlestart': s_battlestart, 'sfx_unravel': s_unravel, 'sfx_levelup': s_levelup,
    'sfx_item': s_item, 'sfx_waves': s_waves,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only')
    ap.add_argument('--wav', action='store_true')
    args = ap.parse_args()

    print('music:')
    for name, fn in TRACKS.items():
        if args.only and args.only not in name:
            continue
        x = fn()
        encode(name, x, OUT_MUSIC, keep_wav=args.wav)
    print('sfx:')
    for name, fn in SFX.items():
        if args.only and args.only not in name:
            continue
        x = fn()
        encode(name, x, OUT_SFX, keep_wav=args.wav)
    print('done.')


if __name__ == '__main__':
    main()
