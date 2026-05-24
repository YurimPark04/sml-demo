# Oracle DB Connection Guide

이 문서는 SML Dataset 모듈에서 Oracle DB를 데이터소스로 연결할 때 필요한 설정과 API 사용 방법을 정리합니다.

## 1. 설치

가상환경을 활성화한 뒤 Oracle 드라이버를 설치합니다.

```powershell
cd C:\work\project\workspace\test2
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

`requirements.txt`에는 `oracledb`가 포함되어 있습니다.

## 2. 접속 정보

DBA 또는 백엔드 담당자에게 아래 값을 받아야 합니다.

```text
host
port
service_name 또는 sid
username
password
schema
```

처음에는 Oracle Client가 필요 없는 Thin mode를 기본으로 사용합니다. 회사 DB 정책상 Oracle Client, Wallet, TNS 설정이 필요한 경우에만 Thick mode를 사용합니다.

## 3. 환경변수 예시

비밀번호는 코드에 직접 저장하지 않습니다.

```powershell
$env:SML_ORACLE_HOST="10.20.40.7"
$env:SML_ORACLE_PORT="1521"
$env:SML_ORACLE_SERVICE_NAME="ORCLPDB1"
$env:SML_ORACLE_USER="ml_reader"
$env:SML_ORACLE_PASSWORD="password"
$env:SML_ORACLE_SCHEMA="SML_OWNER"
```

## 4. 연결 테스트 API

서버 실행:

```powershell
python -m uvicorn apps.api.api.main:app --host 127.0.0.1 --port 8010 --reload
```

Swagger:

```text
http://127.0.0.1:8010/docs
```

연결 테스트:

```http
POST /datasources/oracle/test
```

요청 예시:

```json
{
  "host": "10.20.40.7",
  "port": 1521,
  "service_name": "ORCLPDB1",
  "username": "ml_reader",
  "password_env": "SML_ORACLE_PASSWORD",
  "schema": "SML_OWNER"
}
```

응답 예시:

```json
{
  "ok": true,
  "round_trip_ms": 142.5,
  "current_schema": "ML_READER",
  "mode": "thin",
  "database_version": "19.0.0.0.0"
}
```

## 5. 스키마/테이블/컬럼 조회

스키마 목록:

```http
POST /datasources/oracle/schemas
```

테이블 목록:

```http
POST /datasources/oracle/tables
```

요청 예시:

```json
{
  "host": "10.20.40.7",
  "port": 1521,
  "service_name": "ORCLPDB1",
  "username": "ml_reader",
  "password_env": "SML_ORACLE_PASSWORD",
  "schema": "SML_OWNER"
}
```

컬럼 목록:

```http
POST /datasources/oracle/columns
```

요청 예시:

```json
{
  "host": "10.20.40.7",
  "port": 1521,
  "service_name": "ORCLPDB1",
  "username": "ml_reader",
  "password_env": "SML_ORACLE_PASSWORD",
  "schema": "SML_OWNER",
  "table": "CUSTOMER_TXN_2024Q4"
}
```

## 6. 데이터셋 Preview

기존 dataset preview API에서도 `type: "oracle"`을 사용할 수 있습니다.

```http
POST /datasets/preview
```

테이블 기반:

```json
{
  "task": "binary_classification",
  "data_source": {
    "type": "oracle",
    "options": {
      "host": "10.20.40.7",
      "port": 1521,
      "service_name": "ORCLPDB1",
      "username": "ml_reader",
      "password_env": "SML_ORACLE_PASSWORD",
      "schema": "SML_OWNER",
      "table": "CUSTOMER_TXN_2024Q4",
      "limit": 1000
    }
  },
  "preview_rows": 5
}
```

SQL 기반:

```json
{
  "task": "binary_classification",
  "data_source": {
    "type": "oracle",
    "options": {
      "host": "10.20.40.7",
      "port": 1521,
      "service_name": "ORCLPDB1",
      "username": "ml_reader",
      "password_env": "SML_ORACLE_PASSWORD",
      "schema": "SML_OWNER",
      "query": "SELECT * FROM SML_OWNER.CUSTOMER_TXN_2024Q4 FETCH FIRST 1000 ROWS ONLY"
    }
  },
  "preview_rows": 5
}
```

## 7. Application Metadata Tables

SML 시스템이 데이터소스와 데이터셋 생성 이력을 DB에 저장하려면 `database/oracle_schema.sql`을 애플리케이션 소유자 계정으로 실행합니다.
또는 화면의 `데이터소스 연결` 모달에서 `연결 및 테이블 생성` 버튼을 누르면 FastAPI가 같은 DDL을 실행합니다.

포함 테이블:

- `SML_DATASOURCE`
- `SML_DATASET`
- `SML_DATASET_VERSION`

주의: 실제 원천 데이터 조회 계정은 읽기 전용으로 시작하는 것이 좋습니다. 메타 테이블 생성 계정과 원천 데이터 조회 계정은 분리하는 구성이 안전합니다.

## 8. Dataset 화면 실행 순서

`http://127.0.0.1:8010/app`에서 상단 `DATASET` 메뉴를 누른 뒤 아래 순서로 실행합니다.

1. `데이터소스 연결`을 누릅니다.
2. Oracle 접속 정보를 입력합니다.
3. `연결 및 테이블 생성`을 눌러 `SML_DATASOURCE`, `SML_DATASET`, `SML_DATASET_VERSION`을 생성합니다.
4. 원천 테이블이 없다면 `데모 원천 테이블 생성`을 눌러 `CUSTOMER_TXN_2024Q4` 샘플 데이터를 생성합니다.
5. `+ 데이터소스 등록`을 눌러 접속 정보를 `SML_DATASOURCE`에 저장합니다.
6. `신규 데이터셋`을 눌러 태스크, 알고리즘, 데이터소스, 테이블을 선택합니다.
7. `+ 생성`을 누르면 원천 테이블의 메타데이터를 읽고 `SML_DATASET`에 데이터셋 생성 이력을 저장합니다.

현재 구현 범위는 `데이터셋 생성 -> 알고리즘 선택 -> 데이터 소스 연결 -> 데이터셋 로드`입니다.
이후 단계인 타겟/피처 선택, EDA, 전처리, 유의성 검증, 버전 저장은 기존 Dataset API와 이어 붙이면 됩니다.
