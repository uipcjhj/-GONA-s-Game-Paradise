"""GONA's Sky Adventure 오리지널 BGM 작곡 (악보를 코드로 기술) → public/assets/sky/audio/bgm-*.mp3
모든 선율·화성·리듬은 이 파일에서 새로 쓴 것 (기존 게임 음악의 선율·편곡을 옮기지 않음).
실행: python3 tools/sky-audio/songs.py
"""
import json
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from synth import (SR, Song, n2m, i_brass, i_lead, i_chip, i_bell, i_bass, i_guitar, i_strings, i_choir, i_organ,
                   d_kick, d_snare, d_hat, d_crash, d_tom, d_timpani, periodic_file, make_ir)

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'public', 'assets', 'sky', 'audio')
os.makedirs(OUT, exist_ok=True)

# 코드 이름 → 구성음(옥타브 4 기준 midi)
CH = {
    'Dm': ['D', 'F', 'A'], 'Bb': ['Bb', 'D', 'F'], 'C': ['C', 'E', 'G'], 'Am': ['A', 'C', 'E'], 'A': ['A', 'C#', 'E'],
    'Gm': ['G', 'Bb', 'D'], 'F': ['F', 'A', 'C'], 'D': ['D', 'F#', 'A'], 'Bm': ['B', 'D', 'F#'], 'G': ['G', 'B', 'D'],
    'F#m': ['F#', 'A', 'C#'], 'Cm': ['C', 'Eb', 'G'], 'Ab': ['Ab', 'C', 'Eb'], 'Db': ['Db', 'F', 'Ab'], 'Fm': ['F', 'Ab', 'C'],
    'G7': ['G', 'B', 'F'], 'Asus': ['A', 'D', 'E'], 'Eb': ['Eb', 'G', 'Bb'],
}


def tones(ch, octv):
    base = n2m(CH[ch][0] + str(octv))
    out = []
    for nm in CH[ch]:
        m = n2m(nm + str(octv))
        while m < base:
            m += 12
        out.append(m)
    return out


def root(ch, octv):
    return n2m(CH[ch][0] + str(octv))


def drums_rock(s, bar, fill=False, crash=False, half=False, v=1.0):
    st = s.st
    if crash:
        s.add(d_crash(0.9 * v), st(bar), pan=0.3, rev=0.3)
    kicks = [0, 8] if half else [0, 6, 8, 10]
    snares = [8] if half else [4, 12]
    for k in kicks:
        s.add(d_kick(v), st(bar, k), rev=0.05)
    for k in snares:
        if not (fill and k == 12):
            s.add(d_snare(v), st(bar, k), pan=-0.05, rev=0.25)
    for k in range(0, 16, 2):
        if not (fill and k >= 8):
            s.add(d_hat(0.8 * v, open_=(k == 14 and not half)), st(bar, k), pan=0.35, rev=0.1)
    if fill:
        for i, k in enumerate(range(8, 16)):
            if k % 2 == 0 and k >= 12:
                s.add(d_tom(52 - (k - 12) * 2, v), st(bar, k), pan=0.4 - (k - 8) * 0.1, rev=0.2)
            else:
                s.add(d_snare(0.55 + i * 0.06), st(bar, k), rev=0.2)


def bass_rock(s, bar, ch, octv=2, pattern='8th', v=1.0):
    r = root(ch, octv)
    if pattern == '8th':
        for k in range(0, 16, 2):
            m = r + (12 if k in (6, 14) else 0)
            s.add(i_bass(m, s.step * 1.7, v), s.st(bar, k), rev=0.05)
    elif pattern == '16th':
        for k in range(16):
            m = r + (12 if k % 4 == 2 else 0) + (7 if k in (14,) else 0)
            s.add(i_bass(m, s.step * 0.85, v * (1.0 if k % 4 == 0 else 0.8)), s.st(bar, k), rev=0.04)
    elif pattern == 'long':
        s.add(i_bass(r, s.step * 15, v), s.st(bar), rev=0.1)
    elif pattern == 'bounce':
        for k in range(0, 16, 2):
            m = r + (12 if k % 4 == 2 else 0)
            s.add(i_bass(m, s.step * 1.2, v), s.st(bar, k), rev=0.05)


def guitar_chug(s, bar, ch, v=1.0, accents=(0, 6, 12)):
    r = root(ch, 3)
    for k in range(0, 16, 2):
        acc = k in accents
        s.add(i_guitar(r, s.step * (3 if acc else 1.6), (1.0 if acc else 0.55) * v, mute=not acc), s.st(bar, k), pan=-0.45, rev=0.1)
        s.add(i_guitar(r, s.step * (3 if acc else 1.6), (1.0 if acc else 0.55) * v * 0.9, mute=not acc), s.st(bar, k) + 0.012, pan=0.45, rev=0.1)


def pad(s, bar, ch, inst=i_strings, octv=4, bars=1, v=1.0):
    for m in tones(ch, octv):
        s.add(inst(m, s.step * 16 * bars - 0.05, v), s.st(bar), pan=0.0, rev=0.45)


def arp(s, bar, ch, inst=i_chip, octv=5, v=0.6, rate=1, pan=0.3):
    t = tones(ch, octv)
    seq = t + [t[0] + 12] + t[::-1][1:] + [t[0]]
    k = 0
    while k < 16:
        s.add(inst(seq[(k // rate) % len(seq)], s.step * rate * 0.8, v), s.st(bar, k), pan=pan, rev=0.3)
        k += rate


def write(name, data, loop_len=None, pre=0.25):
    wav = os.path.join('/tmp', f'gona-{name}.wav')
    wavfile.write(wav, SR, (np.clip(data.T, -1, 1) * 32767).astype(np.int16))
    mp3 = os.path.join(OUT, f'bgm-{name}.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '128k', mp3], check=True)
    os.remove(wav)
    print(name, f'{data.shape[1] / SR:.2f}s', os.path.getsize(mp3) // 1024, 'KB')
    return {'loop': [pre, pre + loop_len]} if loop_len else {}


# ═════════ 스테이지 1: 황혼의 부유왕국 (D단조 판타지 록, 160bpm, 32마디) ═════════
def stage1():
    s = Song(160, 32)
    A = ['Dm', 'Bb', 'C', 'Am', 'Dm', 'Bb', 'C', 'A']
    B = ['Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Dm', 'C']
    Cc = ['F', 'C', 'Gm', 'Dm', 'Bb', 'F', 'Gm', 'A']
    prog = A + B + Cc + A
    melA = ['D5:2 A4:2 D5:2 E5:2 F5:4 E5:2 D5:2', 'D5:4 C5:2 Bb4:2 C5:4 D5:4', 'E5:2 C5:2 G4:2 C5:2 E5:4 G5:4', 'F5:6 E5:2 C5:4 A4:4',
            'D5:2 A4:2 D5:2 E5:2 F5:4 G5:2 A5:2', 'Bb5:4 A5:2 G5:2 F5:4 D5:4', 'E5:2 F5:2 G5:2 E5:2 C5:4 E5:4', 'A5:6 G5:2 E5:4 C#5:4']
    melB = ['F5:4 D5:4 Bb4:4 D5:4', 'G5:4 E5:4 C5:4 E5:4', 'A5:6 G5:2 F5:4 E5:4', 'D5:12 r:4',
            'Bb5:4 A5:2 G5:2 D5:4 G5:4', 'A5:4 G5:2 F5:2 E5:4 C#5:4', 'D5:2 F5:2 A5:2 D6:2 C6:4 A5:4', 'G5:4 E5:4 C5:4 G4:4']
    melC = ['C6:8 A5:8', 'G5:8 E5:8', 'Bb5:8 D6:8', 'A5:16', 'D6:4 C6:4 Bb5:4 A5:4', 'C6:8 F5:8', 'G5:4 A5:4 Bb5:4 D6:4', 'C#6:8 E6:8']
    for b, ch in enumerate(prog):
        sec = b // 8
        last = b % 8 == 7
        drums_rock(s, b, fill=last, crash=(b % 8 == 0), half=(sec == 2 and b % 8 < 6))
        bass_rock(s, b, ch, pattern='16th' if sec == 3 else '8th')
        if sec != 2:
            guitar_chug(s, b, ch, v=0.9 if sec == 0 else 1.0)
        else:
            s.add(i_guitar(root(ch, 3), s.step * 15, 0.7), s.st(b), pan=-0.4, rev=0.2)
        pad(s, b, ch, i_strings, 4, v=0.8 if sec != 2 else 1.1)
        if sec in (1, 3):
            arp(s, b, ch, i_chip, 5, v=0.35, rate=1)
        if sec == 2:
            arp(s, b, ch, i_bell, 5, v=0.5, rate=2, pan=-0.2)
    for i in range(8):
        s.melody(i_brass, i, melA[i], pan=0.05, gain=0.95)
        s.melody(i_brass, 8 + i, melB[i], pan=0.05, gain=0.95)
        s.melody(i_lead, 16 + i, melC[i], pan=0.15, gain=0.8)
        s.melody(i_strings, 16 + i, melC[i], octave=-12, pan=-0.2, gain=0.9)
        s.melody(i_lead, 24 + i, melA[i], pan=0.12, gain=0.85)
        s.melody(i_brass, 24 + i, melA[i], octave=-12, pan=-0.12, gain=0.55)  # 옥타브 아래 브라스 받침
    return s


# ═════════ 보스전 (C단조, 170bpm, 24마디) ═════════
def boss():
    s = Song(170, 24)
    P1 = ['Cm', 'Cm', 'Ab', 'Bb', 'Cm', 'Cm', 'Db', 'G7']
    P3 = ['Fm', 'Cm', 'Ab', 'G7', 'Fm', 'Cm', 'Db', 'G7']
    prog = P1 + P1 + P3
    mel1 = ['C5:3 C5:3 Eb5:2 D5:4 C5:4', 'G4:3 Ab4:3 B4:2 C5:8', 'Ab5:4 G5:2 F5:2 Eb5:4 C5:4', 'Bb4:4 D5:4 F5:4 Bb5:4',
            'C6:3 B5:3 C6:2 G5:4 Eb5:4', 'F5:2 Eb5:2 D5:2 C5:2 B4:4 G4:4', 'Db5:4 F5:4 Ab5:4 Db6:4', 'B5:8 G5:4 F5:2 D5:2']
    mel3 = ['F5:8 Ab5:8', 'G5:8 Eb5:8', 'C6:8 Ab5:8', 'B5:8 D6:8', 'F6:4 Eb6:4 C6:4 Ab5:4', 'G5:4 Eb5:4 C5:8', 'Db6:4 C6:4 Ab5:4 F5:4', 'G5:4 B5:4 D6:4 F6:4']
    for b, ch in enumerate(prog):
        sec = b // 8
        st = s.st
        if b % 4 == 0:
            s.add(d_crash(0.9), st(b), pan=0.3, rev=0.3)
        for k in range(16):
            if k % 4 == 0 or (k % 4 == 3 and sec > 0) or k in (6, 10):
                s.add(d_kick(0.95), st(b, k), rev=0.04)
            if k in (4, 12):
                s.add(d_snare(1.0), st(b, k), rev=0.25)
            s.add(d_hat(0.55 if k % 2 else 0.85), st(b, k), pan=0.35, rev=0.05)
        if b % 8 == 7:
            for k in range(8, 16):
                s.add(d_tom(50 - k, 0.9) if k % 2 == 0 else d_snare(0.7), st(b, k), rev=0.2)
        bass_rock(s, b, ch, octv=1 if ch in ('Db', 'Ab') else 2, pattern='16th', v=1.05)
        guitar_chug(s, b, ch, v=1.0, accents=(0, 3, 6, 10, 12))
        pad(s, b, ch, i_choir, 4, v=0.9)
        pad(s, b, ch, i_organ, 3, v=0.45)
        if sec == 1:
            arp(s, b, ch, i_chip, 5, v=0.3, rate=1, pan=-0.3)
    for i in range(8):
        s.melody(i_brass, i, mel1[i], octave=-12, gain=1.05, pan=0.05)
        s.melody(i_lead, 8 + i, mel1[i], gain=0.85, pan=0.1)
        s.melody(i_brass, 8 + i, mel1[i], octave=-12, gain=0.6, pan=-0.1)
        s.melody(i_lead, 16 + i, mel3[i], gain=0.85, pan=0.1)
        s.melody(i_strings, 16 + i, mel3[i], octave=-12, gain=1.0, pan=-0.2)
    return s


# ═════════ 타이틀 (D, 100bpm, 16마디: 신비 → 웅장) ═════════
def title():
    s = Song(100, 16)
    intro = ['Dm', 'Bb', 'Gm', 'Asus']
    main = ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G', 'A', 'Bb', 'C', 'D', 'D']
    prog = intro + main
    melM = ['D5:6 A4:2 D5:4 E5:4', 'F#5:8 E5:4 D5:4', 'B4:6 D5:2 G5:4 F#5:4', 'E5:12 A4:4', 'D5:6 A4:2 D5:4 F#5:4', 'A5:8 G5:4 F#5:4',
            'G5:4 B5:4 A5:4 G5:4', 'A5:16', 'F5:8 D5:8', 'E5:8 G5:8', 'F#5:4 A5:4 D6:8', 'D6:12 r:4']
    for b, ch in enumerate(prog):
        st = s.st
        if b < 4:
            pad(s, b, ch, i_choir, 4, v=0.8)
            s.add(i_strings(root(ch, 2), s.step * 15.5, 1.0), st(b), rev=0.5)
            arp(s, b, ch, i_bell, 5, v=0.55, rate=2, pan=-0.25)
            if b == 3:
                for k in range(0, 16):
                    s.add(d_timpani(38, 0.25 + k * 0.04), st(b, k), rev=0.4)
        else:
            pad(s, b, ch, i_strings, 4, v=1.0)
            pad(s, b, ch, i_choir, 4, v=0.5)
            s.add(i_bass(root(ch, 2), s.step * 7.5, 0.8), st(b), rev=0.2)
            s.add(i_bass(root(ch, 2), s.step * 7.5, 0.7), st(b, 8), rev=0.2)
            s.add(d_timpani(root(ch, 2), 0.9), st(b), rev=0.4)
            if b in (4, 8, 12):
                s.add(d_crash(0.7), st(b), pan=0.2, rev=0.5)
            s.add(d_snare(0.35), st(b, 12), rev=0.5)
            for k in (14, 15):
                s.add(d_snare(0.25), st(b, k), rev=0.5)
            arp(s, b, ch, i_chip, 5, v=0.22, rate=2, pan=0.35)
            s.melody(i_brass, b, melM[b - 4], gain=1.0, pan=0.05, rev=0.45)
            if b >= 8:
                s.melody(i_strings, b, melM[b - 4], octave=12, gain=0.55, pan=-0.2, rev=0.5)
    return s


# ═════════ 캐릭터 선택 (F, 160bpm, 8마디 · 경쾌) ═════════
def select():
    s = Song(160, 8)
    prog = ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C']
    mel = ['C5:2 F5:2 A5:2 F5:2 C6:4 A5:4', 'G5:2 E5:2 C5:2 E5:2 G5:4 C6:4', 'A5:2 F5:2 D5:2 F5:2 A5:2 C6:2 D6:4', 'Bb5:4 A5:2 G5:2 F5:4 D5:4',
           'C5:2 F5:2 A5:2 C6:2 F6:4 C6:4', 'E6:2 D6:2 C6:2 Bb5:2 A5:4 G5:4', 'F5:2 G5:2 A5:2 Bb5:2 D6:4 C6:4', 'C6:2 Bb5:2 A5:2 G5:2 E5:4 C5:4']
    for b, ch in enumerate(prog):
        st = s.st
        for k in (0, 4, 8, 12):
            s.add(d_kick(0.8), st(b, k), rev=0.03)
        for k in (4, 12):
            s.add(d_snare(0.75), st(b, k), rev=0.2)
        for k in range(16):
            s.add(d_hat(0.6 if k % 2 else 0.9, open_=(k % 4 == 2)), st(b, k), pan=0.3, rev=0.05)
        if b == 0:
            s.add(d_crash(0.6), st(b), rev=0.3)
        bass_rock(s, b, ch, pattern='bounce', v=0.9)
        for k in (2, 6, 10, 14):
            for m in tones(ch, 4):
                s.add(i_chip(m, s.step * 1.2, 0.35, duty=0.5), st(b, k), pan=-0.3, rev=0.15)
        arp(s, b, ch, i_bell, 6, v=0.25, rate=2, pan=0.4)
        s.melody(i_chip, b, mel[b], gain=1.0, pan=0.05, rev=0.2)
        s.melody(i_lead, b, mel[b], octave=-12, gain=0.35, pan=-0.05, rev=0.2)
    return s


# ═════════ 스테이지 클리어 팡파르 / 게임 오버 ═════════
def clear():
    s = Song(140, 3, loop=False, tail=2.4)
    st = s.st
    for k in range(0, 8):
        s.add(d_timpani(34, 0.4 + k * 0.08), st(0, k * 2 if k < 4 else 8 + (k - 4)), rev=0.4)
    s.melody(i_brass, 0, 'F4:2 Bb4:2 D5:2 F5:10', gain=1.0, rev=0.4)
    s.melody(i_brass, 0, 'D4:2 F4:2 Bb4:2 D5:10', gain=0.6, rev=0.4, pan=-0.2)
    s.melody(i_brass, 1, 'Eb5:2 F5:2 G5:2 A5:2 Bb5:8', gain=1.0, rev=0.4)
    s.melody(i_brass, 1, 'C5:2 D5:2 Eb5:2 F5:2 F5:8', gain=0.6, rev=0.4, pan=-0.2)
    for m in tones('Bb', 4) + [n2m('Bb3'), n2m('F5'), n2m('Bb5')]:
        s.add(i_strings(m, s.step * 18, 1.0), st(1, 8), rev=0.5)
    s.add(i_brass(n2m('Bb5'), s.step * 16, 0.9), st(2), rev=0.5)
    s.add(i_brass(n2m('D5'), s.step * 16, 0.6), st(2), rev=0.5, pan=-0.3)
    s.add(i_brass(n2m('F5'), s.step * 16, 0.6), st(2), rev=0.5, pan=0.3)
    s.add(d_crash(1.0), st(1, 8), rev=0.4)
    s.add(d_crash(1.0), st(2), rev=0.4)
    s.add(d_timpani(34, 1.0), st(2), rev=0.4)
    s.add(d_kick(1.0), st(2), rev=0.1)
    for k in range(0, 16, 2):
        s.add(i_bell(n2m(['Bb5', 'D6', 'F6', 'Bb6'][k // 2 % 4]), 0.2, 0.5), st(2, k), rev=0.4, pan=0.3)
    return s


def over():
    s = Song(84, 3, loop=False, tail=2.4)
    st = s.st
    s.melody(i_chip, 0, 'E5:3 D#5:3 D5:3 C#5:3 C5:4', gain=1.0, rev=0.35, legato=0.85)
    s.melody(i_brass, 1, 'A4:4 G4:4 E4:4 r:4', gain=0.9, rev=0.4)
    for m in [n2m('A2'), n2m('A3'), n2m('C4'), n2m('E4')]:
        s.add(i_strings(m, s.step * 22, 1.0), st(1, 8), rev=0.5)
        s.add(i_organ(m, s.step * 22, 0.6), st(1, 8), rev=0.5)
    s.add(i_brass(n2m('A3'), s.step * 20, 0.9), st(1, 12), rev=0.5)
    s.add(d_timpani(33, 1.0), st(1, 12), rev=0.5)
    s.add(d_crash(0.6), st(1, 12), rev=0.5)
    return s


if __name__ == '__main__':
    import sys
    only = sys.argv[1:]
    meta = {}
    ir = make_ir(1.9, 0.5)
    for name, fn in [('stage1', stage1), ('boss', boss), ('title', title), ('select', select), ('clear', clear), ('over', over)]:
        if only and name not in only:
            continue
        s = fn()
        out = s.render(ir)
        if s.loop:
            meta[name] = write(name, periodic_file(out), s.seconds)
        else:
            meta[name] = write(name, out)
    if not only:
        with open(os.path.join(ROOT, 'src', 'sky', 'audioLoops.ts'), 'w') as f:
            f.write('/** 자동 생성 (tools/sky-audio/songs.py) — BGM 반복 구간(초) */\n')
            f.write('const LOOPS: Record<string, { loop?: number[] }> = ' + json.dumps(meta) + ';\nexport default LOOPS;\n')
        print(json.dumps(meta))
