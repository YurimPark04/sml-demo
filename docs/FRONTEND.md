# Frontend

프론트 화면은 `apps/web`에 있습니다.
현재는 별도 빌드 없이 FastAPI가 정적 파일로 서빙합니다.

## Files

```text
apps/web/index.html
apps/web/src/app.js
apps/web/src/styles.css
```

## URL

```text
http://127.0.0.1:8000/app
```

## Current Screen

현재 `/app`는 HOME 메뉴의 Dashboard 화면입니다.
제공받은 `SML Dashboard.html` 설계서를 기준으로 아래 영역을 구성했습니다.

- 상단 App Bar: SML brand, HOME/WORKSPACE/REPORTING/SERVICE/SYSTEM/DATASET/MONITORING 메뉴
- Page Header: breadcrumb, Dashboard title, 기간 선택, 새 스케줄 버튼
- Welcome Banner: 사용자 요약, API online 상태
- KPI Cards: workspace/model/developing/completed/task/algorithm 요약
- System Performance Monitoring: CPU/GPU/Network line chart
- Resource Usage: disk/memory/GPU memory usage
- Training Schedule: 월간 학습 스케줄 캘린더
- Recent Activity: 최근 ML 작업 이벤트

Dashboard는 `/health`, `/tasks`, `/models/algorithms`를 호출해 실제 FastAPI 상태와 ML 지원 정보를 표시합니다.

## Dataset Console Flow

기존 데이터셋 실행 흐름은 `scripts/dataset_process.ipynb`와 FastAPI endpoint로 유지됩니다.
추후 DATASET 메뉴 화면을 만들 때 아래 흐름을 화면으로 분리하면 됩니다.

1. 태스크 선택
2. SQL query 확인 또는 수정
3. target 컬럼 입력
4. encoding/scaling 선택
5. Preview 실행
6. Target validation 실행
7. EDA 실행
8. Preprocess 실행
9. Significance 실행
10. pkl 저장 또는 전체 Pipeline 실행

## API Calls

`apps/web/src/app.js`는 아래 API를 호출합니다.

- `/datasets/preview`
- `/datasets/validate-targets`
- `/datasets/eda`
- `/datasets/preprocess`
- `/datasets/significance`
- `/datasets/version`
- `/pipelines/run`

## Future Vite Split

`apps/web/package.json`은 추후 Vite 기반 별도 프론트 서버로 분리할 때 사용할 수 있습니다.
현재 환경에서는 npm이 필수는 아닙니다.
