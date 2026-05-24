# Configuration Guide

데이터셋 파이프라인은 `configs/*.yaml` 파일로 실행 조건을 받습니다.
이 설정은 `packages/sml-dataset/sml_dataset/config.py`에서 `PipelineConfig` 객체로 변환됩니다.

## YAML Schema

```yaml
task: binary_classification
data_source:
  type: sqlite
  database: data/demo_sml.db
  query: SELECT * FROM customer_churn
targets:
  - churn
preprocessing:
  drop_duplicates: true
  missing:
    numeric: median
    categorical: most_frequent
  outliers:
    method: iqr_remove
    factor: 1.5
  encoding:
    method: onehot
  scaling:
    method: standard
versioning:
  artifact_dir: artifacts/datasets
  name: customer_churn_binary
```

## `task`

지원 값:

- `binary_classification`
- `single_regression`
- `multi_regression`

`task`는 target 검증, EDA, 유의성 검증, 모델링 알고리즘 선택의 기준입니다.

## `data_source`

현재 지원 타입:

- `sqlite`
- `csv`
- `oracle`

SQLite 예시:

```yaml
data_source:
  type: sqlite
  database: data/demo_sml.db
  query: SELECT * FROM customer_churn
```

CSV 예시:

```yaml
data_source:
  type: csv
  path: data/input.csv
```

Oracle 예시:

```yaml
data_source:
  type: oracle
  host: 10.20.40.7
  port: 1521
  service_name: ORCLPDB1
  username: ml_reader
  password_env: SML_ORACLE_PASSWORD
  schema: SML_OWNER
  table: CUSTOMER_TXN_2024Q4
  limit: 1000
```

Oracle SQL 예시:

```yaml
data_source:
  type: oracle
  host: 10.20.40.7
  port: 1521
  service_name: ORCLPDB1
  username: ml_reader
  password_env: SML_ORACLE_PASSWORD
  schema: SML_OWNER
  query: SELECT * FROM SML_OWNER.CUSTOMER_TXN_2024Q4 FETCH FIRST 1000 ROWS ONLY
```

`type`을 제외한 나머지 값은 connector 생성자 옵션으로 전달됩니다.

## `targets`

태스크별 규칙:

- 이진분류: target 1개, 고유값 2개
- 단일 회귀: target 1개, 숫자형
- 멀티 회귀: target 2개 이상, 모두 숫자형

## `preprocessing`

지원 옵션:

- `drop_duplicates`: 중복 row 제거 여부
- `missing.numeric`: 숫자형 결측치 처리 전략
- `missing.categorical`: 범주형 결측치 처리 전략
- `outliers.method`: `iqr_remove` 권장, 기존 호환용 `iqr_clip`도 지원
- `outliers.factor`: IQR clipping factor
- `encoding.method`: `onehot` 또는 `label`
- `scaling.method`: `standard`, `minmax`, `none` 권장, 기존 호환용 `robust`도 지원

전처리는 target 컬럼을 제외한 feature 컬럼에만 적용됩니다.

## `versioning`

전처리된 dataset bundle 저장 설정입니다.

```yaml
versioning:
  artifact_dir: artifacts/datasets
  name: customer_churn_binary
```

저장 결과:

- `{name}_{timestamp}.pkl`
- `{name}_{timestamp}.meta.pkl`
