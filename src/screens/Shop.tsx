import { useState } from 'react';
import CoinChip from '../ui/CoinChip';
import { getItem, shopList, type ItemKind, type ShopItem } from '../platform/shop';
import { usePlayer } from '../platform/PlayerContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import PixelButton from '../ui/PixelButton';
import SubBar from '../ui/SubBar';

const KINDS: { id: ItemKind; label: string }[] = [
  { id: 'frame', label: '테두리' },
  { id: 'background', label: '배경' },
  { id: 'title', label: '칭호' },
];
/** 아이템 미리보기(임시 CSS — 최종 픽셀 에셋 승인 후 교체) */
export function ItemSwatch({ item }: { item: ShopItem }) {
  if (item.kind === 'title') return <span className="p-sw-title">{item.name.slice(0, 2)}</span>;
  if (item.kind === 'frame') return <span className="p-sw" style={{ boxShadow: `0 0 0 3px ${item.color}, 0 0 0 5px #3b1b5e` }} />;
  return <span className="p-sw" style={{ background: `repeating-conic-gradient(${item.color} 0 25%, ${item.color2} 0 50%) 0 0 / 8px 8px`, border: '2px solid #3b1b5e' }} />;
}

export default function Shop({ onBack, onToast }: { onBack: () => void; onToast: (t: string) => void }) {
  const { player, buy, equip } = usePlayer();
  const [kind, setKind] = useState<ItemKind>('frame');
  const [ask, setAsk] = useState<ShopItem | null>(null);
  if (!player) return null;
  const owned = new Set(player.inventory.owned);
  const eq = player.inventory.equipped;
  // 상점 진열(판매 아이템) + 이미 가진 보상 전용 아이템도 보유 칭호로 표시
  const list = [...shopList(), ...player.inventory.owned.map(getItem).filter((i): i is ShopItem => !!i && i.price === 0)].filter((i) => i.kind === kind);
  return (
    <div className="p-screen">
      <SubBar title="상점" onBack={onBack} right={<CoinChip value={player.coinBalance} />} />
      <div className="p-scroll">
        <p className="p-muted">고나 코인은 꾸미기에만 써요. 게임이 더 쉬워지는 아이템은 없어요.</p>
        <div className="p-tabs" role="tablist">
          {KINDS.map((k) => (
            <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'on' : ''} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
        </div>
        <div className="p-shop" data-testid="shop-list">
          {list.map((it) => {
            const has = owned.has(it.id);
            const on = eq[it.kind] === it.id;
            return (
              <div key={it.id} className="p-shopitem" data-testid={`item-${it.id}`} data-state={on ? 'equipped' : has ? 'owned' : 'sale'}>
                <ItemSwatch item={it} />
                <b>{it.name}</b>
                {it.desc && <small>{it.desc}</small>}
                {has ? (
                  <PixelButton small variant="sub" disabled={on} onClick={() => equip(it.id, it.kind) && onToast(`${it.name} 장착`)}>
                    {on ? '장착 중' : '장착'}
                  </PixelButton>
                ) : (
                  <PixelButton small disabled={player.coinBalance < it.price} onClick={() => setAsk(it)}>
                    {it.price} 코인
                  </PixelButton>
                )}
              </div>
            );
          })}
        </div>
        {kind !== 'frame' && eq[kind] && (
          <PixelButton small variant="sub" block onClick={() => equip(null, kind)}>
            장착 해제
          </PixelButton>
        )}
      </div>
      {ask && (
        <ConfirmDialog
          title="구매할까요?"
          text={`${ask.name} · ${ask.price} 코인 (구매 후 잔액 ${player.coinBalance - ask.price}). 구매한 아이템은 환불되지 않아요.`}
          okLabel="구매"
          onCancel={() => setAsk(null)}
          onOk={() => {
            const r = buy(ask.id);
            setAsk(null);
            if (r.ok) {
              equip(ask.id, ask.kind);
              onToast(`${ask.name} 구매·장착!`);
            } else onToast(r.error === 'coins' ? '코인이 모자라요' : '구매할 수 없어요');
          }}
        />
      )}
    </div>
  );
}
