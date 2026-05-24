# TOBE SML Monorepo

데이터셋 파트 중심의 데모 Automated Machine Learning 프로젝트입니다.
현재는 모델링 파트 전 단계인 데이터 로드, 미리보기, 메타데이터 확인, 타겟 검증, EDA, 전처리, 유의성 검증, pkl 버전 저장을 제공합니다.

## Monorepo 구조

```text
apps/
  api/                    FastAPI 서비스
    api/
      main.py
      schemas.py
    pyproject.toml
  web/                    React 데모 화면
    index.html
    src/
      app.js
      styles.css
    package.json
packages/
  sml-dataset/            공통 데이터셋 자동화 패키지
    sml_dataset/
      connectors/
      config.py
      eda.py
      metadata.py
      pipeline.py
      preprocessing.py
      significance.py
      target_validation.py
      versioning.py
    pyproject.toml
  sml-modeling/           모델 학습/평가 패키지
    sml_modeling/
      registry.py
      training.py
      metrics.py
    pyproject.toml
configs/                  태스크별 실행 설정
notebooks/                셀 단위 확인용 노트북
scripts/                  실제 ML 프로세스 실행 스크립트와 실행용 ipynb
data/                     로컬 데모 DB
artifacts/                실행 산출물
```

파이썬 프로젝트에서 모노레포는 하나의 git repository 안에서 여러 앱과 패키지를 함께 관리하는 방식입니다.
이 프로젝트에서는 `packages/sml-dataset`이 공통 ML 데이터셋 로직을 담당하고, `apps/api`와 `notebooks`가 그 패키지를 재사용합니다.
`packages/sml-modeling`은 데이터셋 pkl 버전을 입력으로 받아 모델을 학습하고 평가합니다.
`apps/web`은 FastAPI API를 호출하는 React 화면입니다.

상세 문서:

- [프로젝트 구조](docs/PROJECT_STRUCTURE.md)
- [설정 파일 가이드](docs/CONFIGURATION.md)
- [Oracle DB 연결](docs/ORACLE_CONNECTION.md)
- [데이터셋 파이프라인](docs/DATASET_PIPELINE.md)
- [모델링](docs/MODELING.md)
- [API](docs/API.md)
- [프론트엔드](docs/FRONTEND.md)

## 지원 태스크

- `binary_classification`: 이진분류, 타겟 고유값 2개 필수
- `single_regression`: 단일 타겟 회귀
- `multi_regression`: 다중 타겟 회귀, 타겟 2개 이상

## 지원 알고리즘

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

`xgboost`, `lightgbm`, `catboost`는 optional dependency입니다.
설치하지 않은 상태에서 실행하면 해당 알고리즘만 `skipped`로 표시되고, 나머지 모델 학습은 계속됩니다.

```powershell
pip install -r requirements-modeling-optional.txt
```

## 빠른 실행

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

python scripts/create_demo_database.py
python scripts/run_dataset_pipeline.py --config configs/binary_classification.yaml
python scripts/run_dataset_pipeline.py --config configs/single_regression.yaml
python scripts/run_dataset_pipeline.py --config configs/multi_regression.yaml
```

모델링 실행 예시:

```powershell
python scripts/train_models.py --dataset artifacts/datasets/customer_churn_binary_YYYYMMDDTHHMMSSZ.pkl --task binary_classification --algorithms random_forest mlp_sklearn
python scripts/train_models.py --dataset artifacts/datasets/house_price_single_regression_YYYYMMDDTHHMMSSZ.pkl --task single_regression
python scripts/train_models.py --dataset artifacts/datasets/ad_campaign_multi_regression_YYYYMMDDTHHMMSSZ.pkl --task multi_regression
```

## 노트북

셀 단위로 확인하려면 [notebooks/dataset_pipeline_demo.ipynb](notebooks/dataset_pipeline_demo.ipynb)를 실행하세요.
노트북은 `packages/sml-dataset`의 공통 패키지를 import해서 데이터셋 파트 흐름을 단계별로 확인합니다.

ASIS 구조처럼 `scripts` 안에서 실제 프로세스를 실행하려면 [scripts/dataset_process.ipynb](scripts/dataset_process.ipynb)를 사용하세요.
이 노트북은 `packages/sml-dataset` 내부 py 모듈을 직접 import해서 데이터 생성, 타겟/피처 선택, EDA, 전처리, pkl 저장을 셀 단위로 실행합니다.

## FastAPI 실행

```powershell
uvicorn apps.api.api.main:app --reload
```

- React 데모 화면: `http://127.0.0.1:8000/app`
- Swagger UI: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

현재 React 화면은 데모 배포가 쉽도록 FastAPI가 정적 파일로 서빙합니다.
소스는 `apps/web`에 있으며, npm/Vite 환경을 붙이면 별도 React 앱으로 분리할 수 있습니다.

## 주요 API

- `GET /health`: API 상태 확인
- `GET /tasks`: 지원 태스크 목록
- `POST /datasets/preview`: DB 로드 및 `head()`/메타데이터 반환
- `POST /datasets/validate-targets`: 태스크별 타겟 검증
- `POST /datasets/eda`: EDA 및 chart spec 반환
- `POST /datasets/significance`: 유의성 검증 반환
- `POST /datasets/preprocess`: 전처리 결과 preview 반환
- `POST /datasets/version`: 전처리 후 pkl 버전 저장
- `POST /pipelines/run`: 전체 데이터셋 파이프라인 실행
- `GET /models/algorithms?task=binary_classification`: 태스크별 모델 목록
- `GET /models/hyperparameters?task=binary_classification`: 태스크별 하이퍼파라미터 schema
- `POST /models/train`: 데이터셋 pkl 기반 모델 학습/평가/저장

## 예시 요청

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
  "targets": ["churn"],
  "preprocessing": {
    "drop_duplicates": true,
    "missing": {
      "numeric": "median",
      "categorical": "most_frequent"
    },
    "outliers": {
      "method": "iqr_remove",
      "factor": 1.5
    },
    "encoding": {
      "method": "onehot"
    },
    "scaling": {
      "method": "standard"
    }
  },
  "versioning": {
    "artifact_dir": "artifacts/datasets",
    "name": "customer_churn_binary"
  }
}
```

모델 학습 요청 예시:

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

## 산출물

- `artifacts/metadata/*.json`: 데이터 preview 및 컬럼 메타데이터
- `artifacts/eda/*.json`: EDA 결과와 chart spec
- `artifacts/significance/*.json`: 태스크별 유의성 검증 결과
- `artifacts/preprocessing/*.json`: 전처리 리포트
- `artifacts/datasets/*.pkl`: 전처리된 데이터셋 버전 파일
- `artifacts/models/*.pkl`: 학습된 모델 버전 파일

## 확장 방향

- 새 DB 커넥터는 `packages/sml-dataset/sml_dataset/connectors/base.py`의 `DataConnector` 인터페이스를 구현합니다.
- 모델링 API는 이후 `apps/modeling-api` 또는 기존 `apps/api`에 추가할 수 있습니다.
- API와 Web은 `packages/sml-dataset`을 기준으로 계속 얇게 유지하는 편이 좋습니다.
