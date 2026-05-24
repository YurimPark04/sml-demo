"""데이터 원천별 connector가 따라야 하는 공통 인터페이스."""

from abc import ABC, abstractmethod

import pandas as pd


class DataConnector(ABC):
    """DB, CSV 등 어떤 원천이든 DataFrame으로 반환하도록 강제한다."""

    @abstractmethod
    def load(self) -> pd.DataFrame:
        """Load a dataset into a pandas DataFrame."""
