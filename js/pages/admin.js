// pages/admin.js — 07 관리자 (대시보드 / 사용자 / 데이터)
// 하단 탭바의 홈·사용자·데이터가 각각 이 화면으로 이동한다. 승인은 프론트 상태를
// 바꿔서(대기→활성) 카운트가 실시간으로 반영되게 한다. (예측 데이터는 건드리지 않음)

import { state, ensureSession } from '../state.js';
import { refresh, isStale } from '../router.js';
import { logoBar, tabBar, roleBadge, badge, kpiGrid, wire, toast } from '../components.js';
import { icon } from '../icons.js';
import { fetchPipeline } from '../api.js';
import {
  getPending, approveUser, allActiveUsers, approvalLog, dataSources,
  totalUsers, pendingCount, roleCount,
} from '../adminData.js';

/* 공통 상단 헤더 */
function adminHeader() {
  const s = ensureSession();
  return `
    ${logoBar()}
    <div class="role-row">
      ${roleBadge('admin')}
      <span class="role-row__meta">시스템 운영</span>
      <span class="role-row__name">${s.nickname} 님</span>
    </div>`;
}

/* 승인 버튼 배선 → 승인 처리 후 화면 갱신(카운트·목록 반영) */
function wireApprove(root) {
  root.querySelectorAll('[data-approve]').forEach((el) =>
    el.addEventListener('click', () => {
      const u = approveUser(el.dataset.approve);
      if (u) toast(`${u.name} 님을 승인했어요 · ${u.approvedAt}`);
      refresh();
    }));
}

/* ============================ 07-1 관리자 대시보드(홈) ============================ */
export function renderHomeAdmin(root) {
  state.role = 'admin';

  const pending = getPending();
  const kpiItems = [
    { label: '전체 사용자', value: `${totalUsers()}명`,
      sub: `물류 ${roleCount('logistics')} · 어민 ${roleCount('fisher')} · 관리 ${roleCount('admin')}` },
    { label: '승인 대기', value: `${pendingCount()}명`,
      sub: pendingCount() ? '확인이 필요해요' : '모두 처리됨',
      valueKind: pendingCount() ? 'warn' : undefined },
    { label: '데이터 최신일', value: '2026-07-19', sub: '동기화 완료' },
    { label: '모델 MAE', value: '±1,240원', sub: '어획량 ±1.2톤 · v1.3' },
  ];

  const approvals = pending.length
    ? pending.map((p) => `
        <div class="arow">
          <div class="arow__main">
            <span class="arow__name">${p.name} <span class="arow__meta">경남 ${p.region}</span></span>
            <span class="arow__sub">${p.email} · 신청 ${p.requestedAt}</span>
          </div>
          <div class="arow__right">
            ${roleBadge(p.roleKey)}
            <button class="btn btn--sm btn--primary" data-approve="${p.email}">승인</button>
          </div>
        </div>`).join('')
    : `<div class="admin-empty">${icon('check', 16)} 대기 중인 신청을 모두 처리했어요</div>`;

  const activity = approvalLog.length
    ? approvalLog.map((a) => `
        <div class="arow">
          <div class="arow__main">
            <span class="arow__name">${a.name}</span>
            <span class="arow__sub">${a.approvedAt} · 승인 완료</span>
          </div>
          <div class="arow__right">${roleBadge(a.roleKey)}${badge('승인', 'ok')}</div>
        </div>`).join('')
    : '';
  const activityBlock = activity ? `
    <div class="section-head">
      <div><div class="section-title">최근 승인 활동</div><div class="section-sub">이번 세션 ${approvalLog.length}건</div></div>
    </div>
    <div class="lgroup__box">${activity}</div>` : '';

  root.innerHTML = `
    <section class="screen screen--tab">
      ${adminHeader()}
      ${kpiGrid(kpiItems)}

      <div class="section-head">
        <div><div class="section-title">승인 대기 사용자</div><div class="section-sub">대기 ${pendingCount()}명</div></div>
        <span class="section-link" data-nav="/admin/users">사용자 관리 ›</span>
      </div>
      <div class="lgroup__box">${approvals}</div>

      ${activityBlock}

      <button class="btn btn--primary" data-toast="예측 갱신을 시작했어요">예측 갱신 실행</button>
    </section>
    ${tabBar('home')}
  `;
  wire(root);
  wireApprove(root);
}

/* ============================ 07-2 사용자 관리 ============================ */
export function renderAdminUsers(root) {
  state.role = 'admin';

  const users = allActiveUsers();
  const rows = users.map((u) => `
    <div class="arow">
      <div class="arow__main">
        <span class="arow__name">${u.name} ${u.justApproved ? badge('신규', 'ok') : ''}</span>
        <span class="arow__sub">${u.email} · 경남 ${u.region} · 가입 ${u.joinedAt}</span>
      </div>
      <div class="arow__right">${roleBadge(u.roleKey)}</div>
    </div>`).join('');

  const pending = getPending();
  const pendingBlock = pending.length ? `
    <div class="section-head">
      <div><div class="section-title">승인 대기</div><div class="section-sub">${pending.length}명 · 홈에서 승인</div></div>
      <span class="section-link" data-nav="/home/admin">승인하기 ›</span>
    </div>
    <div class="lgroup__box">${pending.map((p) => `
      <div class="arow">
        <div class="arow__main">
          <span class="arow__name">${p.name} <span class="arow__meta">경남 ${p.region}</span></span>
          <span class="arow__sub">${p.email} · 신청 ${p.requestedAt}</span>
        </div>
        <div class="arow__right">${roleBadge(p.roleKey)}${badge('대기', 'warn')}</div>
      </div>`).join('')}</div>` : '';

  root.innerHTML = `
    <section class="screen screen--tab">
      ${adminHeader()}
      <div class="section-head">
        <div><div class="section-title">현재 사용자</div><div class="section-sub">총 ${totalUsers()}명 · 물류 ${roleCount('logistics')} · 어민 ${roleCount('fisher')} · 관리 ${roleCount('admin')}</div></div>
      </div>
      <div class="lgroup__box">${rows}</div>
      ${pendingBlock}
    </section>
    ${tabBar('users')}
  `;
  wire(root);
}

/* ============================ 07-3 데이터 파이프라인 ============================ */
const PIPE_SRC = {
  '위판 (수협)': '경남 위판장 실적',
  '해양 날씨 (부이)': '통영 해양기상부이',
  '노량진 소매': '노량진수산시장 소매 시세',
};
function dsrcCard(d) {
  return `
    <div class="dsrc">
      <div class="dsrc__top"><span class="dsrc__name">${d.name}</span>${badge(d.status, d.kind)}</div>
      <div class="dsrc__src">${icon('pin', 13)} ${d.source}</div>
      <div class="dsrc__foot">
        <span>${icon('database', 13)} ${d.count}</span>
        <span>${icon('clock', 13)} 동기화 ${d.lastSync}</span>
      </div>
    </div>`;
}
// API PipelineSource → dsrc 카드 데이터
function pipelineToCard(p) {
  const ok = p.latest != null;
  return {
    name: p.name, count: `${(p.count ?? 0).toLocaleString()}건`,
    status: ok ? '정상' : '미수집', kind: ok ? 'ok' : 'warn',
    source: PIPE_SRC[p.name] || '수집 원본', lastSync: p.latest ?? '—',
  };
}

export function renderAdminData(root, token) {
  state.role = 'admin';

  const okCount = dataSources.filter((d) => d.kind === 'ok').length;
  const cards = dataSources.map(dsrcCard).join('');

  root.innerHTML = `
    <section class="screen screen--tab">
      ${adminHeader()}
      <div class="section-head">
        <div><div class="section-title">데이터 파이프라인</div><div class="section-sub" id="dsrcSub">${okCount}/${dataSources.length} 소스 정상</div></div>
      </div>
      <div class="dsrc-list" id="dsrcList">${cards}</div>
      <button class="btn btn--primary" data-toast="데이터 동기화를 시작했어요">지금 동기화</button>
    </section>
    ${tabBar('data')}
  `;
  wire(root);

  // ── 백엔드 연동: 실제 파이프라인 현황으로 교체 (실패 시 mock 유지) ──
  (async () => {
    try {
      const rows = await fetchPipeline();
      if (isStale(token) || !Array.isArray(rows) || !rows.length) return;
      const mapped = rows.map(pipelineToCard);
      const list = root.querySelector('#dsrcList');
      const sub = root.querySelector('#dsrcSub');
      if (list) list.innerHTML = mapped.map(dsrcCard).join('');
      if (sub) sub.textContent = `${mapped.filter((d) => d.kind === 'ok').length}/${mapped.length} 소스 정상`;
    } catch { /* API 미연결 → mock 유지 */ }
  })();
}
