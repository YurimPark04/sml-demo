"""Supported algorithm registry and hyperparameter definitions."""

from collections.abc import Callable
from dataclasses import asdict, dataclass
from typing import Any

from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import Lasso, LinearRegression, Ridge
from sklearn.multioutput import MultiOutputRegressor
from sklearn.neural_network import MLPClassifier

from sml_modeling.task import ModelingTask


@dataclass(frozen=True)
class HyperparameterSpec:
    """UI/API metadata for one tunable hyperparameter."""

    name: str
    default: Any
    value_type: str
    allowed: str
    description: str
    benefit_when_increased: str | None = None
    risk_when_increased: str | None = None
    minimum: float | int | None = None
    maximum: float | int | None = None
    choices: tuple[Any, ...] | None = None


@dataclass(frozen=True)
class AlgorithmSpec:
    """Registry item binding algorithm name, task, builder, and parameter schema."""

    name: str
    task: ModelingTask
    builder: Callable[[int, dict[str, Any]], Any]
    hyperparameters: tuple[HyperparameterSpec, ...] = ()
    optional_dependency: str | None = None


def available_algorithms(task: ModelingTask) -> list[str]:
    """Return algorithm names available for a task."""

    return [spec.name for spec in _registry() if spec.task == task]


def algorithm_hyperparameters(task: ModelingTask, name: str | None = None) -> dict[str, Any]:
    """Return hyperparameter schema for one algorithm or all algorithms in a task."""

    specs = [spec for spec in _registry() if spec.task == task and (name is None or spec.name == name)]
    if name is not None and not specs:
        raise ValueError(f"Unsupported algorithm '{name}' for task '{task.value}'.")
    return {
        spec.name: [asdict(param) for param in spec.hyperparameters]
        for spec in specs
    }


def default_hyperparameters(task: ModelingTask, name: str) -> dict[str, Any]:
    """Return default hyperparameter values for an algorithm."""

    spec = _find_spec(name, task)
    return {param.name: param.default for param in spec.hyperparameters}


def resolve_hyperparameters(
    task: ModelingTask,
    name: str,
    hyperparameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return validated and type-coerced hyperparameters for an algorithm."""

    spec = _find_spec(name, task)
    return _resolve_hyperparameters(spec, hyperparameters or {})


def build_model(
    name: str,
    task: ModelingTask,
    target_count: int,
    hyperparameters: dict[str, Any] | None = None,
) -> Any:
    """Validate overrides and create the scikit-learn compatible estimator."""

    spec = _find_spec(name, task)
    try:
        params = resolve_hyperparameters(task, name, hyperparameters)
        return spec.builder(target_count, params)
    except ModuleNotFoundError as exc:
        dependency = spec.optional_dependency or exc.name
        raise RuntimeError(
            f"Algorithm '{name}' requires optional dependency '{dependency}'."
        ) from exc


def _registry() -> list[AlgorithmSpec]:
    """The official algorithm list. Add future P5/P6 hyperparameters here."""

    return [
        AlgorithmSpec(
            "xgboost",
            ModelingTask.BINARY_CLASSIFICATION,
            _xgboost_classifier,
            (
                HyperparameterSpec("learning_rate", 0.1, "float", "0.001 ~ 0.999", "Learning rate.", "Faster learning.", "Higher overfitting risk.", 0.001, 0.999),
                HyperparameterSpec("max_depth", 5, "int", "1 ~ 99", "Maximum tree depth.", "More complex patterns.", "Higher overfitting risk.", 1, 99),
                HyperparameterSpec("min_child_weight", 1, "int", "1 ~ 99", "Minimum child node weight.", "More conservative splits.", "May miss fine patterns.", 1, 99),
                HyperparameterSpec("colsample_bytree", 1.0, "float", "0.1 ~ 1.0", "Feature sampling ratio per tree.", "More feature usage.", "Lower regularization.", 0.1, 1.0),
            ),
            "xgboost",
        ),
        AlgorithmSpec(
            "lightgbm",
            ModelingTask.BINARY_CLASSIFICATION,
            _lightgbm_classifier,
            (
                HyperparameterSpec("learning_rate", 0.1, "float", "0.001 ~ 0.999", "Learning rate.", "Faster learning.", "Higher overfitting risk.", 0.001, 0.999),
                HyperparameterSpec("max_depth", -1, "int", "-1 or 1 ~ 99", "Maximum tree depth. -1 means no limit.", "More complex patterns.", "Higher overfitting risk.", -1, 99),
                HyperparameterSpec("min_child_samples", 20, "int", "1 ~ 99", "Minimum samples in a leaf.", "More conservative splits.", "May miss fine patterns.", 1, 99),
                HyperparameterSpec("num_leaves", 31, "int", "1 ~ 99", "Maximum number of leaves.", "Learns complex data.", "Higher overfitting risk.", 1, 99),
            ),
            "lightgbm",
        ),
        AlgorithmSpec(
            "catboost",
            ModelingTask.BINARY_CLASSIFICATION,
            _catboost_classifier,
            (
                HyperparameterSpec("learning_rate", 0.03, "float", "0.001 ~ 0.999", "Learning rate.", "Faster learning.", "Higher overfitting risk.", 0.001, 0.999),
                HyperparameterSpec("depth", 6, "int", "1 ~ 99", "Tree depth.", "More complex patterns.", "Higher overfitting risk.", 1, 99),
                HyperparameterSpec("iterations", 500, "int", "1 ~ 9999", "Number of boosting iterations.", "Better fit.", "Longer training time.", 1, 9999),
                HyperparameterSpec("l2_leaf_reg", 3, "int", "1 ~ 99", "L2 leaf regularization.", "Prevents overfitting.", "May underfit.", 1, 99),
            ),
            "catboost",
        ),
        AlgorithmSpec(
            "random_forest",
            ModelingTask.BINARY_CLASSIFICATION,
            _random_forest_classifier,
            (
                HyperparameterSpec("max_depth", None, "int_or_none", "None or 1 ~ 99", "Maximum tree depth.", "More complex patterns.", "Higher overfitting risk.", 1, 99),
                HyperparameterSpec("min_weight_fraction_leaf", 0.0, "float", "0 ~ 0.49", "Minimum weighted fraction in a leaf.", "Prevents overfitting.", "May underfit.", 0.0, 0.49),
                HyperparameterSpec("min_samples_split", 2, "int", "1 ~ 99", "Minimum samples required to split a node.", "Prevents overfitting.", "May underfit.", 1, 99),
                HyperparameterSpec("max_features", "sqrt", "choice", "'sqrt', 'log2'", "Maximum features considered at each split.", "Better prediction performance.", "Lower regularization.", choices=("sqrt", "log2")),
            ),
        ),
        AlgorithmSpec(
            "mlp_sklearn",
            ModelingTask.BINARY_CLASSIFICATION,
            _mlp_classifier,
            (
                HyperparameterSpec("hidden_layer_sizes", (100,), "tuple_int", "(1~999, 1~999)", "Hidden layer shape.", "Learns complex patterns.", "Slower computation.", 1, 999),
                HyperparameterSpec("activation", "relu", "choice", "'relu', 'tanh'", "Activation function.", "Learns complex patterns.", "May be harder to optimize.", choices=("relu", "tanh")),
                HyperparameterSpec("alpha", 0.0001, "float", "0.0001 ~ 0.9999", "L2 regularization strength.", "Prevents overfitting.", "May underfit.", 0.0001, 0.9999),
                HyperparameterSpec("learning_rate_init", 0.001, "float", "0.001 ~ 0.999", "Initial learning rate.", "Faster learning.", "Less stable training.", 0.001, 0.999),
            ),
        ),
        AlgorithmSpec("linear", ModelingTask.SINGLE_REGRESSION, _linear_regression),
        AlgorithmSpec("ridge", ModelingTask.SINGLE_REGRESSION, _ridge_regression),
        AlgorithmSpec("lasso", ModelingTask.SINGLE_REGRESSION, _lasso_regression),
        AlgorithmSpec("linear_multi_target", ModelingTask.MULTI_REGRESSION, _linear_regression),
        AlgorithmSpec("ridge_multi_target", ModelingTask.MULTI_REGRESSION, _ridge_regression),
        AlgorithmSpec("lasso_multi_target", ModelingTask.MULTI_REGRESSION, _lasso_multi_target),
    ]


def _find_spec(name: str, task: ModelingTask) -> AlgorithmSpec:
    for spec in _registry():
        if spec.name == name and spec.task == task:
            return spec
    raise ValueError(f"Unsupported algorithm '{name}' for task '{task.value}'.")


def _resolve_hyperparameters(spec: AlgorithmSpec, overrides: dict[str, Any]) -> dict[str, Any]:
    allowed_names = {param.name for param in spec.hyperparameters}
    unknown = sorted(set(overrides) - allowed_names)
    if unknown:
        raise ValueError(f"Unsupported hyperparameters for '{spec.name}': {unknown}")

    resolved = {param.name: _coerce_value(param, param.default) for param in spec.hyperparameters}
    for param in spec.hyperparameters:
        if param.name in overrides:
            resolved[param.name] = _coerce_value(param, overrides[param.name])
    return resolved


def _coerce_value(param: HyperparameterSpec, value: Any) -> Any:
    if param.value_type == "int_or_none" and (value is None or value == "None"):
        return None
    if param.value_type == "tuple_int":
        coerced = tuple(int(item) for item in value)
        if not 1 <= len(coerced) <= 2:
            raise ValueError(f"'{param.name}' must contain one or two layer sizes.")
        for item in coerced:
            _validate_range(param, item)
        return coerced
    if param.value_type == "choice":
        if param.choices and value not in param.choices:
            raise ValueError(f"'{param.name}' must be one of {param.choices}.")
        return value
    if param.value_type == "int":
        value = int(value)
    elif param.value_type == "float":
        value = float(value)
    _validate_range(param, value)
    return value


def _validate_range(param: HyperparameterSpec, value: Any) -> None:
    if param.minimum is not None and value < param.minimum:
        raise ValueError(f"'{param.name}' must be >= {param.minimum}.")
    if param.maximum is not None and value > param.maximum:
        raise ValueError(f"'{param.name}' must be <= {param.maximum}.")


def _xgboost_classifier(_: int, params: dict[str, Any]) -> Any:
    from xgboost import XGBClassifier

    return XGBClassifier(
        **params,
        n_estimators=200,
        subsample=0.9,
        eval_metric="logloss",
        random_state=42,
    )


def _lightgbm_classifier(_: int, params: dict[str, Any]) -> Any:
    from lightgbm import LGBMClassifier

    return LGBMClassifier(
        **params,
        n_estimators=200,
        random_state=42,
        verbose=-1,
    )


def _catboost_classifier(_: int, params: dict[str, Any]) -> Any:
    from catboost import CatBoostClassifier

    return CatBoostClassifier(
        **params,
        loss_function="Logloss",
        random_seed=42,
        verbose=False,
    )


def _random_forest_classifier(_: int, params: dict[str, Any]) -> RandomForestClassifier:
    return RandomForestClassifier(
        **params,
        n_estimators=300,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )


def _mlp_classifier(_: int, params: dict[str, Any]) -> MLPClassifier:
    return MLPClassifier(
        **params,
        solver="adam",
        max_iter=500,
        random_state=42,
    )


def _linear_regression(_: int, __: dict[str, Any]) -> LinearRegression:
    return LinearRegression()


def _ridge_regression(_: int, __: dict[str, Any]) -> Ridge:
    return Ridge(alpha=1.0, random_state=42)


def _lasso_regression(_: int, __: dict[str, Any]) -> Lasso:
    return Lasso(alpha=0.001, max_iter=10000, random_state=42)


def _lasso_multi_target(_: int, __: dict[str, Any]) -> MultiOutputRegressor:
    return MultiOutputRegressor(_lasso_regression(1, {}))
