// pages/savedPredictions.js — 16 저장한 예측 (내가 저장한 것만, 처음엔 비어 있음)

import { ensureSession } from '../state.js';
import { navBar, tabBar, roleBadge, badge, certaintyOf, wire } from '../components.js';
import { icon } from '../icons.js';

export function renderSavedPredictions(root) {
  const s = ensureSession();

  const cards = s.saved.length
    ? s.saved.map((p) => `
        <div class="saved-card">
          <div class="saved-card__top">
            <span class="saved-card__date">${icon('clock', 14)} ${p.date}</span>
            ${roleBadge(p.roleKey)}
          </div>
          <div>${badge(p.type, p.typeKind || 'neutral')}</div>
          <div class="saved-card__hl">${p.headline}</div>
          <div class="saved-card__foot">
            <span class="saved-card__conf">예측 신뢰도 ${badge(certaintyOf(p.confidence).text, certaintyOf(p.confidence).kind)}</span>
            <button class="btn btn--sm btn--ghost" data-nav="/settings/report">${icon('file', 15)} 리포트 생성</button>
          </div>
        </div>`).join('')
    : `<div class="empty-state">
         <div class="empty-state__ico">${icon('bookmark', 34)}</div>
         <div class="empty-state__t">아직 저장한 예측이 없어요</div>
         <div class="empty-state__s">홈의 추천 카드에서 <b>예측 저장</b>을 누르면<br>여기에 모여요.</div>
       </div>`;

  root.innerHTML = `
    <section class="screen screen--tab screen--narrow">
      ${navBar('저장한 예측', '/settings')}
      <p class="note">저장한 예측 시나리오를 다시 확인할 수 있습니다.</p>
      ${cards}
    </section>
    ${tabBar('settings')}
  `;
  wire(root);
}
