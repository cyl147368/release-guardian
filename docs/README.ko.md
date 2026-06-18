# Release Guardian 문서 (한국어)

## 개요

Release Guardian는 엔터프라이즈 소프트웨어 전달 팀을 위한 릴리스 거버넌스 API입니다.

주요 기능:

- 릴리스 요청 관리
- 위험 점수 계산
- 승인 흐름
- 배포 기록
- 감사 타임라인
- 운영 대시보드 지표
- 준비 상태 프로브

## 빠른 시작

```bash
npm install
npm start
```

기본 주소:

- `http://127.0.0.1:3000`

## 핵심 엔드포인트

- `GET /health` — 헬스 프로브, 일반 텍스트 `ok` 반환
- `GET /ready` — 준비 상태 프로브, 데이터스토어 건강 상태를 JSON으로 반환
- `GET /api/releases` — 릴리스 목록 조회, 필터 및 페이지네이션 지원
- `POST /api/releases` — 릴리스 요청 생성
- `GET /api/releases/:releaseId` — 단일 릴리스 조회
- `GET /api/releases/:releaseId/evidence` — 감사 증거 패키지
- `GET /api/releases/:releaseId/conflicts` — 릴리스 윈도우 충돌 조회
- `POST /api/releases/:releaseId/approvals` — 릴리스 승인 또는 거부
- `POST /api/releases/:releaseId/schedule` — 승인된 릴리스 스케줄링
- `POST /api/releases/:releaseId/deploy` — 배포 결과 기록
- `GET /api/dashboard` — 거버넌스 대시보드
- `GET /api/escalations` — 운영 에스컬레이션 요약
- `GET /api/escalations/report` — 경영진 에스컬레이션 보고서
- `GET /api/policy` — 거버넌스 정책

## 준비 상태 프로브 상세

`GET /ready`는 JSON 형식의 준비 상태를 반환합니다:

```bash
curl -s http://localhost:3000/ready | jq .
```

- `status`: `ready` (준비 완료) 또는 `not_ready` (미준비)
- `version`: 실행 중인 서비스 버전
- `checks.datastore.status`: `ok` 또는 `error`
- `checks.datastore.releaseCount`: 데이터스토어의 총 릴리스 수
- `checks.datastore.teamCount`: 데이터스토어의 총 팀 수

데이터스토어를 사용할 수 없을 때 HTTP 503을 반환합니다.

## 검증 명령

```bash
npm run lint
npm test
npm run test:coverage
npm run test:bootstrap
```

## 운영 확장 권장 사항

- JSON 저장소를 데이터베이스로 교체
- 인증 및 RBAC 추가
- 중앙 로그, 메트릭, 트레이싱 도입
- 백업 및 복구 절차 수립
