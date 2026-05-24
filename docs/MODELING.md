# Modeling

모델링 파트는 데이터셋 파트가 저장한 pkl 버전을 입력으로 받아 모델을 학습, 평가, 저장합니다.

## Main Modules

```text
packages/sml-modeling/sml_modeling/registry.py
packages/sml-modeling/sml_modeling/training.py
packages/sml-modeling/sml_modeling/metrics.py
```

## Supported Algorithms

이진분류:

- `xgboost`
- `lightgbm`
- `catboost`
- `random_forest`
- `mlp_sklearn`

회귀:

- `linear`
- `ridge`
- `lasso`
- `linear_multi_target`
- `ridge_multi_target`
- `lasso_multi_target`

## Hyperparameters

분류 알고리즘은 현재 표준 4개 하이퍼파라미터를 registry에 정의해두었습니다.
TOBE에서 2개를 추가하면 `packages/sml-modeling/sml_modeling/registry.py`의 해당 `AlgorithmSpec.hyperparameters`에 `HyperparameterSpec`만 추가하면 됩니다.

현재 기본값:

| Algorithm | Hyperparameters |
| --- | --- |
| `xgboost` | `learning_rate=0.1`, `max_depth=5`, `min_child_weight=1`, `colsample_bytree=1.0` |
| `lightgbm` | `learning_rate=0.1`, `max_depth=-1`, `min_child_samples=20`, `num_leaves=31` |
| `catboost` | `learning_rate=0.03`, `depth=6`, `iterations=500`, `l2_leaf_reg=3` |
| `random_forest` | `max_depth=None`, `min_weight_fraction_leaf=0.0`, `min_samples_split=2`, `max_features="sqrt"` |
| `mlp_sklearn` | `hidden_layer_sizes=(100,)`, `activation="relu"`, `alpha=0.0001`, `learning_rate_init=0.001` |

학습 요청에서 알고리즘별 override를 전달할 수 있습니다.

```json
{
  "random_forest": {
    "max_depth": 5,
    "max_features": "sqrt"
  },
  "mlp_sklearn": {
    "hidden_layer_sizes": [100, 50],
    "activation": "relu"
  }
}
```

## Optional Dependencies

아래 라이브러리는 optional dependency입니다.

- XGBoost
- LightGBM
- CatBoost

설치하지 않아도 시스템은 동작합니다.
해당 알고리즘을 실행하면 결과가 `skipped`로 반환되고 나머지 알고리즘 학습은 계속됩니다.

```powershell
pip install -r requirements-modeling-optional.txt
```

## Training Flow

1. `load_dataset_version()`으로 dataset pkl 로드
2. `features`, `targets`, `version_id` 필수 키 검증
3. train/test split
4. `registry.py`에서 estimator 생성
5. model fit/predict
6. 태스크별 metric 계산
7. model pkl 저장
8. 알고리즘별 `TrainingResult` 반환

## Metrics

이진분류:

- accuracy
- f1
- roc_auc
- confusion matrix
- ROC curve points
- feature importance

회귀:

- mae
- rmse
- mape
- r2

멀티 타겟 회귀는 target별 metric과 전체 평균 metric을 함께 반환합니다.

## CLI

```powershell
python scripts/train_models.py --dataset artifacts/datasets/customer_churn_binary_YYYYMMDDTHHMMSSZ.pkl --task binary_classification --algorithms random_forest mlp_sklearn
```

하이퍼파라미터 override 예시:

```powershell
python scripts/train_models.py --dataset artifacts/datasets/customer_churn_binary_YYYYMMDDTHHMMSSZ.pkl --task binary_classification --algorithms random_forest --hyperparameters-json "{\"random_forest\":{\"max_depth\":5,\"max_features\":\"sqrt\"}}"
```

PowerShell에서는 반복 key-value 옵션이 더 편합니다.

```powershell
python scripts/train_models.py --dataset artifacts/datasets/customer_churn_binary_YYYYMMDDTHHMMSSZ.pkl --task binary_classification --algorithms random_forest --hyperparameter random_forest.max_depth=5 --hyperparameter random_forest.max_features=sqrt
```

알고리즘을 생략하면 해당 태스크의 전체 알고리즘을 시도합니다.

```powershell
python scripts/train_models.py --dataset artifacts/datasets/house_price_single_regression_YYYYMMDDTHHMMSSZ.pkl --task single_regression
```

## Output

모델은 `artifacts/models/` 아래에 저장됩니다.

```text
{dataset_version_id}_{algorithm}_{timestamp}.pkl
```

payload에는 estimator, metric, feature columns, target columns, dataset version id가 포함됩니다.
classification artifact에는 confusion matrix, ROC curve, feature importance 진단 정보가 포함됩니다.
regression artifact에는 predicted vs actual, residual plot용 진단 정보가 포함됩니다.
