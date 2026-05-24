# API Reference

FastAPI 앱은 `apps/api/api/main.py`에 있습니다.

실행:

```powershell
uvicorn apps.api.api.main:app --reload
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

React 데모 화면:

```text
http://127.0.0.1:8000/app
```

## Health

```http
GET /health
```

API 상태를 확인합니다.

## Tasks

```http
GET /tasks
```

데이터셋 파트가 지원하는 태스크 목록을 반환합니다.

## Dataset Preview

```http
POST /datasets/preview
```

target 선택 전 데이터 preview와 컬럼 메타데이터를 반환합니다.

요청 예시:

```json
{
  "task": "binary_classification",
  "data_source": {
    "type": "sqlite",
    "options": {
      "database": "data/demo_sml.db",
      "query": "SELECT * FROM customer_churn"
    }
  },
  "preview_rows": 5
}
```

## Target Validation

```http
POST /datasets/validate-targets
```

사용자가 선택한 target이 태스크 규칙에 맞는지 검증합니다.

## EDA

```http
POST /datasets/eda
```

EDA 요약과 `chart_specs`를 반환합니다.

## Significance

```http
POST /datasets/significance
```

태스크별 유의성 검증 결과를 반환합니다.

## Preprocess

```http
POST /datasets/preprocess
```

전처리 preview와 전처리 리포트를 반환합니다.
pkl 저장은 하지 않습니다.

## Dataset Version

```http
POST /datasets/version
```

전처리된 데이터셋 pkl 버전을 저장합니다.

## Dataset Pipeline

```http
POST /pipelines/run
```

데이터셋 파트 전체 흐름을 한 번에 실행합니다.

## Model Algorithms

```http
GET /models/algorithms?task=binary_classification
```

태스크별 지원 모델 목록을 반환합니다.

## Model Hyperparameters

```http
GET /models/hyperparameters?task=binary_classification
GET /models/hyperparameters?task=binary_classification&algorithm=random_forest
```

태스크/알고리즘별 하이퍼파라미터 기본값, 허용 범위, 설명을 반환합니다.

## Model Training

```http
POST /models/train
```

저장된 dataset pkl을 입력으로 모델을 학습합니다.

요청 예시:

```json
{
  "dataset_path": "artifacts/datasets/customer_churn_binary_YYYYMMDDTHHMMSSZ.pkl",
  "task": "binary_classification",
  "algorithms": ["random_forest", "mlp_sklearn"],
  "hyperparameters": {
    "random_forest": {
      "max_depth": 5,
      "max_features": "sqrt"
    }
  },
  "artifact_dir": "artifacts/models",
  "test_size": 0.2
}
```
