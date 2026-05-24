"""저장된 데이터셋 pkl을 입력으로 모델 학습을 실행하는 CLI."""

import argparse
import ast
import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
SML_MODELING_PACKAGE = ROOT_DIR / "packages" / "sml-modeling"
if str(SML_MODELING_PACKAGE) not in sys.path:
    sys.path.insert(0, str(SML_MODELING_PACKAGE))

from sml_modeling.task import ModelingTask
from sml_modeling.training import results_as_dicts, train_algorithms


def main() -> None:
    """CLI 인자를 해석하고 sml_modeling.training에 실제 학습을 위임한다."""

    parser = argparse.ArgumentParser(description="Train SML models from a dataset version pkl.")
    parser.add_argument("--dataset", required=True, help="Path to dataset version pkl.")
    parser.add_argument(
        "--task",
        required=True,
        choices=[task.value for task in ModelingTask],
        help="Modeling task.",
    )
    parser.add_argument(
        "--algorithms",
        nargs="*",
        default=None,
        help="Algorithms to train. Defaults to all algorithms for the task.",
    )
    parser.add_argument("--artifact-dir", default="artifacts/models", help="Directory for model pkl files.")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument(
        "--hyperparameters-json",
        default=None,
        help=(
            "JSON object keyed by algorithm name. "
            "Example: '{\"random_forest\":{\"max_depth\":5}}'"
        ),
    )
    parser.add_argument(
        "--hyperparameter",
        action="append",
        default=[],
        help=(
            "Single override in algorithm.parameter=value format. "
            "Can be repeated, e.g. --hyperparameter random_forest.max_depth=5"
        ),
    )
    args = parser.parse_args()
    hyperparameters = _load_hyperparameters(args.hyperparameters_json, args.hyperparameter)

    results = train_algorithms(
        dataset_path=args.dataset,
        task=ModelingTask(args.task),
        algorithms=args.algorithms,
        artifact_dir=args.artifact_dir,
        test_size=args.test_size,
        hyperparameters=hyperparameters,
    )
    print(json.dumps(results_as_dicts(results), ensure_ascii=False, indent=2))


def _load_hyperparameters(
    hyperparameters_json: str | None,
    hyperparameter_items: list[str],
) -> dict[str, dict[str, object]] | None:
    """Merge JSON and repeated algorithm.parameter=value overrides."""

    merged: dict[str, dict[str, object]] = {}
    if hyperparameters_json:
        merged.update(json.loads(hyperparameters_json))
    for item in hyperparameter_items:
        algorithm_param, raw_value = item.split("=", 1)
        algorithm, param = algorithm_param.split(".", 1)
        merged.setdefault(algorithm, {})[param] = _parse_scalar(raw_value)
    return merged or None


def _parse_scalar(value: str) -> object:
    """Parse CLI values into numbers, tuples/lists, None, or strings."""

    if value == "None":
        return None
    try:
        return ast.literal_eval(value)
    except (SyntaxError, ValueError):
        return value


if __name__ == "__main__":
    main()
