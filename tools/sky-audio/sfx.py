"""GONA's Sky Adventure 오리지널 효과음 합성 → public/assets/sky/audio/sfx-*.wav (22kHz 모노, 짧고 즉시 재생)
WAV 를 쓰는 이유: MP3 의 인코더 앞 무음(수십 ms) 없이 손가락 입력과 소리가 바로 맞물리게.
"""
import os
import numpy as np
from scipy.io import wavfile
from synth import SR, saw, square, sine, tri, noise, expdec, env, lp, hp, bp, mtof, n2m, i_bell, i_brass, i_chip, d_kick, d_crash, d_timpani

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'sky', 'sound')
os.makedirs(OUT, exist_ok=True)
OSR = 22050
R = np.random.RandomState(99)


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def sweep(f0, f1, sec, curve=1.0):
    n = int(sec * SR)
    k = np.linspace(0, 1, n) ** curve
    return f0 * (f1 / f0) ** k


def boom(sec, tau, lpf, low=55, punch=1.0):
    """폭발: 저역 쿵 + 노이즈 몸통 + 지글거리는 꼬리"""
    n = int(sec * SR)
    t = t_(sec)
    thump = np.sin(2 * np.pi * np.cumsum(low + 90 * np.exp(-t / 0.05)) / SR) * expdec(n, 0.12) * punch
    body = lp(noise(n), lpf) * expdec(n, tau)
    crackle = hp(noise(n) * (R.uniform(0, 1, n) > 0.985), 2000) * expdec(n, tau * 0.6) * 2.5
    return np.tanh((thump * 1.2 + body * 1.4 + crackle * 0.4) * 1.5)


def mix(*xs):
    n = max(len(x) for x in xs)
    o = np.zeros(n)
    for x in xs:
        o[: len(x)] += x
    return o


def at(x, sec, total):
    o = np.zeros(int(total * SR))
    i = int(sec * SR)
    e = min(len(o), i + len(x))
    o[i:e] += x[: e - i]
    return o


def save(name, x, gain=0.9):
    x = x / (np.max(np.abs(x)) + 1e-9) * gain
    fade = min(len(x), int(0.01 * SR))
    x[-fade:] *= np.linspace(1, 0, fade)
    y = x[:: SR // OSR] if SR % OSR == 0 else np.interp(np.arange(0, len(x), SR / OSR), np.arange(len(x)), x)
    y = lp(x, 10000)[:: 2]
    wavfile.write(os.path.join(OUT, f'sfx-{name}.wav'), OSR, (np.clip(y, -1, 1) * 32767).astype(np.int16))
    print(name, f'{len(x) / SR:.2f}s')


# 일반 공격: 짧고 선명한 에너지 발사음 (사각파 하강 + 고역 노이즈 '칙')
f = sweep(1900, 700, 0.07, 0.6)
x = square(f, len(f), 0.3) * expdec(len(f), 0.025) + hp(noise(len(f)), 4000) * expdec(len(f), 0.008) * 0.6
save('shot', lp(x, 7000), 0.7)
# 강화 공격: 더 두껍고 낮은 발사음 (톱니 2겹 + 저역 펀치)
f = sweep(1300, 380, 0.11, 0.5)
x = (saw(f, len(f)) + square(f * 0.5, len(f), 0.4) * 0.7) * expdec(len(f), 0.04) + np.sin(2 * np.pi * np.cumsum(sweep(220, 60, 0.11)) / SR) * expdec(len(f), 0.04)
save('shotHeavy', np.tanh(lp(x, 5000) * 1.5), 0.75)
# 동료 일반 공격: 가볍고 높은 '퓻'
f = sweep(2600, 1400, 0.06)
save('compShot', tri(f, len(f)) * expdec(len(f), 0.02), 0.6)
# 아빠 광선(일반)
n = int(0.5 * SR)
f = 180 + 30 * np.sin(2 * np.pi * 30 * t_(0.5))
x = saw(f, n) * 0.6 + square(f * 2.01, n, 0.5) * 0.3 + hp(noise(n), 3000) * 0.3
save('beam', lp(x, 3500) * env(n, 0.01, 0.1, 0.7, 0.15), 0.7)
# 차지 충전: 상승하는 에너지 (1.1초)
n = int(1.15 * SR)
f = sweep(180, 1400, 1.15, 1.6)
x = saw(f, n) * 0.4 + square(f * 1.5, n, 0.25) * 0.25 + sine(f * 2, n) * 0.3
trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(sweep(8, 30, 1.15)) / SR)
save('chargeUp', lp(x, 4500) * trem * env(n, 0.05, 0.1, 1, 0.05), 0.6)
# 차지샷: 강력한 에너지 폭발 (하강 레이저 + 쿵 + 노이즈)
n = int(0.75 * SR)
f = sweep(1500, 90, 0.75, 0.45)
las = (saw(f, n) + square(f * 0.501, n, 0.5)) * expdec(n, 0.22)
save('chargeShot', np.tanh(mix(lp(las, 6000) * 0.8, boom(0.75, 0.18, 2500, 50) * 0.9) * 1.6), 0.95)
# 적 피격: 짧은 금속성 '팅' (FM 비정수비)
n = int(0.09 * SR)
t = t_(0.09)
x = np.sin(2 * np.pi * 1450 * t + 3 * np.sin(2 * np.pi * 1450 * 2.76 * t) * expdec(n, 0.02)) * expdec(n, 0.025)
save('enemyHit', x + hp(noise(n), 5000) * expdec(n, 0.006) * 0.5, 0.55)
# 적 격파: 크기별 폭발
save('boomS', boom(0.35, 0.07, 3500, 80, 0.6), 0.8)
save('boomM', boom(0.7, 0.16, 2400, 60, 1.0), 0.9)
save('boomL', mix(boom(1.4, 0.35, 1600, 45, 1.3), at(boom(0.6, 0.12, 2800, 70, 0.7), 0.12, 1.4)), 0.95)
# 보스 피격: 중저음 '쿵' 충격 + 금속 울림
n = int(0.22 * SR)
t = t_(0.22)
x = np.sin(2 * np.pi * np.cumsum(70 + 80 * np.exp(-t / 0.02)) / SR) * expdec(n, 0.07)
x += np.sin(2 * np.pi * 520 * t + 2 * np.sin(2 * np.pi * 520 * 1.41 * t)) * expdec(n, 0.05) * 0.35
x += lp(noise(n), 1800) * expdec(n, 0.015) * 0.6
save('bossHit', np.tanh(x * 1.6), 0.8)
# 보스 약점: 결정 깨지는 고음 '챙'
n = int(0.28 * SR)
t = t_(0.28)
x = sum(np.sin(2 * np.pi * fr * t) * expdec(n, 0.08 + i * 0.03) for i, fr in enumerate((2100, 3170, 4420)))
x += hp(noise(n), 6000) * expdec(n, 0.02)
save('bossWeak', x + 0.5 * np.sin(2 * np.pi * np.cumsum(sweep(200, 60, 0.28)) / SR) * expdec(n, 0.06), 0.6)
# 보스 파괴: 다단계 대폭발 (작→중→대 연쇄 + 저역 굉음)
T = 3.4
x = np.zeros(int(T * SR))
for k, (tt, sz) in enumerate([(0, 'm'), (0.22, 's'), (0.4, 'm'), (0.62, 's'), (0.8, 'm'), (1.0, 's'), (1.2, 'm'), (1.45, 'l')]):
    b = boom(1.9, 0.4, 1500, 40, 1.6) if sz == 'l' else boom(0.7, 0.16, 2400, 60) if sz == 'm' else boom(0.35, 0.07, 3500, 80, 0.6)
    x += at(b * (1.6 if sz == 'l' else 0.8), tt, T)
x += at(lp(noise(int(2.4 * SR)), 300) * expdec(int(2.4 * SR), 0.8) * 1.2, 1.45, T)
save('bossBreak', np.tanh(x * 1.2), 0.98)
# 폭탄(황금 익룡의 포효): 포효(톱니 피치 하강 + 포먼트) + 광역 폭발
T = 2.0
n = int(1.1 * SR)
f = sweep(420, 110, 1.1, 0.7) * (1 + 0.03 * np.sin(2 * np.pi * 22 * t_(1.1)))
roar = bp(saw(f, n) + saw(f * 1.01, n) + noise(n) * 0.5, 300, 2400) * env(n, 0.03, 0.2, 0.8, 0.3)
save('bomb', np.tanh(mix(roar * 1.2, at(boom(1.6, 0.4, 1800, 45, 1.4), 0.25, T)) * 1.4), 0.98)
# 가족 필살기 — 캐릭터별 고유음
# 엄마 하트 스톰: 반짝이는 상승 아르페지오 + 하트 '뿅' 연타
T = 1.4
x = np.zeros(int(T * SR))
for i, m in enumerate([72, 76, 79, 84, 88, 91, 96]):
    x += at(i_bell(m, 0.15, 0.9), i * 0.06, T)
for i in range(6):
    ff = sweep(900 + i * 80, 1800, 0.08)
    x += at(tri(ff, len(ff)) * expdec(len(ff), 0.03), 0.45 + i * 0.12, T) * 0.6
save('spMom', x, 0.85)
# 아빠 스팀 브레이커: 증기 '치익' + 굵은 레이저 웅웅
T = 1.8
n = int(1.6 * SR)
steam = hp(noise(int(0.5 * SR)), 2500) * env(int(0.5 * SR), 0.01, 0.1, 0.6, 0.3)
f = 90 + 8 * np.sin(2 * np.pi * 6 * t_(1.6))
las = np.tanh((saw(f, n) + saw(f * 1.5, n) * 0.6 + square(f * 2, n) * 0.4) * 2) * env(n, 0.05, 0.2, 0.85, 0.4)
save('spDad', mix(steam * 0.8, at(lp(las, 2500) * 0.9, 0.25, T)), 0.9)
# 이모 스타 캐논: 별빛 차르르 + 연속 발사
T = 1.6
x = np.zeros(int(T * SR))
for i in range(10):
    ff = sweep(2200, 900, 0.09)
    x += at(square(ff, len(ff), 0.25) * expdec(len(ff), 0.035), 0.2 + i * 0.1, T) * 0.7
for i, m in enumerate([84, 88, 91, 95, 98]):
    x += at(i_bell(m, 0.2, 0.7), i * 0.04, T)
save('spImo', x, 0.85)
# 할머니 골든 힐링: 따뜻한 화음 상승 + 종소리
T = 1.8
x = np.zeros(int(T * SR))
for i, m in enumerate([60, 64, 67, 72, 76]):
    x += at(i_brass(m, 1.0 - i * 0.1, 0.4), i * 0.08, T)
for i, m in enumerate([84, 91, 96]):
    x += at(i_bell(m, 0.4, 0.8), 0.3 + i * 0.12, T)
save('spHalmeoni', x, 0.85)
# 할아버지 가디언 실드: 금속 방패 '쾅' + 공명 웅
T = 1.6
n = int(1.4 * SR)
t = t_(1.4)
clang = sum(np.sin(2 * np.pi * fr * t) * expdec(n, d) for fr, d in ((310, 0.5), (465, 0.35), (720, 0.25), (1130, 0.12)))
hum = sine(110 + 3 * np.sin(2 * np.pi * 4 * t), n) * env(n, 0.2, 0.2, 0.7, 0.4) * 0.5
save('spHalabeoji', mix(clang * 0.6 + hum, d_kick(1.0) * 0.8), 0.9)
# 삼촌 메가 인벤션: 기계 작동음(삐빅·톱니 모터) + 로켓 점화
T = 2.0
x = np.zeros(int(T * SR))
for i, fr in enumerate([1800, 2400, 1800, 3000]):
    x += at(square(np.full(int(0.05 * SR), fr), int(0.05 * SR), 0.5) * 0.4, i * 0.07, T)
n = int(0.8 * SR)
motor = saw(sweep(60, 240, 0.8, 0.5), n) * env(n, 0.05, 0.1, 0.8, 0.2)
x += at(lp(motor, 1800) * 0.7, 0.3, T)
x += at(boom(0.9, 0.3, 3000, 70, 0.6) * 0.8, 1.0, T)
save('spSamchon', x, 0.9)
# 컷인 휙
n = int(0.35 * SR)
save('cutin', bp(noise(n), 800, 6000) * np.sin(np.linspace(0, np.pi, n)) ** 2 + sine(sweep(300, 1200, 0.35), n) * 0.2 * np.sin(np.linspace(0, np.pi, n)), 0.7)
# 보스 경고: 아케이드 경고 사이렌 (2회)
T = 1.6
x = np.zeros(int(T * SR))
for k in range(2):
    n = int(0.6 * SR)
    f = np.where(np.arange(n) % int(0.15 * SR) < int(0.075 * SR), 880, 660).astype(float)
    x += at((square(f, n, 0.5) * 0.6 + saw(f * 0.5, n) * 0.4) * env(n, 0.01, 0.05, 0.9, 0.05), k * 0.75, T)
save('warn', lp(x, 5000), 0.75)
# 아이템 획득: 청량한 2음
T = 0.25
save('item', mix(i_chip(n2m('E6'), 0.05, 1, 0.5), at(i_chip(n2m('B6'), 0.12, 1, 0.5), 0.06, T)), 0.6)
# 파워업: 상승 아르페지오
T = 0.6
x = np.zeros(int(T * SR))
for i, m in enumerate([72, 76, 79, 84, 88]):
    x += at(i_chip(m, 0.07, 1, 0.25), i * 0.06, T)
save('powerUp', x, 0.7)
# 회복
T = 0.7
x = np.zeros(int(T * SR))
for i, m in enumerate([79, 84, 88]):
    x += at(i_bell(m, 0.2, 1), i * 0.08, T)
save('heal', x, 0.7)
# 방패로 막음
n = int(0.3 * SR)
t = t_(0.3)
save('shield', sum(np.sin(2 * np.pi * fr * t) * expdec(n, 0.08) for fr in (880, 1320, 1980)) + hp(noise(n), 4000) * expdec(n, 0.01), 0.6)
# 플레이어 피격: 둔탁한 충격 + 하강음
n = int(0.4 * SR)
f = sweep(700, 120, 0.4, 0.5)
save('playerHit', np.tanh((square(f, n, 0.5) * expdec(n, 0.12) * 0.6 + boom(0.4, 0.08, 2000, 70, 1.0)) * 1.5), 0.85)
# 필살 게이지 가득
T = 0.5
save('gaugeFull', mix(i_bell(n2m('A6'), 0.1, 1), at(i_bell(n2m('E7'), 0.25, 1), 0.08, T)), 0.65)
# 메뉴 이동 / 결정 (90년대 아케이드 UI)
n = int(0.045 * SR)
save('menuMove', square(np.full(n, 1320.0), n, 0.5) * env(n, 0.002, 0.01, 0.7, 0.01), 0.45)
T = 0.35
x = mix(i_chip(n2m('C6'), 0.05, 1, 0.5), at(i_chip(n2m('G6'), 0.06, 1, 0.5), 0.06, T), at(i_chip(n2m('C7'), 0.15, 1, 0.5), 0.12, T))
save('menuOk', x, 0.65)
# 출격 (스테이지 시작)
T = 1.2
x = np.zeros(int(T * SR))
for i, m in enumerate([62, 69, 74]):
    x += at(i_brass(m, 0.12 if i < 2 else 0.6, 1.0), i * 0.13, T)
x += at(d_crash(0.6), 0.26, T)[: len(x)] if False else 0
save('start', x, 0.8)
# 보스 장갑 파손: 금속 찢어지는 '콰직' + 중형 폭발
T = 1.1
n = int(0.45 * SR)
t = t_(0.45)
crunch = sum(np.sin(2 * np.pi * fr * t + 2.5 * np.sin(2 * np.pi * fr * 1.37 * t)) * expdec(n, 0.09) for fr in (240, 380, 610)) * 0.4
crunch += bp(noise(n), 900, 5000) * expdec(n, 0.06)
save('armorBreak', np.tanh(mix(crunch * 1.2, at(boom(0.9, 0.2, 2200, 55, 1.2), 0.04, T)) * 1.5), 0.92)
