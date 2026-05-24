"""설정의 data_source.type에 맞는 connector 객체를 생성한다."""

from typing import Any

from sml_dataset.connectors.base import DataConnector
from sml_dataset.connectors.csv import CsvConnector
from sml_dataset.connectors.sqlite import SQLiteConnector


def create_connector(source_type: str, options: dict[str, Any]) -> DataConnector:
    """API/YAML 설정을 실제 connector 인스턴스로 변환한다."""

    if source_type == "sqlite":
        return SQLiteConnector(**options)
    if source_type == "csv":
        return CsvConnector(**options)
    raise ValueError(f"Unsupported data source type: {source_type}")
