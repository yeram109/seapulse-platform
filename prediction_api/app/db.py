"""SQLite 연결. seapulse_final.db는 load_to_db.py/generate_scenarios.py가 채운 DB."""
import os
import sqlite3
from pathlib import Path
from typing import Iterator

# 레포 루트 기준으로 DB를 찾는다. __file__ 기준이라 uvicorn을 어느 디렉터리에서
# 띄우든 같은 DB를 본다 (cwd 상대 경로면 레포 루트 밖에서 실행 시 조용히 실패).
_REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = _REPO_ROOT / "data" / "seapulse_final.db"

DB_PATH = os.environ.get("SEAPULSE_DB_PATH", str(DEFAULT_DB_PATH))


def get_conn() -> Iterator[sqlite3.Connection]:
    # check_same_thread=False: FastAPI 는 동기 엔드포인트와 동기 의존성을 각각
    # 스레드풀에 던지므로, 이 커넥션을 만든 스레드와 그걸 쓰는 엔드포인트의
    # 스레드가 다를 수 있다 (동시 요청이 겹칠 때 실제로 갈린다). 기본값
    # True 로 두면 그때 ProgrammingError 가 난다.
    # 커넥션을 요청 간에 공유하지 않고 이 함수가 열고 닫으므로, 한 커넥션을
    # 두 스레드가 동시에 쓰는 상황은 생기지 않는다.
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()
