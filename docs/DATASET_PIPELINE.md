# Dataset Pipeline

데이터셋 파트는 사용자가 모델링 전에 데이터 상태를 이해하고, 전처리된 데이터셋 버전을 저장하는 과정입니다.

## Main Module

핵심 진입점:

```text
packages/sml-dataset/sml_dataset/pipeline.py
```

`DatasetPipeline.run()`은 아래 단계를 순서대로 실행합니다.

## Steps

1. 데이터 로드

`connectors/factory.py`가 `data_source.type`에 맞는 connector를 생성합니다.
SQLite는 SQL query 결과를 DataFrame으로 읽고, CSV는 `pandas.read_csv`로 읽습니다.

2. 메타데이터 생성

`metadata.py`가 다음 정보를 만듭니다.

- row/column 수
- 컬럼명
- dtype
- missing count/ratio
- unique count
- `head()` preview

3. 타겟 검증

`target_validation.py`가 태스크별 target 규칙을 검증합니다.
검증 실패 시 `ValueError`가 발생하며, FastAPI에서는 400 응답으로 변환됩니다.

4. EDA

`eda.py`가 기본 요약 통계와 프론트 차트 렌더링용 `chart_specs`를 반환합니다.

공통 EDA:

- 기초 통계량: count, mean, std, min, max, 25/50/75%
- 결측치 건수와 결측률
- 데이터 타입 분석: numeric/categorical/datetime, cardinality
- 이상치 건수: IQR 기준
- 피처 분포: histogram, boxplot, categorical frequency

태스크별 EDA:

- Classification: 클래스 분포, 클래스 비율, 10% 미만 클래스 불균형 경고, class별 feature 분포 비교용 violin plot spec
- Regression: target 분포, feature-target scatter spec, feature correlation heatmap spec

5. 유의성 검증

`significance.py`가 태스크별 검정을 수행합니다.

- 이진분류: WoE/IV, IV grade, IV bar chart spec, WoE binning plot spec
- 회귀: Pearson correlation/p-value, Mutual Information, VIF, heatmap/bar chart spec

6. 전처리

`preprocessing.py`가 feature와 target을 분리한 뒤 feature에만 전처리를 적용합니다.

- 중복 제거
- 결측치 처리: delete, mean, median
- 이상치 처리: IQR remove 또는 IQR clipping
- one-hot 또는 label encoding
- standard/minmax/no scaling

7. pkl 버전 저장

`versioning.py`가 아래 payload를 joblib pkl로 저장합니다.

```text
version_id
created_at
features
targets
metadata
preprocessing_report
preprocessor
```

이 pkl은 모델링 파트의 입력으로 사용됩니다.

## CLI

```powershell
python scripts/run_dataset_pipeline.py --config configs/binary_classification.yaml
```

## Notebook

셀 단위 확인은 `notebooks/dataset_pipeline_demo.ipynb`를 사용합니다.
노트북은 같은 패키지 함수를 직접 호출하므로 API와 동작 기준이 같습니다.
