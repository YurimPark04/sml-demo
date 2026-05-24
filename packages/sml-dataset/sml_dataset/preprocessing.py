"""Common dataset cleansing for the SML dataset module."""

from dataclasses import dataclass
from typing import Any

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, MinMaxScaler, OneHotEncoder, RobustScaler, StandardScaler


@dataclass
class PreprocessResult:
    """Cleansed features, targets, fitted transformers, and an audit report."""

    features: pd.DataFrame
    targets: pd.DataFrame
    preprocessor: ColumnTransformer | None
    encoders: dict[str, LabelEncoder]
    report: dict[str, Any]


def preprocess_dataset(
    df: pd.DataFrame,
    targets: list[str],
    options: dict[str, Any],
) -> PreprocessResult:
    """Apply missing-value handling, outlier handling, encoding, and scaling."""

    working = df.copy()
    report: dict[str, Any] = {"initial_rows": int(len(working))}

    if options.get("drop_duplicates", True):
        before = len(working)
        working = working.drop_duplicates()
        report["dropped_duplicates"] = int(before - len(working))

    missing_options = options.get("missing", {})
    working, missing_report = _apply_missing_row_deletion(working, targets, missing_options)
    report.update(missing_report)

    feature_df = working.drop(columns=targets)
    target_df = working[targets].copy()

    outlier_options = options.get("outliers", {})
    outlier_method = outlier_options.get("method", "none")
    if outlier_method == "iqr_remove":
        factor = float(outlier_options.get("factor", 1.5))
        feature_df, target_df, removed = _remove_numeric_outlier_rows(feature_df, target_df, factor)
        report["outlier_removed_rows"] = removed
    elif outlier_method == "iqr_clip":
        factor = float(outlier_options.get("factor", 1.5))
        feature_df, clipped = _clip_numeric_outliers(feature_df, factor)
        report["outlier_clipped_cells"] = clipped

    numeric_cols = feature_df.select_dtypes(include="number").columns.tolist()
    categorical_cols = [col for col in feature_df.columns if col not in numeric_cols]
    scaling_method = options.get("scaling", {}).get("method", "none")
    encoding_method = options.get("encoding", {}).get("method", "onehot")

    numeric_strategy = _normalize_missing_strategy(missing_options.get("numeric", "median"), "numeric")
    categorical_strategy = _normalize_missing_strategy(
        missing_options.get("categorical", "most_frequent"), "categorical"
    )

    numeric_steps: list[tuple[str, Any]] = [("imputer", SimpleImputer(strategy=numeric_strategy))]
    scaler = _build_scaler(scaling_method)
    if scaler is not None:
        numeric_steps.append(("scaler", scaler))

    encoders: dict[str, LabelEncoder] = {}
    if encoding_method == "label":
        for col in categorical_cols:
            fill_value = _categorical_fill_value(feature_df[col])
            imputed = feature_df[col].fillna(fill_value)
            encoder = LabelEncoder()
            feature_df[col] = encoder.fit_transform(imputed.astype(str))
            encoders[col] = encoder
        categorical_cols = []

    transformers = []
    if numeric_cols:
        transformers.append(("numeric", Pipeline(numeric_steps), numeric_cols))
    if categorical_cols:
        transformers.append(
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy=categorical_strategy)),
                        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                    ]
                ),
                categorical_cols,
            )
        )

    if transformers:
        preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")
        transformed = preprocessor.fit_transform(feature_df)
        feature_names = _feature_names(preprocessor)
        processed_features = pd.DataFrame(transformed, columns=feature_names, index=feature_df.index)
    else:
        preprocessor = None
        processed_features = pd.DataFrame(index=feature_df.index)

    report.update(
        {
            "final_rows": int(len(processed_features)),
            "feature_columns_before": int(feature_df.shape[1]),
            "feature_columns_after": int(processed_features.shape[1]),
            "numeric_features": numeric_cols,
            "categorical_features": categorical_cols,
            "encoding": encoding_method,
            "scaling": scaling_method,
            "missing_numeric": numeric_strategy,
            "missing_categorical": categorical_strategy,
            "outlier_method": outlier_method,
        }
    )
    return PreprocessResult(processed_features, target_df, preprocessor, encoders, report)


def _apply_missing_row_deletion(
    df: pd.DataFrame,
    targets: list[str],
    missing_options: dict[str, Any],
) -> tuple[pd.DataFrame, dict[str, int]]:
    delete_all = missing_options.get("method") == "delete"
    numeric_delete = missing_options.get("numeric") == "delete"
    categorical_delete = missing_options.get("categorical") == "delete"
    if not (delete_all or numeric_delete or categorical_delete):
        return df, {"missing_deleted_rows": 0}

    subset = targets.copy()
    feature_df = df.drop(columns=targets)
    if delete_all:
        subset.extend(feature_df.columns.tolist())
    else:
        if numeric_delete:
            subset.extend(feature_df.select_dtypes(include="number").columns.tolist())
        if categorical_delete:
            subset.extend(
                [col for col in feature_df.columns if col not in feature_df.select_dtypes(include="number").columns]
            )
    before = len(df)
    result = df.dropna(subset=list(dict.fromkeys(subset)))
    return result, {"missing_deleted_rows": int(before - len(result))}


def _normalize_missing_strategy(strategy: str, feature_type: str) -> str:
    if strategy == "delete":
        return "median" if feature_type == "numeric" else "most_frequent"
    if feature_type == "numeric" and strategy in {"mean", "median"}:
        return strategy
    if feature_type == "categorical" and strategy in {"most_frequent", "constant"}:
        return strategy
    if feature_type == "categorical" and strategy in {"mean", "median"}:
        return "most_frequent"
    return "median" if feature_type == "numeric" else "most_frequent"


def _categorical_fill_value(series: pd.Series) -> Any:
    mode = series.mode(dropna=True)
    return mode.iloc[0] if not mode.empty else "missing"


def _remove_numeric_outlier_rows(
    features: pd.DataFrame,
    targets: pd.DataFrame,
    factor: float,
) -> tuple[pd.DataFrame, pd.DataFrame, int]:
    mask = pd.Series(True, index=features.index)
    for col in features.select_dtypes(include="number").columns:
        q1 = features[col].quantile(0.25)
        q3 = features[col].quantile(0.75)
        iqr = q3 - q1
        if pd.isna(iqr) or iqr == 0:
            continue
        lower = q1 - factor * iqr
        upper = q3 + factor * iqr
        mask &= features[col].between(lower, upper) | features[col].isna()
    removed = int((~mask).sum())
    return features.loc[mask].copy(), targets.loc[mask].copy(), removed


def _clip_numeric_outliers(df: pd.DataFrame, factor: float) -> tuple[pd.DataFrame, int]:
    result = df.copy()
    clipped_cells = 0
    for col in result.select_dtypes(include="number").columns:
        q1 = result[col].quantile(0.25)
        q3 = result[col].quantile(0.75)
        iqr = q3 - q1
        if pd.isna(iqr) or iqr == 0:
            continue
        lower = q1 - factor * iqr
        upper = q3 + factor * iqr
        before = result[col].copy()
        result[col] = result[col].clip(lower=lower, upper=upper)
        clipped_cells += int((before != result[col]).sum())
    return result, clipped_cells


def _build_scaler(method: str | None) -> Any:
    normalized = (method or "none").lower()
    if normalized == "standard":
        return StandardScaler()
    if normalized == "minmax":
        return MinMaxScaler()
    if normalized == "robust":
        return RobustScaler()
    if normalized in {"none", "null"}:
        return None
    raise ValueError(f"Unsupported scaling method: {method}")


def _feature_names(preprocessor: ColumnTransformer) -> list[str]:
    try:
        return preprocessor.get_feature_names_out().tolist()
    except Exception:
        names: list[str] = []
        for _, _, columns in preprocessor.transformers_:
            names.extend(list(columns))
        return names
