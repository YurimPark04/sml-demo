"""데이터셋 preview와 컬럼 단위 메타데이터를 생성한다."""

from typing import Any

import pandas as pd


def build_metadata(df: pd.DataFrame, preview_rows: int = 5) -> dict[str, Any]:
    """프론트/노트북에서 바로 표시할 수 있는 metadata dict를 반환한다."""

    return {
        "shape": {"rows": int(df.shape[0]), "columns": int(df.shape[1])},
        "columns": [
            {
                "name": col,
                "dtype": str(df[col].dtype),
                "missing_count": int(df[col].isna().sum()),
                "missing_ratio": float(df[col].isna().mean()),
                "unique_count": int(df[col].nunique(dropna=True)),
            }
            for col in df.columns
        ],
        "preview": df.head(preview_rows).to_dict(orient="records"),
    }
