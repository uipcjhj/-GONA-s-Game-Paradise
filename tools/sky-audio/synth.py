"""GONA's Sky Adventure 오리지널 음원 합성기 (numpy + scipy)
 - 외부 샘플·기존 곡을 쓰지 않고 파형(톱니·사각·FM·노이즈)을 직접 계산해 만든 음원 → 저작권: 프로젝트 자체 제작물
 - 90년대 아케이드 기판(FM 음원 + PCM 드럼) 느낌을 목표로 한 악기 세트
 - 반복 BGM 은 '주기 렌더링': 곡 끝에서 넘친 소리(잔향·꼬리)를 처음으로 되감아 더해, 파일 어디서 잘라도 이음매 없이 반복
"""
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve

SR = 44100
RNG = np.random.RandomState(1234)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def n2m(s):
    """'C#5' → 73, 'Bb4' → 70"""
    p = NOTE[s[0]]
    i = 1
    while i < len(s) and s[i] in '#b':
        p += 1 if s[i] == '#' else -1
        i += 1
    return p + 12 * (int(s[i:]) + 1)


# ───────── 기본 파형 ─────────
def _blep(p, dt):
    out = np.zeros_like(p)
    m = p < dt
    t = p[m] / dt[m] if np.ndim(dt) else p[m] / dt
    out[m] = t + t - t * t - 1
    m2 = p > 1 - dt
    t2 = (p[m2] - 1) / (dt[m2] if np.ndim(dt) else dt)
    out[m2] = t2 * t2 + t2 + t2 + 1
    return out


def phase(f, n):
    """주파수(상수 또는 배열) → 0..1 위상"""
    f = np.broadcast_to(np.asarray(f, float), (n,))
    return np.cumsum(f / SR) % 1.0, f / SR


def saw(f, n):
    p, dt = phase(f, n)
    return 2 * p - 1 - _blep(p, dt)


def square(f, n, duty=0.5):
    p, dt = phase(f, n)
    s = np.where(p < duty, 1.0, -1.0)
    s += _blep(p, dt)
    s -= _blep((p + 1 - duty) % 1.0, dt)
    return s


def tri(f, n):
    p, _ = phase(f, n)
    return 4 * np.abs(p - 0.5) - 1


def sine(f, n):
    p, _ = phase(f, n)
    return np.sin(2 * np.pi * p)


def noise(n):
    return RNG.uniform(-1, 1, n)


def env(n, a, d, s, r, sustain_len=None):
    """ADSR (초). sustain_len: 키를 누르고 있는 시간(없으면 n - r)"""
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    hold = (n - r) if sustain_len is None else int(sustain_len * SR)
    hold = max(hold, 1)
    e = np.zeros(n)
    i = np.arange(n)
    e = np.where(i < a, i / max(a, 1), e)
    dd = (i >= a) & (i < a + d)
    e = np.where(dd, 1 - (1 - s) * (i - a) / max(d, 1), e)
    e = np.where((i >= a + d) & (i < hold), s, e)
    lvl = np.interp(hold, [0, a, a + d, n], [0, 1, s, s]) if hold < a + d else s
    rr = i >= hold
    e = np.where(rr, lvl * np.clip(1 - (i - hold) / max(r, 1), 0, 1), e)
    return e


def expdec(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lp(x, fc, order=2):
    fc = min(fc, SR * 0.45)
    b, a = butter(order, fc / (SR / 2), 'low')
    return lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), 'high')
    return lfilter(b, a, x)


def bp(x, f0, f1, order=2):
    b, a = butter(order, [f0 / (SR / 2), min(f1, SR * 0.45) / (SR / 2)], 'band')
    return lfilter(b, a, x)


def vib(f, n, rate=5.5, depth=0.006, delay=0.12):
    t = np.arange(n) / SR
    amt = np.clip((t - delay) / 0.2, 0, 1) * depth
    return f * (1 + amt * np.sin(2 * np.pi * rate * t))


# ───────── 악기 (midi, 길이초, 세기) → 모노 배열 ─────────
def i_brass(m, dur, v=1.0):
    """FM 브라스 (2op, 변조 지수가 어택에서 열림) — 아케이드 FM 리드"""
    rel = 0.12
    n = int((dur + rel) * SR)
    f = vib(mtof(m), n, depth=0.007)
    t = np.arange(n) / SR
    ie = 2.6 * env(n, 0.04, 0.25, 0.55, rel, dur) + 0.4
    mod = np.sin(2 * np.pi * np.cumsum(f) / SR) * ie
    car = np.sin(2 * np.pi * np.cumsum(f) / SR + mod)
    s = car * 0.7 + 0.3 * saw(f * 1.003, n) * 0.5
    s = lp(s, 4200)
    return s * env(n, 0.025, 0.2, 0.75, rel, dur) * v


def i_lead(m, dur, v=1.0):
    """톱니 2개 디튠 + 비브라토 신스 리드"""
    rel = 0.1
    n = int((dur + rel) * SR)
    f = vib(mtof(m), n)
    s = saw(f * 0.997, n) + saw(f * 1.004, n) + 0.5 * square(f * 0.5, n, 0.3)
    s = lp(s, 5200) * 0.35
    return s * env(n, 0.01, 0.15, 0.7, rel, dur) * v


def i_chip(m, dur, v=1.0, duty=0.25):
    rel = 0.05
    n = int((dur + rel) * SR)
    f = vib(mtof(m), n, depth=0.004, delay=0.18)
    s = square(f, n, duty) * 0.4
    return lp(s, 7000) * env(n, 0.004, 0.08, 0.6, rel, dur) * v


def i_bell(m, dur, v=1.0):
    n = int((dur + 0.8) * SR)
    f = mtof(m)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * expdec(n, 0.25)
    s = np.sin(2 * np.pi * f * t + mod)
    return s * expdec(n, 0.55) * env(n, 0.002, 0.01, 1, 0.05) * 0.45 * v


def i_bass(m, dur, v=1.0):
    """FM 슬랩 베이스"""
    rel = 0.05
    n = int((dur + rel) * SR)
    f = mtof(m)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * t) * (3.2 * expdec(n, 0.07) + 0.6)
    s = np.sin(2 * np.pi * f * t + mod) + 0.35 * saw(f, n)
    s = lp(s, 2200)
    return np.tanh(s * 1.4) * env(n, 0.003, 0.12, 0.65, rel, dur) * 0.75 * v


def i_guitar(m, dur, v=1.0, mute=False):
    """파워코드(근음+5도+옥타브) 디스토션 기타"""
    rel = 0.04 if mute else 0.12
    n = int((dur + rel) * SR)
    f = mtof(m)
    s = saw(f, n) + saw(f * 1.4983, n) * 0.8 + saw(f * 2.002, n) * 0.5 + saw(f * 0.998, n) * 0.6
    s = np.tanh(s * 3.5)
    s = lp(s, 1900 if mute else 3200, 2)
    s = hp(s, 90)
    e = env(n, 0.003, 0.08 if mute else 0.3, 0.25 if mute else 0.7, rel, dur)
    return s * e * 0.32 * v


def i_strings(m, dur, v=1.0):
    rel = 0.35
    n = int((dur + rel) * SR)
    f = vib(mtof(m), n, rate=4.8, depth=0.004, delay=0.3)
    s = sum(saw(f * d, n) for d in (0.993, 0.998, 1.0, 1.003, 1.008))
    s = lp(s, 2600) * 0.13
    return s * env(n, 0.18, 0.3, 0.85, rel, dur) * v


def i_choir(m, dur, v=1.0):
    rel = 0.4
    n = int((dur + rel) * SR)
    f = vib(mtof(m), n, rate=5, depth=0.005, delay=0.2)
    s = sum(tri(f * d, n) for d in (0.996, 1.0, 1.005)) + 0.3 * saw(f, n)
    s = bp(s, 300, 2400) * 0.25
    return s * env(n, 0.25, 0.3, 0.9, rel, dur) * v


def i_organ(m, dur, v=1.0):
    rel = 0.08
    n = int((dur + rel) * SR)
    f = mtof(m)
    s = sine(f, n) + 0.6 * sine(f * 2, n) + 0.35 * sine(f * 3, n) + 0.2 * sine(f * 4, n) + 0.15 * square(f, n, 0.5)
    return lp(s, 3000) * 0.22 * env(n, 0.01, 0.1, 0.9, rel, dur) * v


# ───────── 드럼 ─────────
def d_kick(v=1.0):
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    f = 46 + 120 * np.exp(-t / 0.035)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, 0.16)
    s += lp(noise(n), 3000) * expdec(n, 0.006) * 0.6
    return np.tanh(s * 1.8) * 0.9 * v


def d_snare(v=1.0):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * (185 + 60 * np.exp(-t / 0.02)) * t) * expdec(n, 0.05)
    nz = bp(noise(n), 1200, 9000) * expdec(n, 0.075)
    return np.tanh((tone * 0.7 + nz * 1.1) * 1.5) * 0.6 * v


def d_hat(v=1.0, open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    s = hp(noise(n), 7000) * expdec(n, 0.08 if open_ else 0.014)
    return s * 0.24 * v


def d_crash(v=1.0):
    n = int(1.8 * SR)
    s = hp(noise(n), 4000) * expdec(n, 0.55) + hp(noise(n), 9000) * expdec(n, 0.25)
    return s * 0.2 * v


def d_tom(m=45, v=1.0):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = mtof(m) * (1 + 0.6 * np.exp(-t / 0.03))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, 0.14) + lp(noise(n), 1500) * expdec(n, 0.02) * 0.4
    return s * 0.7 * v


def d_timpani(m=38, v=1.0):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    f = mtof(m) * (1 + 0.08 * np.exp(-t / 0.05))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * expdec(n, 0.2)
    s = s * expdec(n, 0.45) + lp(noise(n), 800) * expdec(n, 0.03) * 0.5
    return np.tanh(s * 1.3) * 0.7 * v


# ───────── 리버브 (합성 임펄스 응답) ─────────
def make_ir(sec=1.6, decay=0.45, seed=7):
    r = np.random.RandomState(seed)
    n = int(sec * SR)
    out = []
    for ch in range(2):
        x = r.uniform(-1, 1, n) * np.exp(-np.arange(n) / (decay * SR))
        x = lp(x, 6000)
        x[: int(0.012 * SR)] = 0
        out.append(x / np.sqrt(np.sum(x ** 2)))
    return out


# ───────── 곡 버스 ─────────
class Song:
    def __init__(self, bpm, bars, loop=True, tail=2.0, spb=16):
        self.bpm, self.bars, self.loop, self.spb = bpm, bars, loop, spb
        self.step = 60.0 / bpm / 4
        self.L = int(round(bars * spb * self.step * SR))
        self.n = self.L if loop else self.L + int(tail * SR)
        self.dry = np.zeros((2, self.n))
        self.wet = np.zeros((2, self.n))

    @property
    def seconds(self):
        return self.L / SR

    def add(self, x, t, pan=0.0, gain=1.0, rev=0.2):
        i0 = int(round(t * SR))
        x = x * gain
        lg = np.cos((pan + 1) * np.pi / 4) * 1.414
        rg = np.sin((pan + 1) * np.pi / 4) * 1.414
        for ch, g in ((0, lg), (1, rg)):
            for buf, k in ((self.dry, 1.0), (self.wet, rev)):
                if k == 0:
                    continue
                seg = x * g * k
                if self.loop:
                    p = i0 % self.n
                    while len(seg):
                        k2 = min(len(seg), self.n - p)
                        buf[ch, p:p + k2] += seg[:k2]
                        seg = seg[k2:]
                        p = 0
                else:
                    e = min(self.n, i0 + len(seg))
                    if i0 < self.n:
                        buf[ch, i0:e] += seg[: e - i0]

    def st(self, bar, step=0):
        return (bar * self.spb + step) * self.step

    def melody(self, inst, bar, seq, pan=0.0, gain=1.0, rev=0.25, octave=0, legato=0.92):
        """seq: 'D5:2 A4:2 r:4 ...' (길이는 16분음표 단위)"""
        pos = 0
        for tok in seq.split():
            nm, ln = tok.split(':')
            ln = float(ln)
            if nm != 'r':
                for part in nm.split('+'):
                    self.add(inst(n2m(part) + octave, ln * self.step * legato), self.st(bar, pos), pan, gain, rev)
            pos += ln
        return pos

    def render(self, rev_ir=None, master=0.92):
        ir = rev_ir or make_ir()
        out = np.zeros((2, self.n))
        for ch in range(2):
            w = self.wet[ch]
            if self.loop:
                w3 = np.concatenate([w, w, w])
                r = fftconvolve(w3, ir[ch])[self.n: 2 * self.n]
            else:
                r = fftconvolve(w, ir[ch])[: self.n]
            out[ch] = self.dry[ch] + r * 0.9
        if self.loop:  # 필터 과도 응답 제거: 세 바퀴 이어 붙여 거른 뒤 가운데(정상 상태) 사용
            out = hp(np.concatenate([out, out, out], axis=1), 28)[:, self.n: 2 * self.n]
        else:
            out = hp(out, 28)
        pk = np.max(np.abs(out)) + 1e-9
        out = out / pk * 1.15
        out = np.tanh(out * 1.1) / np.tanh(1.1 * 1.15) * master
        return out


def periodic_file(song_out, pre=0.25, post=0.6):
    """주기 신호 → 파일: [끝 pre초] + [한 바퀴] + [처음 post초]  (재생은 pre 초 지점부터, 반복 구간 = pre ~ pre+L)"""
    n = song_out.shape[1]
    a = int(pre * SR)
    b = int(post * SR)
    return np.concatenate([song_out[:, n - a:], song_out, song_out[:, :b]], axis=1)
