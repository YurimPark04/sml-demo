"""CSV 파일을 pandas DataFrame으로 읽는 connector."""

from pathlib import Path
from typing import Any

import pandas as pd

from sml_dataset.connectors.base import DataConnector


class CsvConnector(DataConnector):
    """read_csv 옵션을 그대로 받아 범용 CSV 로딩을 지원한다."""

    def __init__(self, path: str, **read_csv_kwargs: Any) -> None:
        self.path = Path(path)
        self.read_csv_kwargs = read_csv_kwargs

    def load(self) -> pd.DataFrame:
        return pd.read_csv(self.path, **self.read_csv_kwargs)
