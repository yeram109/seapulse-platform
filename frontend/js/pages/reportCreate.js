// pages/reportCreate.js — 17 리포트 생성 (reports)

import { reportItems } from '../../data/mock.js';
import { navBar, tabBar, wire, toast } from '../components.js';
import { icon } from '../icons.js';

export function renderReportCreate(root) {
  const items = reportItems.map((it, i) => `
    <label class="report-item">
      <input type="checkbox" ${it.on ? 'checked' : ''} data-report="${i}" />
      <span class="report-item__label">${icon(it.icon, 16)} ${it.label}</span>
    </label>`).join('');

  root.innerHTML = `
    <section class="screen screen--tab screen--narrow">
      ${navBar('리포트 생성', '/settings')}
      <p class="note">선택한 예측을 리포트로 만들어 저장·공유할 수 있습니다.</p>

      <div class="lgroup__box">${items}</div>

      <div class="report-preview">
        <span class="report-preview__ico">${icon('file', 30)}</span>
        <span class="report-preview__t">리포트 미리보기</span>
        <span class="report-preview__s">PDF · A4 · 한글 폰트</span>
      </div>

      <button class="btn btn--primary" id="pdfBtn">${icon('file', 16)} PDF 리포트 생성</button>
    </section>
    ${tabBar('settings')}
  `;

  // 체크 상태 기억
  root.querySelectorAll('[data-report]').forEach((el) =>
    el.addEventListener('change', () => { reportItems[Number(el.dataset.report)].on = el.checked; }));

  root.querySelector('#pdfBtn').addEventListener('click', () => toast('PDF 리포트를 생성했어요'));
  wire(root);
}
