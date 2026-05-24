"""Model automation package for the TOBE SML demo.

외부에서는 registry와 training API만 import하면 되도록 공개 표면을 좁게 유지한다.
"""

from sml_modeling.registry import (
    algorithm_hyperparameters,
    available_algorithms,
    build_model,
    default_hyperparameters,
    resolve_hyperparameters,
)
from sml_modeling.training import TrainingResult, train_algorithms

__all__ = [
    "TrainingResult",
    "algorithm_hyperparameters",
    "available_algorithms",
    "build_model",
    "default_hyperparameters",
    "resolve_hyperparameters",
    "train_algorithms",
]
