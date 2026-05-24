# Project Structure

이 프로젝트는 TOBE SML 데모를 모노레포 형태로 구성합니다.
하나의 repository 안에서 API, React 화면, 데이터셋 패키지, 모델링 패키지, 노트북, 실행 스크립트를 함께 관리합니다.

## Top Level

```text
apps/                 실행 가능한 애플리케이션
packages/             재사용 가능한 내부 파이썬 패키지
configs/              데이터셋 파이프라인 YAML 설정
notebooks/            셀 단위 실험/시연 노트북
scripts/              CLI 실행 스크립트
data/                 로컬 데모 데이터베이스
artifacts/            파이프라인/모델링 실행 산출물
docs/                 프로젝트 문서
```

## Applications

```text
apps/api/
  api/main.py         FastAPI 엔트리포인트
  api/schemas.py      API request/response schema
  pyproject.toml      API 앱 패키지 설정

apps/web/
  index.html          FastAPI가 서빙하는 React 진입 HTML
  src/app.js          React 데모 콘솔
  src/styles.css      화면 스타일
  package.json        추후 Vite 분리 실행을 위한 프론트 설정
```

`apps/api`는 HTTP API를 제공하고, `apps/web`은 해당 API를 호출하는 간단한 React 화면입니다.
현재는 배포와 실행을 단순하게 하기 위해 FastAPI가 `/app`에서 React 정적 파일을 서빙합니다.

## Packages

```text
packages/sml-dataset/
  sml_dataset/
    connectors/       SQLite/CSV 데이터 로더
    config.py         YAML 설정 파싱
    metadata.py       head/컬럼 메타데이터 생성
    target_validation.py
    eda.py
    preprocessing.py
    significance.py
    versioning.py
    pipeline.py

packages/sml-modeling/
  sml_modeling/
    registry.py       태스크별 알고리즘 목록과 estimator 생성
    training.py       학습/평가/모델 저장
    metrics.py        평가 지표
    io.py             pkl artifact 입출력
```

`sml-dataset`은 어떤 데이터가 들어와도 공통 데이터셋 파트 흐름을 실행하는 패키지입니다.
`sml-modeling`은 데이터셋 pkl 버전을 입력으로 받아 모델을 학습하고 평가합니다.

## Execution Flow

```text
DB/CSV
  -> sml_dataset connector
  -> metadata / target validation / EDA / preprocessing / significance
  -> dataset pkl version
  -> sml_modeling training
  -> model pkl artifact
```

FastAPI와 노트북은 이 패키지들을 직접 호출합니다.
React 화면은 FastAPI endpoint를 호출합니다.

