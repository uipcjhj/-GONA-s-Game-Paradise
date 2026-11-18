"""오프닝 시네마틱 음악 (약 32초 · 반복 없음) → src/sky/sound/bgm-opening.mp3
「서기 2026년, 고나의 대재앙」 — 판타지 영화 예고편 + 90년대 아케이드 오프닝
모든 소리는 synth.py 의 합성 악기로 새로 만든 것 (외부 샘플·기존 곡 없음).
장면 시각(초)은 src/sky/OpeningCinematic.tsx 의 SCENES 와 같아야 함:
  0 전설의 시작 · 4 풍요의 시대 · 8 재앙의 전조 · 13 막혀버린 세계 · 18 여섯 수호자 · 24 출격 · 29 타이틀
실행: python3 tools/sky-audio/opening.py
"""
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from synth import (SR, Song, n2m, mtof, saw, sine, noise, env, expdec, lp, hp, bp, i_brass, i_bell, i_strings, i_choir,
                   d_kick, d_snare, d_hat, d_crash, d_tom, d_timpani, make_ir)

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'src', 'sky', 'sound')
M = n2m


# ───────── 영화 예고편용 소리 (합성) ─────────
def drone(m, dur, v=1.0, a=1.5, r=1.5):
    """깊은 저음 지속음 (톱니 2개 + 서브 사인, 낮은 필터)"""
    n = int((dur + r) * SR)
    f = mtof(m)
    s = saw(f, n) + saw(f * 1.006, n) + 0.8 * sine(f / 2, n)
    s = lp(s, 380) * 0.35
    return s * env(n, a, 0.2, 1.0, r, dur) * v


def toll(m, v=1.0):
    """낮은 종소리: FM 종 + 저음 울림"""
    n = int(4.5 * SR)
    f = mtof(m)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 2.76 * t) * 3.0 * expdec(n, 0.6)
    s = np.sin(2 * np.pi * f * t + mod) * expdec(n, 1.6)
    s += 0.6 * np.sin(2 * np.pi * f * 0.5 * t) * expdec(n, 2.2)
    return s * 0.55 * v


def boom(v=1.0, f0=70, f1=28, tau=1.1):
    """영화식 충격음: 떨어지는 저음 사인 + 낮은 노이즈"""
    n = int(3.2 * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, tau)
    s += lp(noise(n), 500) * expdec(n, 0.25) * 0.7
    s += hp(noise(n), 2500) * expdec(n, 0.05) * 0.25
    return np.tanh(s * 1.6) * v


def heart(v=1.0):
    """심장박동 (두 번 쿵-쿵)"""
    def one(a):
        n = int(0.32 * SR)
        t = np.arange(n) / SR
        f = 42 + 30 * np.exp(-t / 0.03)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, 0.09) * a
    n = int(0.6 * SR)
    out = np.zeros(n)
    a = one(1.0)
    out[: len(a)] += a
    b = one(0.75)
    i = int(0.22 * SR)
    out[i: i + len(b)] += b[: n - i]
    return np.tanh(out * 2.0) * v


def riser(dur, v=1.0, f0=300, f1=6000):
    """긴장 상승음: 올라가는 대역 노이즈 + 올라가는 톱니"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = t / dur
    out = np.zeros(n)
    seg = int(0.05 * SR)
    nz = noise(n)
    for i in range(0, n, seg):
        fc = f0 * (f1 / f0) ** k[i]
        out[i: i + seg] = bp(nz[i: i + seg + 800], fc * 0.7, min(fc * 1.4, 18000))[: len(out[i: i + seg])]
    s = out * (k ** 2) * 0.8 + saw(110 * (2 ** (k * 2)), n) * 0.05 * k
    return s * v


def screech(dur=1.0, v=1.0):
    """열차 급정거 금속음"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 2400 - 900 * t / dur
    s = sine(f, n) * 0.4 + sine(f * 1.51, n) * 0.25 + bp(noise(n), 1800, 4200) * 0.5
    return s * env(n, 0.01, 0.1, 0.8, 0.25, dur) * 0.5 * v


def thunder(v=1.0):
    n = int(2.6 * SR)
    s = lp(noise(n), 900) * expdec(n, 0.7) + hp(noise(n), 3000) * expdec(n, 0.04) * 1.2
    return np.tanh(s * 1.4) * 0.7 * v


def chime(m, v=1.0):
    n = int(2.2 * SR)
    f = mtof(m)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * f * 4 * t) * 0.8 * expdec(n, 0.2)) * expdec(n, 0.7)
    return s * 0.35 * v


def whoosh(dur=0.35, v=1.0):
    n = int(dur * SR)
    k = np.linspace(0, 1, n)
    s = bp(noise(n), 600, 5000) * np.sin(np.pi * k) ** 2
    return s * 0.6 * v


def tremolo(x, rate=12.0, depth=0.6):
    t = np.arange(len(x)) / SR
    return x * (1 - depth + depth * (0.5 + 0.5 * np.sin(2 * np.pi * rate * t)))


def chord(s, inst, t, notes, dur, v=1.0, pan=0.0, rev=0.35):
    for i, nm in enumerate(notes):
        s.add(inst(M(nm), dur, v), t, pan=pan + (i - len(notes) / 2) * 0.12, rev=rev)


def build():
    s = Song(120, 17, loop=False, tail=1.5)  # 34초 + 꼬리
    A = s.add

    # ═ SCENE 01 전설의 시작 0~4s: 깊은 저음 · 종소리 · 신비로운 합창 ═
    A(drone(M('D1'), 4.2, 0.9, a=2.0), 0.0, rev=0.25)
    A(toll(M('D2'), 0.9), 0.15, rev=0.6)
    A(toll(M('A1'), 0.75), 2.1, rev=0.6)
    chord(s, i_choir, 1.0, ['D4', 'A4'], 3.0, 0.55, rev=0.6)
    A(i_bell(M('A5'), 1.5, 0.25), 3.2, pan=0.3, rev=0.7)

    # ═ SCENE 02 풍요의 시대 4~8s: 따뜻한 현악 · 성스러운 선율 → 끝에서 불길하게 ═
    for t, ch in [(4.0, ['F3', 'A3', 'C4', 'F4']), (5.0, ['Bb2', 'F3', 'D4', 'F4']), (6.0, ['F3', 'A3', 'C4', 'A4']), (7.0, ['C3', 'G3', 'E4', 'G4'])]:
        chord(s, i_strings, t, ch, 1.0 if t < 7 else 0.8, 0.95, rev=0.45)
    for t, nm, d in [(4.0, 'A5', 0.9), (5.0, 'D6', 0.9), (6.0, 'C6', 0.6), (6.6, 'A5', 0.4), (7.0, 'G5', 0.7)]:
        A(i_strings(M(nm), d, 1.1), t, pan=-0.2, rev=0.5)
        A(i_bell(M(nm), d, 0.22), t, pan=0.35, rev=0.6)
    A(drone(M('C#1'), 1.2, 0.9, a=0.6, r=0.6), 7.3, rev=0.3)  # 불길한 저음이 슬며시

    # ═ SCENE 03 재앙의 전조 8~13s: 심장박동 · 팀파니 · 긴장 고조 ═
    A(drone(M('D1'), 5.0, 1.0, a=0.3), 8.0, rev=0.2)
    trem = tremolo(sum(i_strings(M(nm), 4.8, 0.9) for nm in ('D3', 'A3', 'D4')), 11.0, 0.7)
    A(trem, 8.0, rev=0.3)
    for t in (8.2, 9.15, 10.0, 10.75, 11.4, 11.95, 12.45):
        A(heart(1.0), t, rev=0.1)
    for t, m in ((8.0, 'D2'), (9.6, 'D2'), (11.0, 'Eb2'), (12.1, 'D2'), (12.4, 'D2')):
        A(d_timpani(M(m), 1.0), t, rev=0.3)
    chord(s, i_choir, 10.0, ['D4', 'Eb4', 'A4'], 2.8, 0.7, rev=0.6)  # 불협 합창
    A(riser(2.6, 0.5), 10.1, rev=0.2)
    A(boom(1.0), 12.65, rev=0.35)  # 마지막 대사 · 화면 흔들림

    # ═ SCENE 04 막혀버린 세계 13~18s: 굉음 · 불길한 합창 · 위기감 ═
    A(boom(1.15, 80, 26, 1.4), 13.55, rev=0.4)  # 성문 닫힘
    A(d_crash(0.9), 13.55, rev=0.4)
    for t, ch in ((13.6, ['D3', 'F3', 'A3', 'D4']), (15.0, ['Bb2', 'D3', 'F3', 'Bb3']), (16.2, ['A2', 'C#3', 'E3', 'A3'])):
        chord(s, i_choir, t, ch, 1.3, 0.9, rev=0.55)
        chord(s, i_brass, t, [ch[0], ch[2]], 1.1, 0.55, rev=0.4)
    A(screech(0.9, 0.9), 14.35, pan=0.3, rev=0.3)  # 열차 급정거
    A(boom(0.7, 60, 30, 0.6), 14.75, rev=0.3)
    A(thunder(0.9), 15.55, pan=-0.3, rev=0.4)
    A(thunder(1.0), 16.45, pan=0.3, rev=0.4)
    A(drone(M('D1'), 4.2, 0.8, a=0.4, r=0.3), 13.5, rev=0.2)
    A(riser(1.0, 0.6, 400, 9000), 16.6, rev=0.1)
    A(boom(1.3, 90, 24, 1.3), 17.45, rev=0.5)  # 최후의 충격 → 암전

    # ═ SCENE 05 여섯 수호자의 각성 18~24s: 빛 여섯 개 · 관현악 상승 · 영웅 등장 ═
    for i, nm in enumerate(['D5', 'F5', 'A5', 'D6', 'F6', 'A6']):
        A(chime(M(nm), 0.9), 18.1 + i * 0.25, pan=-0.5 + i * 0.2, rev=0.6)
    seq = [('Dm', 19.6), ('Bb', 20.8), ('C', 22.0), ('D', 23.2)]
    CH = {'Dm': ['D3', 'F3', 'A3'], 'Bb': ['Bb2', 'D3', 'F3'], 'C': ['C3', 'E3', 'G3'], 'D': ['D3', 'F#3', 'A3']}
    for name, t in seq:
        chord(s, i_strings, t, CH[name], 1.2, 1.0, rev=0.35)
        chord(s, i_choir, t, [n[:-1] + str(int(n[-1]) + 1) for n in CH[name]], 1.2, 0.6, rev=0.5)
        for k in range(8):  # 16분 현악 오스티나토
            nm = CH[name][k % 3]
            A(i_strings(M(nm) + 12, 0.12, 0.7), t + k * 0.15, pan=0.4 if k % 2 else -0.4, rev=0.2)
    for i, t in enumerate((19.6, 20.2, 20.8, 21.4, 22.0, 22.6)):  # 수호자 한 명마다 타격 + 휙
        A(d_timpani(M('D2') + (i % 3) * 2, 0.9), t, rev=0.3)
        A(whoosh(0.3, 0.7), t - 0.18, pan=(-1) ** i * 0.5, rev=0.1)
    s.add(i_brass(M('D4'), 0.55, 0.9), 19.6, rev=0.4)
    for t, nm, d in [(19.6, 'A4', 0.55), (20.2, 'D5', 0.55), (20.8, 'F5', 0.55), (21.4, 'E5', 0.3), (21.7, 'D5', 0.3), (22.0, 'C5', 0.55),
                     (22.6, 'E5', 0.55), (23.2, 'F#5', 0.8)]:
        A(i_brass(M(nm), d, 0.95), t, pan=0.1, rev=0.35)
    for k in range(16):  # 스네어 롤 크레셴도
        A(d_snare(0.15 + k * 0.04), 23.2 + k * 0.05, rev=0.15)
    A(riser(1.2, 0.5), 22.8, rev=0.1)

    # ═ SCENE 06 운명의 출격 24~32s: 빠른 타악 · 브라스 · 대규모 절정 → 타이틀 ═
    A(d_crash(1.0), 24.0, rev=0.4)
    A(boom(0.8, 70, 30, 0.8), 24.0, rev=0.3)
    A(drone(M('D2'), 2.0, 0.6, a=0.2, r=0.4), 24.0, rev=0.3)
    chord(s, i_choir, 24.0, ['D4', 'A4', 'D5'], 1.8, 0.7, rev=0.6)  # 어둠 속 고나
    beat = 60 / 150  # 150bpm 행진
    for k in range(int((29.0 - 25.6) / (beat / 2))):
        t = 25.6 + k * beat / 2
        if k % 2 == 0:
            A(d_kick(0.9), t, rev=0.05)
        if k % 4 == 2:
            A(d_snare(0.85), t, rev=0.15)
        A(d_hat(0.5), t, pan=0.3, rev=0.05)
        if k % 8 == 7:
            A(d_tom(M('A2'), 0.8), t, rev=0.15)
    prog = [('D', 25.6), ('Bb', 26.4), ('C', 27.2), ('D', 28.0)]
    for name, t in prog:
        chord(s, i_strings, t, [n[:-1] + str(int(n[-1]) + 1) for n in CH[name]], 0.75, 1.0, rev=0.3)
        chord(s, i_brass, t, CH[name], 0.7, 0.75, rev=0.3)
    for t, nm, d in [(25.6, 'D5', 0.3), (25.9, 'A5', 0.5), (26.4, 'Bb5', 0.3), (26.7, 'F5', 0.5), (27.2, 'G5', 0.3), (27.5, 'E5', 0.3),
                     (27.8, 'C6', 0.2), (28.0, 'D6', 0.9)]:
        A(i_brass(M(nm), d, 1.0), t, rev=0.35)
    A(riser(1.6, 0.9, 300, 12000), 27.4, rev=0.1)  # 고나가 화면을 뚫고 날아옴
    A(whoosh(0.6, 1.0), 28.4, rev=0.1)
    # 29.0 타이틀 충격: 거대한 충격 + 전 관현악 D장조 화음
    A(boom(1.4, 100, 26, 1.6), 29.0, rev=0.5)
    A(d_crash(1.2), 29.0, rev=0.5)
    A(d_timpani(M('D2'), 1.2), 29.0, rev=0.4)
    chord(s, i_brass, 29.0, ['D3', 'A3', 'D4', 'F#4', 'A4'], 2.6, 1.0, rev=0.5)
    chord(s, i_strings, 29.0, ['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5'], 3.4, 1.1, rev=0.5)
    chord(s, i_choir, 29.0, ['D4', 'A4', 'D5', 'F#5'], 3.2, 0.9, rev=0.6)
    for k, t in enumerate((30.4, 30.6, 30.8)):  # 마무리 팡파르
        A(d_timpani(M('A1') + k * 5, 1.0), t, rev=0.3)
    A(i_brass(M('A4'), 0.18, 0.9), 30.4, rev=0.3)
    A(i_brass(M('A4'), 0.18, 0.9), 30.6, rev=0.3)
    chord(s, i_brass, 30.8, ['D4', 'F#4', 'A4', 'D5'], 1.6, 1.0, rev=0.5)
    A(d_crash(1.0), 30.8, rev=0.5)
    A(boom(0.9, 70, 28, 1.2), 30.8, rev=0.4)
    return s


if __name__ == '__main__':
    s = build()
    out = s.render(make_ir(2.6, 0.75), master=0.95)
    # 32.8초 뒤 1.2초 동안 페이드 아웃 → 34초에서 끝
    n_end = int(34.0 * SR)
    out = out[:, :n_end]
    f0 = int(32.8 * SR)
    out[:, f0:] *= np.linspace(1, 0, n_end - f0)
    wav = '/tmp/gona-opening.wav'
    wavfile.write(wav, SR, (np.clip(out.T, -1, 1) * 32767).astype(np.int16))
    mp3 = os.path.join(OUT, 'bgm-opening.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '112k', mp3], check=True)
    os.remove(wav)
    print('opening', f'{out.shape[1] / SR:.2f}s', os.path.getsize(mp3) // 1024, 'KB')
