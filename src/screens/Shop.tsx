import { useEffect, useState } from 'react';
import PixelIcon from '../components/PixelIcon';
import { DEFAULT_ITEMS, SHOP_ITEMS, SHOP_SLOTS, type ShopItem } from '../platform/content';
import { usePlayer } from '../platform/PlayerContext';
import type { PlayerData, ShopSlot } from '../platform/types';
import Avatar from '../ui/Avatar';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Deco, Portrait } from '../ui/Cosmetics';
import PixelButton from '../ui/PixelButton';
import PixelPanel from '../ui/PixelPanel';

function Preview({ item, p }: { item: ShopItem; p: PlayerData }) {
  return (
    <div className="pv">
      {item.slot === 'frame' && <Portrait p={p} size={30} frame={item.style} deco="none" />}
      {item.slot === 'avatarDeco' && (
        <span style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
          <Avatar id={p.avatarId} size={36} />
          <Deco style={item.style} size={2} />
        </span>
      )}
      {item.slot === 'nameplate' && <b className={`p-nameplate-text sh-nameplate-${item.style}`}>{p.nickname}</b>}
      {item.slot === 'titleStyle' && <span className={`p-titleplate sh-titleStyle-${item.style}`}>고나 친구</span>}
      {item.slot === 'background' && <div className={`swatch sh-background-${item.style}`} />}
    </div>
  );
}

export default function Shop({ onBack, onToast }: { onBack: () => void; onToast: (t: string) => void }) {
  const { player, buy, equip, unequip, visit } = usePlayer();
  const [slot, setSlot] = useState<ShopSlot>('frame');
  const [confirm, setConfirm] = useState<ShopItem | null>(null);
  useEffect(() => visit('shop'), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!player) return null;
  const items = SHOP_ITEMS.filter((i) => i.slot === slot);
  const equippedId = player.inventory.equipped[slot];
  return (
    <div className="p-screen">
      <div className="p-bar"><button type="button" className="p-back" onClick={onBack} aria-label="뒤로">‹</button><h2>상점 SHOP</h2></div>
      <div className="p-scroll">
        <section className="p-panel p-row">
          <PixelIcon name="coin" size={2} /><b style={{ fontSize: 15 }}>{player.coinBalance.toLocaleString('ko-KR')}</b>
          <span className="p-muted" style={{ flex: 1 }}>고나 코인 · 게임에서 모은 무료 코인으로만 살 수 있어요. 꾸미기 전용이라 게임 능력과 무관해요.</span>
        </section>
        <div className="p-tabs" role="tablist">
          {SHOP_SLOTS.map((s) => <button key={s.id} type="button" role="tab" aria-selected={slot === s.id} className={slot === s.id ? 'on' : ''} onClick={() => setSlot(s.id)}>{s.label}</button>)}
        </div>
        <div className="p-shop-items">
          {items.map((i) => {
            const owned = player.inventory.owned.includes(i.id);
            const eq = equippedId === i.id;
            const canBuy = player.coinBalance >= i.price;
            return (
              <div key={i.id} className={`p-shop-item${eq ? ' eq' : ''}`}>
                <Preview item={i} p={player} />
                <span>{i.name}</span>
                <small>{i.desc}</small>
                {owned ? (
                  eq ? (i.id === DEFAULT_ITEMS[slot] ? <span className="p-chip ok">기본 장착중</span> : <PixelButton small variant="sub" style={{ minHeight: 30 }} onClick={() => unequip(slot)}>장착 해제</PixelButton>)
                    : <PixelButton small style={{ minHeight: 30 }} onClick={() => equip(i.id)}>장착</PixelButton>
                ) : (
                  <PixelButton small className={canBuy ? '' : 'off'} disabled={!canBuy} style={{ minHeight: 30 }} onClick={() => setConfirm(i)}>🪙 {i.price.toLocaleString('ko-KR')}{canBuy ? '' : ' (부족)'}</PixelButton>
                )}
              </div>
            );
          })}
        </div>
        <PixelPanel title="구매 내역">
          {player.inventory.history.length === 0 ? <p className="p-muted">아직 구매한 아이템이 없어요.</p> : (
            <div className="p-list">
              {[...player.inventory.history].reverse().slice(0, 8).map((h, k) => {
                const it = SHOP_ITEMS.find((x) => x.id === h.itemId);
                return <div key={k} className="p-row" style={{ justifyContent: 'space-between', fontSize: 11 }}><span>{it?.name ?? h.itemId}</span><span>🪙 {h.price} · {h.at.slice(0, 10)}</span></div>;
              })}
            </div>
          )}
        </PixelPanel>
      </div>
      {confirm && (
        <ConfirmDialog
          title={`${confirm.name} 구매`}
          text={`🪙 ${confirm.price} 코인을 사용해요. (잔액 ${player.coinBalance} → ${player.coinBalance - confirm.price})`}
          okLabel="구매"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = buy(confirm.id);
            setConfirm(null);
            onToast(r === 'ok' ? `${confirm.name} 구매 완료!` : r === 'owned' ? '이미 가지고 있어요' : r === 'no-coins' ? '코인이 부족해요' : '구매할 수 없어요');
          }}
        />
      )}
    </div>
  );
}
