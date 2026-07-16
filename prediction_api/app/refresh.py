"""예측 갱신 파이프라인 실행 (관리자 홈의 '예측 갱신 실행' 버튼).

src/ 스크립트를 순서대로 subprocess 로 돌린다. 같은 프로세스에서 import 하지 않는
이유는 두 가지 -- (1) 스크립트가 모듈 스코프에서 파일을 읽고 print 하는 실행형이라
import 하면 부작용이 그대로 일어나고, (2) pandas/sklearn 을 API 프로세스에 상주시킬
이유가 없다 (API 자체는 sqlite 조회만 한다).

스크립트들은 레포 루트 기준 상대경로("data/...")를 쓰면서 서로를 `from common import`
로 부른다. 그래서 cwd=레포 루트 + PYTHONPATH=src 로 실행해야 한다.

주의: 이 작업은 catch_predictions/price_predictions/feature_set/scenarios 계열을
비우고 다시 채운다. 실행 중 조회하면 빈 결과가 나올 수 있다.
"""
import os
import subprocess
import sys
import threading
from datetime import datetime, timezone

from .db import DB_PATH

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 순서가 중요하다. predict_future 가 outputs/*_future.csv 를 만들고, load_to_db 가
# 그걸 DB에 넣고, generate_scenarios 가 그 예측을 시나리오로 바꾼다.
STEPS = [
    ("미래 예측 추론", "src/predict_future.py"),
    ("DB 적재", "src/load_to_db.py"),
    ("시나리오 생성", "src/generate_scenarios.py"),
]

STEP_TIMEOUT_SEC = 600

# 상태는 프로세스 메모리에만 있다. API 를 재시작하면 idle 로 돌아간다.
_lock = threading.Lock()
_job = {"state": "idle", "step": None, "started_at": None, "finished_at": None, "message": None}


def status() -> dict:
    with _lock:
        return dict(_job)


def _set(**kw):
    with _lock:
        _job.update(kw)


def _run():
    env = {
        **os.environ,
        "PYTHONPATH": os.path.join(_REPO_ROOT, "src"),
        "PYTHONIOENCODING": "utf-8",
    }
    try:
        for label, script in STEPS:
            _set(step=label)
            proc = subprocess.run(
                [sys.executable, script],
                cwd=_REPO_ROOT,
                env=env,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=STEP_TIMEOUT_SEC,
            )
            if proc.returncode != 0:
                # 스크립트 실패는 마지막 몇 줄이 원인을 담고 있다.
                tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-3:]
                _set(
                    state="failed",
                    finished_at=datetime.now(timezone.utc).isoformat(),
                    message=f"{label} 실패: " + " / ".join(tail),
                )
                return
        _set(
            state="done",
            step=None,
            finished_at=datetime.now(timezone.utc).isoformat(),
            message="예측 갱신 완료",
        )
    except subprocess.TimeoutExpired:
        _set(
            state="failed",
            finished_at=datetime.now(timezone.utc).isoformat(),
            message=f"시간 초과 ({STEP_TIMEOUT_SEC}초)",
        )
    except Exception as exc:  # noqa: BLE001 - 어떤 실패든 상태로 남겨야 폴링이 끝난다
        _set(
            state="failed",
            finished_at=datetime.now(timezone.utc).isoformat(),
            message=f"실행 오류: {exc}",
        )


def start() -> tuple[bool, str]:
    """(시작됨?, 메시지). 이미 돌고 있으면 (False, ...)."""
    with _lock:
        if _job["state"] == "running":
            return False, "이미 갱신이 진행 중입니다."
        _job.update(
            state="running",
            step=STEPS[0][0],
            started_at=datetime.now(timezone.utc).isoformat(),
            finished_at=None,
            message=None,
        )

    threading.Thread(target=_run, daemon=True).start()
    return True, "예측 갱신을 시작했습니다."


def db_is_default() -> bool:
    """파이프라인은 레포의 data/seapulse_final.db 를 직접 덮어쓴다. SEAPULSE_DB_PATH 로
    다른 DB 를 보고 있으면 갱신 결과가 그 DB 에 반영되지 않아 혼란만 준다."""
    from .db import DEFAULT_DB_PATH

    return os.path.abspath(DB_PATH) == os.path.abspath(str(DEFAULT_DB_PATH))
