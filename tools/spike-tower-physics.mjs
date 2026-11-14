// M3 기술 검증(spike): matter-js 가 '아슬아슬 탑'에 실제로 필요한지 숫자로 확인. (앱 코드 아님)
import Matter from 'matter-js';
const { Engine, Bodies, Body, Composite } = Matter;

function world(opts = {}) {
  const engine = Engine.create({ enableSleeping: !!opts.sleep, positionIterations: 8, velocityIterations: 6 });
  engine.gravity.y = 1.1;
  const plate = Bodies.rectangle(0, 6, 110, 12, { isStatic: true, friction: 0.9, frictionStatic: 1.2 });
  Composite.add(engine.world, plate);
  return { engine, plate };
}
const rect = (x, y, w, h, o = {}) => Bodies.rectangle(x, y, w, h, { friction: 0.8, frictionStatic: 1.0, restitution: 0.02, density: 0.002, ...o });
function settle(engine, ms = 3000) { for (let t = 0; t < ms; t += 1000 / 60) Engine.update(engine, 1000 / 60); }
const maxSpeed = (engine) => Math.max(0, ...Composite.allBodies(engine.world).filter((b) => !b.isStatic).map((b) => b.speed + Math.abs(b.angularSpeed) * 10));

// 1) 가운데 정렬로 20개 쌓기: 안정적으로 멈추는가?
{
  const { engine } = world();
  const bodies = [];
  let y = -8;
  for (let i = 0; i < 20; i++) { const h = 14 + (i % 3) * 3; const b = rect((i % 2 ? 2 : -2), y - h / 2 - 1, 40 + (i % 4) * 6, h); Composite.add(engine.world, b); bodies.push(b); y -= h; settle(engine, 600); }
  settle(engine, 2500);
  const topY = Math.min(...bodies.map((b) => b.bounds.min.y));
  console.log('1) 20개 쌓기: 최종 최대속도', maxSpeed(engine).toFixed(4), '· 높이', (-topY).toFixed(0), '· 쓰러진 조각', bodies.filter((b) => b.position.y > 30).length);
}
// 2) 가장자리에 무거운 조각: 균형이 깨져 쓰러지는가? (물리 '손맛'의 핵심)
{
  const { engine } = world();
  const base = rect(0, -10, 80, 14); const heavy = rect(34, -30, 40, 22, { density: 0.008 });
  Composite.add(engine.world, [base, heavy]); settle(engine, 3000);
  console.log('2) 가장자리 무거운 조각: 조각 y =', heavy.position.y.toFixed(1), heavy.position.y > 20 ? '→ 떨어짐(기대대로)' : '→ 버팀');
  const { engine: e2 } = world(); const b2 = rect(0, -10, 80, 14); const light = rect(20, -30, 40, 22, { density: 0.0005 });
  Composite.add(e2.world, [b2, light]); settle(e2, 3000);
  console.log('   가운데 쪽 가벼운 조각: 조각 y =', light.position.y.toFixed(1), light.position.y > 20 ? '→ 떨어짐' : '→ 버팀(기대대로)');
}
// 3) 삼각형·팔각형(굴러감) 같은 비직사각 도형도 정상인가?
{
  const { engine } = world();
  const tri = Bodies.fromVertices(0, -30, [[{ x: -15, y: 17 }, { x: 15, y: 17 }, { x: 0, y: -17 }]], { friction: 0.8 });
  const oct = Bodies.polygon(25, -60, 8, 14, { friction: 0.9 });
  Composite.add(engine.world, [tri, oct]); settle(engine, 3000);
  console.log('3) 삼각형 y', tri.position.y.toFixed(1), '각도', (tri.angle * 180 / Math.PI).toFixed(0), '· 팔각형 y', oct.position.y.toFixed(1), '(굴러 떨어졌으면 y>20)');
}
// 4) 성능: 조각 25개, 1000스텝
{
  const { engine } = world({ sleep: true });
  let y = -8; for (let i = 0; i < 25; i++) { const b = rect(0, y - 8, 44, 14); Composite.add(engine.world, b); y -= 15; }
  settle(engine, 1500);
  const t0 = performance.now(); const N = 1000; for (let i = 0; i < N; i++) Engine.update(engine, 1000 / 60);
  console.log('4) 25개 쌓인 상태 스텝 평균', ((performance.now() - t0) / N).toFixed(3), 'ms/스텝 (모바일은 이 서버 대비 약 3~6배 느릴 수 있음)');
}
// 5) 결정성: 같은 입력 → 같은 결과
{
  const run = () => { const { engine } = world(); const bs = []; for (let i = 0; i < 8; i++) { const b = rect(i % 2 ? 9 : -7, -10 - i * 16, 40, 14); Composite.add(engine.world, b); bs.push(b); } settle(engine, 4000); return bs.map((b) => b.position.x.toFixed(6) + ',' + b.position.y.toFixed(6)).join(';'); };
  console.log('5) 결정성(같은 입력 두 번):', run() === run() ? '동일' : '다름');
}
