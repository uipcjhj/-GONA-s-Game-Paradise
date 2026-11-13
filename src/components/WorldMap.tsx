import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { GONA, PLAZA, PLAZA_HIT, WORLD } from '../data/world';
import type { Island, Point } from '../types';

interface Props {
  islands: Island[];
  /** 고나가 섬에 도착(또는 이미 서 있는 섬을 다시 선택)했을 때 / 이동을 시작해 팝업을 접을 때(null) */
  onArrive: (id: string | null) => void;
}

const HOPS = 3;
const HOP_H = 42;

/** 광장 → 섬 경로. 섬 ↔ 섬은 광장을 거쳐 감 (다리를 따라) */
function routeBetween(islands: Island[], from: string | null, to: string | null): Point[] {
  const pathOf = (id: string | null) => (id ? islands.find((i) => i.id === id)!.map.path : [PLAZA]);
  const a = [...pathOf(from)].reverse();
  const b = pathOf(to).slice(1);
  return [...a, ...b];
}

function lengthOf(pts: Point[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return n;
}

function pointAt(pts: Point[], u: number): Point & { dx: number } {
  const total = lengthOf(pts);
  let d = u * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d <= seg || i === pts.length - 1) {
      const t = seg === 0 ? 1 : Math.min(1, d / seg);
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t, dx: pts[i].x - pts[i - 1].x };
    }
    d -= seg;
  }
  return { ...pts[pts.length - 1], dx: 0 };
}

interface Star {
  key: number;
  x: number;
  y: number;
}

export default function WorldMap({ islands, onArrive }: Props) {
  const gonaEl = useRef<HTMLDivElement>(null);
  const imgEl = useRef<HTMLImageElement>(null);
  const at = useRef<string | null>(null); // 고나가 서 있는 곳 (null = 중앙 광장)
  const pos = useRef<Point>({ ...PLAZA });
  const facing = useRef<1 | -1>(1);
  const moving = useRef(false);
  const pending = useRef<{ id: string | null } | null>(null);
  const raf = useRef(0);
  const starKey = useRef(0);
  const [stars, setStars] = useState<Star[]>([]);
  const [glow, setGlow] = useState<{ id: string; n: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const place = useCallback((p: Point, hop = 0) => {
    pos.current = p;
    const el = gonaEl.current;
    if (el) el.style.transform = `translate(${p.x - (GONA.w * GONA.scale) / 2}px, ${p.y - GONA.h * GONA.scale - hop}px)`;
    if (imgEl.current) imgEl.current.style.transform = `scaleX(${facing.current})`;
  }, []);

  useEffect(() => {
    place(PLAZA);
    return () => cancelAnimationFrame(raf.current);
  }, [place]);

  const landing = useCallback((p: Point) => {
    const base = starKey.current;
    starKey.current += 4;
    setStars((s) => [...s, ...[0, 1, 2, 3].map((i) => ({ key: base + i, x: p.x, y: p.y - 6 }))]);
    window.setTimeout(() => setStars((s) => s.filter((q) => q.key < base || q.key >= base + 4)), 600);
  }, []);

  const run = useCallback(
    (target: string | null) => {
      const pts = routeBetween(islands, at.current, target);
      if (pts.length < 2) {
        if (target) {
          setGlow((g) => ({ id: target, n: (g?.n ?? 0) + 1 }));
          onArrive(target);
        }
        return;
      }
      // 현재 위치는 항상 경로 시작점(= 서 있던 자리)과 같으므로 순간이동 없음
      moving.current = true;
      setBusy(true);
      onArrive(null);
      const dur = Math.min(900, Math.max(600, 420 + lengthOf(pts) * 0.45));
      const t0 = performance.now();
      let hopsDone = 0;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        const p = pointAt(pts, t);
        if (Math.abs(p.dx) > 1) facing.current = p.dx >= 0 ? 1 : -1;
        const hop = t >= 1 ? 0 : Math.abs(Math.sin(Math.PI * HOPS * t)) * HOP_H;
        place({ x: p.x, y: p.y }, hop);
        const done = Math.min(HOPS, Math.floor(t * HOPS));
        if (done > hopsDone && t < 1) {
          hopsDone = done;
          landing(p);
        }
        if (t < 1) {
          raf.current = requestAnimationFrame(step);
          return;
        }
        const end = pts[pts.length - 1];
        place(end);
        landing(end);
        at.current = target;
        moving.current = false;
        setBusy(false);
        if (pending.current) {
          const next = pending.current.id;
          pending.current = null;
          if (next !== target) {
            run(next);
            return;
          }
        }
        if (target) {
          setGlow((g) => ({ id: target, n: (g?.n ?? 0) + 1 }));
          onArrive(target);
        }
      };
      raf.current = requestAnimationFrame(step);
    },
    [islands, landing, onArrive, place],
  );

  const go = (id: string | null) => {
    if (moving.current) {
      pending.current = { id }; // 이동 중에 누르면 마지막 선택만 기억 → 도착 직후 이어서 이동
      return;
    }
    run(id);
  };

  const g = GONA;
  return (
    <>
      <img className="bg" src={WORLD.image} width={WORLD.w} height={WORLD.h} alt="고나 게임천국 월드맵" draggable={false} />

      <button
        type="button"
        className="hit plaza"
        style={{ left: PLAZA_HIT.x, top: PLAZA_HIT.y, width: PLAZA_HIT.w, height: PLAZA_HIT.h }}
        aria-label="중앙 광장으로 이동"
        onClick={() => go(null)}
      />
      {islands.map((i) => {
        const h = i.map.hit;
        return (
          <button
            key={i.id}
            type="button"
            className="hit"
            style={{ left: h.x, top: h.y, width: h.w, height: h.h, clipPath: h.clip }}
            aria-label={`${i.name} — ${i.status === 'open' ? '입장 가능' : 'COMING SOON'}`}
            onClick={() => go(i.id)}
          />
        );
      })}

      {glow &&
        (() => {
          const h = islands.find((i) => i.id === glow.id)!.map.hit;
          const spots = [0.22, 0.5, 0.78, 0.35, 0.65].map((fx, k) => ({ x: h.x + h.w * fx, y: h.y + h.h * [0.3, 0.2, 0.34, 0.62, 0.7][k] }));
          return (
            <div key={glow.n} className="glow" style={{ left: h.x, top: h.y, width: h.w, height: h.h }} aria-hidden>
              {spots.map((s, k) => (
                <i key={k} style={{ left: s.x - h.x, top: s.y - h.y, animationDelay: `${k * 90}ms` }} />
              ))}
            </div>
          );
        })()}

      <div ref={gonaEl} className={`gona${busy ? ' moving' : ''}`} style={{ width: g.w * g.scale, height: g.h * g.scale }}>
        <img ref={imgEl} src="./assets/gona.png" alt="고나" draggable={false} />
      </div>

      {stars.map((s) => (
        <i key={s.key} className="star" style={{ left: s.x, top: s.y, '--a': `${(s.key % 4) * 90 + 45}deg` } as CSSProperties} aria-hidden />
      ))}
    </>
  );
}
