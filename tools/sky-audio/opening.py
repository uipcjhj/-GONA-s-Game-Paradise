"""오프닝 컷신 음악·효과음 (약 46초 · 반복 없음) → src/sky/sound/bgm-opening.mp3
「고나의 응가 대탈출 대작전」 — 웅장한 판타지 예고편 음악 + 장면 동작에 맞춘 효과음
모든 소리는 synth.py 의 합성 악기로 새로 만든 것 (외부 샘플·기존 곡 없음).
시각(초)은 src/sky/OpeningCinematic.tsx 의 T · PUSHES · TITLE_AT 와 같아야 함:
  0 서기 2026년 · 4 풍요(오물오물 4~6.9 · 통통 6.9~9.6) · 9.6 꾸르륵(멈칫 10.35, 큰 꾸르륵 11.6)
  13.6 힘주기(끄응 14.2·15.2·16.1·16.9) → 17.95 …뿌웅? → 18.2 울먹임 · 20.6 잠듦 → 22 배 속 소용돌이 → 23.2 꿈의 왕국
  (25.0 골렘 쿵 · 26.2 열차 급정거) · 28.2 마왕성(29.0·30.6 번개, 29.9 웃음, 31.5 성문) · 32 여섯 수호자(컷인 33.0~36.6)
  37 출격(38.0 각성 · 38.4 비상 · 40.2 돌진) · 41.4 타이틀
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


def gurgle(dur=0.9, v=1.0, seed=3):
    """배 속 꾸르륵: 낮은 물방울 소리가 미끄러지며 여러 번 (내려가는 사인 + 떨림)"""
    rng = np.random.default_rng(seed)
    n = int((dur + 0.3) * SR)
    out = np.zeros(n)
    tt = 0.0
    while tt < dur:
        ln = 0.06 + rng.random() * 0.12
        m = int(ln * SR)
        t = np.arange(m) / SR
        f0 = 140 + rng.random() * 160
        f = f0 * (1 - 0.45 * t / ln) * (1 + 0.08 * np.sin(2 * np.pi * 30 * t))
        b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / ln) ** 1.5
        i = int(tt * SR)
        out[i: i + m] += b[: n - i] * (0.6 + 0.4 * rng.random())
        tt += ln * (0.5 + rng.random() * 0.6)
    out = lp(out + lp(noise(n), 300) * 0.15 * env(n, 0.05, 0.1, 1, 0.2, dur), 900)
    return np.tanh(out * 1.6) * 0.7 * v


def chew(v=1.0):
    """오물오물 (작고 부드러운 바삭 소리)"""
    n = int(0.08 * SR)
    return bp(noise(n), 1500, 5000) * expdec(n, 0.015) * 0.35 * v


def pat(v=1.0):
    """배 통! (부드러운 북)"""
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 120 + 60 * np.exp(-t / 0.02)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, 0.09) + lp(noise(n), 800) * expdec(n, 0.02) * 0.3
    return s * 0.5 * v


def pfft(v=1.0):
    """…뿌웅? (아주 작고 힘없는 방귀 — 우스운 실패)"""
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 150 - 70 * t / 0.42
    buzz = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.3 + np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4
    s = lp(buzz, 700) * env(n, 0.02, 0.1, 0.6, 0.15, 0.25)
    return s * 0.5 * v


def strain_swell(dur, v=1.0, m='D2'):
    """끄응! (아래에서 밀어 올리는 저음 + 떨림)"""
    n = int((dur + 0.3) * SR)
    f = mtof(M(m))
    s = saw(f, n) + saw(f * 1.01, n) * 0.8 + sine(f / 2, n)
    s = tremolo(lp(s, 500), 14, 0.5) * env(n, dur * 0.7, 0.05, 1, 0.3, dur) * 0.4
    return s * v


def stomp(v=1.0):
    """거대한 발걸음 쿵 (골렘)"""
    a = boom(1.0, 60, 24, 0.7) * 0.9 * v
    b = d_timpani(M('C2'), 0.7) * 0.6
    a[: len(b)] += b[: len(a)]
    return a


def build():
    s = Song(120, 24, loop=False, tail=1.5)  # 48초 + 꼬리
    A = s.add

    # ═ 1 서기 2026년 0~4: 깊은 저음 · 종 · 신비로운 합창 ═
    A(drone(M('D1'), 4.2, 0.85, a=2.0), 0.0, rev=0.25)
    A(toll(M('D2'), 0.85), 0.2, rev=0.6)
    A(toll(M('A1'), 0.7), 2.0, rev=0.6)
    chord(s, i_choir, 1.0, ['D4', 'A4'], 3.0, 0.5, rev=0.6)
    A(i_bell(M('A5'), 1.5, 0.25), 3.3, pan=0.3, rev=0.7)

    # ═ 2 풍요의 시대 4~9.6: 따뜻한 현악·종소리 왈츠 느낌 + 오물오물·통통 ═
    for t, ch in [(4.0, ['F3', 'A3', 'C4', 'F4']), (5.4, ['Bb2', 'F3', 'D4', 'F4']), (6.9, ['F3', 'A3', 'C4', 'A4']), (8.3, ['C3', 'G3', 'E4', 'G4'])]:
        chord(s, i_strings, t, ch, 1.4, 0.8, rev=0.45)
    for t, nm, d in [(4.0, 'A5', 0.6), (4.7, 'C6', 0.6), (5.4, 'D6', 0.9), (6.2, 'C6', 0.6), (6.9, 'A5', 0.9), (7.6, 'F5', 0.6), (8.3, 'G5', 0.9)]:
        A(i_bell(M(nm), d, 0.3), t, pan=0.3, rev=0.6)
        A(i_strings(M(nm), d, 0.6), t, pan=-0.2, rev=0.5)
    k = 0
    while 4.0 + k * 0.42 < 6.8:  # 0.42초마다 오물
        A(chew(0.8), 4.0 + k * 0.42 + 0.1, pan=0.1, rev=0.05)
        k += 1
    k = 0
    while 6.9 + k * 0.5 < 9.3:  # 0.5초마다 통
        A(pat(1.0), 6.9 + k * 0.5, rev=0.1)
        k += 1

    # ═ 3 불길한 징조 9.6~13.6: 음악이 뚝 끊기고 꾸르륵 → 멈칫 → 긴장 ═
    A(gurgle(0.6, 0.8, 1), 10.0, rev=0.2)
    A(d_timpani(M('D2'), 0.9), T_STARTLE, rev=0.4)  # 멈칫 (카메라 확 다가감)
    A(i_strings(M('D6'), 0.4, 0.5), T_STARTLE, rev=0.4)
    A(drone(M('C#1'), 3.4, 0.7, a=0.4, r=0.4), 10.35, rev=0.2)
    trem = tremolo(sum(i_strings(M(nm), 3.0, 0.65) for nm in ('D3', 'Eb3', 'A3')), 10.0, 0.7)
    A(trem, 10.6, rev=0.3)
    for t in (10.9, 11.7, 12.4, 13.0):
        A(heart(0.8), t, rev=0.1)
    A(gurgle(1.0, 1.1, 5), 11.6, rev=0.2)  # 큰 꾸르르륵
    A(riser(1.8, 0.4), 11.8, rev=0.2)

    # ═ 4 운명의 사투 13.6~20.6: 비장한 합창·타악 vs 힘주는 고나 → …뿌웅? → 울먹임 ═
    A(boom(0.9, 80, 26, 1.0), 13.6, rev=0.4)
    A(d_crash(0.7), 13.6, rev=0.4)
    prog = [('D3', 'F3', 'A3', 'D4'), ('Bb2', 'D3', 'F3', 'Bb3'), ('C3', 'E3', 'G3', 'C4'), ('A2', 'C#3', 'E3', 'A3')]
    for i, p in enumerate((13.6, 14.6, 15.6, 16.5)):
        chord(s, i_choir, p, list(prog[i]), 1.1, 0.85, rev=0.55)
        chord(s, i_brass, p, [prog[i][0], prog[i][2]], 0.9, 0.5, rev=0.4)
    for i, t in enumerate(PUSHES):  # 끄응! 마다 저음 밀어올림 + 팀파니
        A(strain_swell(0.55, 0.9 + i * 0.1, ['D2', 'D2', 'E2', 'F2'][i]), t - 0.45, rev=0.2)
        A(d_timpani(M('D2') + i * 2, 1.0), t, rev=0.35)
        A(boom(0.5 + i * 0.1, 70, 30, 0.5), t, rev=0.3)
    for k in range(12):  # 스네어 롤 → 절정
        A(d_snare(0.2 + k * 0.05), 17.0 + k * 0.05, rev=0.15)
    A(riser(0.6, 0.6, 400, 9000), 17.0, rev=0.1)
    # 17.6 절정에서 모든 소리가 멈춤 → 아주 작은 …뿌웅?
    A(pfft(0.9), 17.95, rev=0.1)
    # 울먹임: 쓸쓸한 첼로·현악 (단조)
    for t, nm, d in [(18.3, 'D3', 0.9), (19.2, 'C3', 0.6), (19.8, 'Bb2', 0.9)]:
        A(i_strings(M(nm), d, 0.9), t, rev=0.5)
    for t, nm, d in [(18.4, 'F4', 0.8), (19.2, 'E4', 0.5), (19.7, 'D4', 1.0)]:
        A(i_bell(M(nm) + 12, d, 0.18), t, pan=0.2, rev=0.7)

    # ═ 5 잠듦 → 배 속 꿈의 왕국 20.6~28.2 ═
    A(i_bell(M('A5'), 1.2, 0.35), 20.8, rev=0.8)  # 자장가 같은 종소리
    A(i_bell(M('F5'), 1.2, 0.32), 21.4, rev=0.8)
    A(i_bell(M('D5'), 1.4, 0.3), 22.0, rev=0.8)
    chord(s, i_strings, 20.6, ['D3', 'A3', 'F4'], 1.4, 0.55, rev=0.6)  # 잠든 숨결 같은 현악
    chord(s, i_choir, 20.7, ['A4', 'D5'], 2.2, 0.4, rev=0.7)
    chord(s, i_strings, 22.0, ['Bb2', 'F3', 'D4'], 1.2, 0.6, rev=0.6)
    A(riser(1.2, 1.0, 200, 8000), 22.0, rev=0.3)  # 배 속으로 빨려 들어감
    A(whoosh(0.8, 0.9), 22.6, rev=0.2)
    A(d_crash(0.6), 23.2, rev=0.5)
    A(drone(M('D1'), 5.0, 0.8, a=0.3), 23.2, rev=0.2)
    beat = 60 / 132  # 똥돌이 병사 행진
    k = 0
    while 23.3 + k * beat / 2 < 28.0:
        t = 23.3 + k * beat / 2
        if k % 2 == 0:
            A(d_snare(0.45), t, rev=0.1)
        if k % 4 == 0:
            A(d_kick(0.7), t, rev=0.05)
        k += 1
    for t, ch in ((23.2, ['D3', 'F3', 'A3']), (24.6, ['Bb2', 'D3', 'F3']), (26.0, ['G2', 'Bb2', 'D3']), (27.2, ['A2', 'C#3', 'E3'])):
        chord(s, i_brass, t, ch, 1.2, 0.6, rev=0.4)
        chord(s, i_choir, t, [n[:-1] + str(int(n[-1]) + 1) for n in ch], 1.2, 0.5, rev=0.5)
    A(stomp(1.1), 25.0, rev=0.4)  # 골렘 쿵!
    A(screech(0.8, 0.8), T_TRAIN - 0.5, pan=-0.3, rev=0.3)  # 열차 급정거
    A(boom(0.5, 60, 30, 0.4), T_TRAIN, rev=0.3)

    # ═ 6 마왕의 등장 28.2~32: 어두운 합창 · 번개 · 웃음 · 성문 ═
    chord(s, i_choir, 28.2, ['D3', 'F3', 'Ab3', 'D4'], 3.2, 0.9, rev=0.6)
    A(drone(M('D1'), 3.6, 0.9, a=0.3, r=0.3), 28.2, rev=0.2)
    A(thunder(0.9), 29.0, pan=-0.3, rev=0.4)
    for i, nm in enumerate(['A3', 'G3', 'F3', 'E3', 'D3']):  # 크하하하! (내려가는 합창 스타카토)
        A(i_choir(M(nm), 0.18, 1.0), T_LAUGH + i * 0.2, rev=0.4)
        A(i_brass(M(nm) - 12, 0.16, 0.6), T_LAUGH + i * 0.2, rev=0.3)
    A(thunder(1.0), 30.6, pan=0.3, rev=0.4)
    A(riser(0.5, 0.4, 300, 4000), 31.0, rev=0.1)
    A(boom(1.2, 80, 24, 1.3), T_GATE, rev=0.5)  # 성문 쿵 → 암전
    A(d_crash(0.7), T_GATE, rev=0.5)

    # ═ 7 여섯 수호자 32~37: 여섯 빛 · 관현악 상승 ═
    for i, nm in enumerate(['D5', 'F5', 'A5', 'D6', 'F6', 'A6']):
        A(chime(M(nm), 0.8), 32.1 + i * 0.12, pan=-0.5 + i * 0.2, rev=0.6)
    CH = {'Dm': ['D3', 'F3', 'A3'], 'Bb': ['Bb2', 'D3', 'F3'], 'C': ['C3', 'E3', 'G3'], 'D': ['D3', 'F#3', 'A3']}
    for name, t in [('Dm', 33.0), ('Bb', 34.2), ('C', 35.4), ('D', 36.6)]:
        chord(s, i_strings, t, CH[name], 1.2, 0.95, rev=0.35)
        chord(s, i_choir, t, [n[:-1] + str(int(n[-1]) + 1) for n in CH[name]], 1.2, 0.55, rev=0.5)
        for k in range(8):
            A(i_strings(M(CH[name][k % 3]) + 12, 0.12, 0.6), t + k * 0.15, pan=0.4 if k % 2 else -0.4, rev=0.2)
    for i in range(6):  # 컷인마다 타격 + 휙
        t = 33.0 + i * 0.6
        A(d_timpani(M('D2') + (i % 3) * 2, 0.85), t, rev=0.3)
        A(whoosh(0.3, 0.6), t - 0.15, pan=(-1) ** i * 0.5, rev=0.1)
    for t, nm, d in [(33.0, 'A4', 0.55), (33.6, 'D5', 0.55), (34.2, 'F5', 0.55), (34.8, 'E5', 0.3), (35.1, 'D5', 0.3), (35.4, 'C5', 0.55),
                     (36.0, 'E5', 0.55), (36.6, 'F#5', 0.8)]:
        A(i_brass(M(nm), d, 0.9), t, pan=0.1, rev=0.35)
    A(riser(0.8, 0.5), 36.2, rev=0.1)

    # ═ 8 운명의 출격 37~41.4: 각성 → 비상 → 돌진 → 타이틀 ═
    chord(s, i_choir, 37.0, ['D4', 'A4', 'D5'], 1.2, 0.7, rev=0.6)
    A(i_bell(M('D6'), 1.0, 0.3), 37.0, rev=0.7)
    A(chime(M('A6'), 1.0), T_WAKE, rev=0.6)  # 눈을 뜸
    A(d_crash(0.8), T_RISE, rev=0.4)
    beat = 60 / 150
    for k in range(int((41.3 - T_RISE) / (beat / 2))):
        t = T_RISE + k * beat / 2
        if k % 2 == 0:
            A(d_kick(0.9), t, rev=0.05)
        if k % 4 == 2:
            A(d_snare(0.85), t, rev=0.15)
        A(d_hat(0.45), t, pan=0.3, rev=0.05)
    for name, t in [('D', 38.4), ('Bb', 39.2), ('C', 40.0), ('D', 40.8)]:
        chord(s, i_strings, t, [n[:-1] + str(int(n[-1]) + 1) for n in CH[name]], 0.75, 1.0, rev=0.3)
        chord(s, i_brass, t, CH[name], 0.7, 0.75, rev=0.3)
    for t, nm, d in [(38.4, 'D5', 0.3), (38.7, 'A5', 0.5), (39.2, 'Bb5', 0.3), (39.5, 'F5', 0.5), (40.0, 'G5', 0.3), (40.3, 'E5', 0.3),
                     (40.6, 'C6', 0.2), (40.8, 'D6', 0.6)]:
        A(i_brass(M(nm), d, 1.0), t, rev=0.35)
    A(riser(1.2, 0.8, 300, 12000), 40.2, rev=0.1)
    A(whoosh(0.6, 1.0), 40.8, rev=0.1)
    # 41.4 타이틀
    A(boom(1.3, 100, 26, 1.6), TITLE, rev=0.5)
    A(d_crash(1.1), TITLE, rev=0.5)
    A(d_timpani(M('D2'), 1.1), TITLE, rev=0.4)
    chord(s, i_brass, TITLE, ['D3', 'A3', 'D4', 'F#4', 'A4'], 2.6, 1.0, rev=0.5)
    chord(s, i_strings, TITLE, ['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5'], 3.4, 1.05, rev=0.5)
    chord(s, i_choir, TITLE, ['D4', 'A4', 'D5', 'F#5'], 3.2, 0.85, rev=0.6)
    for k, t in enumerate((TITLE + 1.4, TITLE + 1.6, TITLE + 1.8)):
        A(d_timpani(M('A1') + k * 5, 1.0), t, rev=0.3)
    chord(s, i_brass, TITLE + 1.8, ['D4', 'F#4', 'A4', 'D5'], 1.6, 1.0, rev=0.5)
    A(d_crash(0.9), TITLE + 1.8, rev=0.5)
    return s


T_STARTLE, T_TRAIN, T_LAUGH, T_GATE, T_WAKE, T_RISE, TITLE = 10.35, 26.2, 29.9, 31.5, 38.0, 38.4, 41.4
PUSHES = (14.2, 15.2, 16.1, 16.9)

if __name__ == '__main__':
    s = build()
    out = s.render(make_ir(2.6, 0.75), master=0.95)
    # 45.2초부터 1.3초 동안 페이드 아웃 → 46.5초에서 끝
    n_end = int(46.5 * SR)
    out = out[:, :n_end]
    f0 = int(45.2 * SR)
    out[:, f0:] *= np.linspace(1, 0, n_end - f0)
    wav = '/tmp/gona-opening.wav'
    wavfile.write(wav, SR, (np.clip(out.T, -1, 1) * 32767).astype(np.int16))
    mp3 = os.path.join(OUT, 'bgm-opening.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '112k', mp3], check=True)
    os.remove(wav)
    print('opening', f'{out.shape[1] / SR:.2f}s', os.path.getsize(mp3) // 1024, 'KB')
