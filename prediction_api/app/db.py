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
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()
