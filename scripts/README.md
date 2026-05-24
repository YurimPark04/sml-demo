# Scripts

이 디렉터리는 실제 머신러닝 프로세스가 실행되는 영역입니다.
ASIS 구조의 관점으로 보면 아래와 같이 대응됩니다.

```text
modules  -> packages/sml-dataset, packages/sml-modeling
scripts  -> scripts/*.py, scripts/*.ipynb
```

## 주요 파일

- `dataset_process.ipynb`: 데이터셋 생성/로드, 타겟/피처 선택, EDA, 전처리, pkl 저장을 셀 단위로 실행
- `create_demo_database.py`: 로컬 데모 SQLite DB 생성
- `run_dataset_pipeline.py`: YAML 설정 기반 데이터셋 파이프라인 일괄 실행
- `train_models.py`: 저장된 dataset pkl 기반 모델 학습 실행

## 권장 사용 방식

초기 개발/검증:

```text
scripts/dataset_process.ipynb
```

흐름이 확정된 뒤 자동화:

```powershell
python scripts/run_dataset_pipeline.py --config configs/binary_classification.yaml
python scripts/train_models.py --dataset artifacts/datasets/...pkl --task binary_classification
```
