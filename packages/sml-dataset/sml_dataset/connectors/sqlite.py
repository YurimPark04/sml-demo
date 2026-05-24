"""SQLite 데이터베이스에서 SQL query 결과를 읽는 connector."""

import sqlite3
from pathlib import Path

import pandas as pd

from sml_dataset.connectors.base import DataConnector


class SQLiteConnector(DataConnector):
    """데모 DB와 로컬 SQLite 기반 PoC에 사용하는 connector."""

    def __init__(self, database: str, query: str) -> None:
        self.database = Path(database)
        self.query = query

    def load(self) -> pd.DataFrame:
        with sqlite3.connect(self.database) as conn:
            return pd.read_sql_query(self.query, conn)
