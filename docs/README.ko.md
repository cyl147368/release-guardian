# Release Guardian (한국어)

Release Guardian는 명확한 릴리스 승인, 감사 가능한 배포 기록, 위험 인식 기반 운영 의사결정이 필요한 엔지니어링 조직을 위한 엔터프라이즈급 릴리스 거버넌스 API입니다.

## 1. 개요

Release Guardian는 플랫폼 팀이 다섯 가지 핵심 질문에 답할 수 있도록 지원합니다:

1. 어떤 변경사항이 곧 배포되나요?
2. 각 릴리스의 위험도는 어느 정도인가요?
3. 프로덕션 배포 전에 누가 승인해야 하나요?
4. 배포 중에 무슨 일이 있었나요?
5. 경영진이 주시해야 할 거버넌스 지표는 무엇인가요?

이 프로젝트는 Node.js 내장 기능으로 구현되었으며 서드파티 런타임 의존성이 없습니다. 운영 부담이 작고, 공급망 공격 표면이 좁으며, 코드 검사가 용이합니다.

## 2. 핵심 기능

- 모든 릴리스 요청에 대한 위험 점수 계산
- 환경, 서비스 계층, 통제 상태에 기반한 승인 라우팅
- 상태 기반 릴리스 생명주기 추적
- 배포 스케줄링 및 실행 기록
- 모든 주요 작업의 감사 타임라인
- 거버넌스 및 변경 성과 대시보드 지표
- 안정적인 감사 식별자를 가진 경영진 에스컬레이션 보고서
- 다운스트림 통합을 위한 스키마 풍부한 OpenAPI 계약
- 컨테이너화된 런타임 및 CI 워크플로우
- 대량 릴리스 생성 (최대 50개)
- Webhook 이벤트 알림 시스템
- 구조화된 JSON 로그 및 상관 ID
- 속도 제한 및 API Key 인증
- CORS 및 보안 응답 헤더
- 다국어 문서

## 3. 제품 범위

초기 전달은 릴리스 거버넌스의 백엔드 제어 평면에 초점을 맞춥니다:

- 내부 릴리스 포털의 기반
- 엔터프라이즈 워크플로우 도구背后的 API 서비스
- 변경 관리 시스템 교육/참조 프로젝트
- UI, RBAC, SSO, 외부 승인으로의 향후 확장을 위한 안전한 기준선

## 4. 아키텍처

```text
클라이언트 / 자동화 도구
        |
        v
  HTTP API 레이어
        |
        v
  미들웨어 파이프라인 (로깅, 속도 제한, 인증, CORS, 보안 헤더)
        |
        v
  릴리스 서비스
        |
        v
  JSON 저장소
        |
        v
  영구 데이터 파일
```

### 아키텍처 참고사항

- `src/server.js`: HTTP 서버 시작
- `src/app.js`: 요청 라우팅 및 API 응답 구성
- `src/services/releaseService.js`: 비즈니스 로직 보유
- `src/repository.js`: 영속성 분리
- `src/lib/http.js`: HTTP 유틸리티 함수
- `src/lib/logger.js`: 구조화된 JSON 로거
- `src/lib/middleware.js`: 요청 로깅, 속도 제한, API Key 인증, CORS, 보안 헤더
- `src/lib/webhooks.js`: Webhook 구독 및 이벤트 디스패치
- `src/lib/validation.js`: 입력 검증
- `src/lib/time.js`: 시간 유틸리티
- `tests/*.test.js`: 서비스 및 API 테스트 커버리지

## 5. 기술 스택

- 언어: JavaScript (ES 모듈)
- 런타임: Node.js 20+ (Node.js 24에서 검증)
- 테스트: 네이티브 `node:test`
- 영속성: JSON 파일 저장소
- API 설명: OpenAPI 3.1
- 컨테이너 런타임: Docker
- CI: GitHub Actions
- 배포: Kubernetes (Kustomize + Helm)

## 6. 기능 설계

### 6.1 릴리스 생명주기

릴리스 상태:

- `draft` (초안)
- `pending_approval` (승인 대기)
- `approved` (승인됨)
- `rejected` (거부됨)
- `scheduled` (예약됨)
- `deployed` (배포됨)
- `rolled_back` (롤백됨)

### 6.2 위험 입력

위험은 다음으로부터 계산됩니다:

- 대상 환경
- 서비스 중요성 계층
- 변경 카테고리
- 영향받는 구성 요소 수
- 고객 영향 점수
- 데이터 민감도 점수
- 자동화 테스트 준비 상태
- 롤백 준비 상태
- 모니터링 준비 상태
- 보안 검토 완료 상태

### 6.3 승인 라우팅

- 기본 승인: 릴리스 관리 팀
- 추가 승인: SRE (고위험 릴리스)
- 추가 승인: 보안 팀 (중요 또는 Tier-1 릴리스)

## 7. API 엔드포인트

### `GET /health`

헬스 프로브. 일반 텍스트 `ok` 반환.

### `GET /ready`

준비 상태 프로브. 데이터스토어 건강 상태 확인.

```bash
curl -s http://localhost:3000/ready | jq .
```

응답 필드:

- `status`: `ready` 또는 `not_ready`
- `version`: 실행 중인 서비스 버전
- `checks.datastore.status`: `ok` 또는 `error`
- `checks.datastore.releaseCount`: 데이터스토어의 총 릴리스 수
- `checks.datastore.teamCount`: 데이터스토어의 총 팀 수

### `GET /api/releases`

릴리스 목록 조회. 다중 필터 및 페이지네이션 지원.

지원되는 쿼리 매개변수:

- `environment`, `status`, `riskBand`, `application`, `owner`
- `pendingApprovals`, `sort`, `order`, `limit`, `offset`

### `POST /api/releases`

릴리스 요청 생성.

### `POST /api/releases/bulk`

대량 릴리스 생성 (최대 50개). 부분 실패 지원.

### `GET /api/releases/:releaseId`

단일 릴리스 조회.

### `GET /api/releases/:releaseId/evidence`

감사 증거 패키지 조회.

### `GET /api/releases/:releaseId/conflicts`

릴리스 윈도우 충돌 조회.

### `POST /api/releases/:releaseId/approvals`

릴리스 승인 또는 거부.

### `POST /api/releases/:releaseId/schedule`

승인된 릴리스 스케줄링. 윈도우 충돌 시 `409 release_window_conflict` 반환.

### `POST /api/releases/:releaseId/deploy`

배포 결과 기록.

### `GET /api/dashboard`

거버넌스 대시보드 지표.

### `GET /api/escalations`

운영 에스컬레이션 요약.

### `GET /api/escalations/report`

경영진 에스컬레이션 보고서.

### `GET /api/policy`

거버넌스 정책 설정.

## 7.1 Webhook API

### `GET /api/webhooks`

모든 Webhook 구독 목록 조회.

### `POST /api/webhooks`

Webhook 구독 생성.

### `DELETE /api/webhooks/:webhookId`

Webhook 구독 삭제.

### `GET /api/webhooks/events`

Webhook 이벤트 전달 로그 반환 (페이지네이션 지원).

## 7.2 배포

### Docker

```bash
docker build -t release-guardian:latest .
docker run -p 3000:3000 release-guardian:latest
```

### Kubernetes (Kustomize)

```bash
kubectl apply -k k8s/overlays/staging      # 스테이징 환경
kubectl apply -k k8s/overlays/production   # 프로덕션 환경
```

### Kubernetes (Helm)

```bash
helm install release-guardian helm/release-guardian \
  --set image.tag=2.0.0 \
  --set config.logLevel=info
```

## 8. 오류 모델

모든 오류는 통일된 형식을 따릅니다:

```json
{
  "error": {
    "code": "not_found",
    "message": "Release xyz was not found.",
    "details": {}
  }
}
```

| 상태 코드 | 오류 코드 | 의미 |
|-----------|----------|------|
| 400 | `validation_error` | 요청 매개변수가 유효하지 않음 |
| 401 | `unauthorized` | API Key가 없거나 유효하지 않음 |
| 404 | `not_found` | 리소스가 존재하지 않음 |
| 409 | `release_window_conflict` | 릴리스 윈도우 충돌 |
| 429 | `rate_limit_exceeded` | 속도 제한 초과 |
| 500 | `internal_error` | 서버 내부 오류 |

## 9. 빠른 시작

```bash
git clone https://github.com/cyl147368/release-guardian.git
cd release-guardian
npm install
npm start
```

기본값으로 `http://127.0.0.1:3000`에서 시작.

### 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3000` | 서비스 포트 |
| `HOST` | `127.0.0.1` | 리슨 주소 |
| `LOG_LEVEL` | `info` | 로그 레벨 |
| `RATE_LIMIT_ENABLED` | `false` | 속도 제한 활성화 |
| `RATE_LIMIT_MAX` | `100` | 윈도우당 최대 요청 수 |
| `API_KEYS` | _(비어있음)_ | 쉼표로 구분된 API Key |
| `CORS_ORIGIN` | `*` | CORS 허용 출처 |
| `MAX_BODY_BYTES` | `1048576` | Maximum request body size |
| `SECURITY_HEADERS` | `true` | 보안 응답 헤더 활성화 |

## 10. 검증 명령

```bash
npm run lint           # 구문 검사
npm test               # 테스트 실행 (135개 테스트)
npm run test:coverage  # 커버리지 포함 테스트
npm run test:bootstrap # 부트스트랩 테스트
```

## 11. 테스트 전략

- 모든 비즈니스 로직을 커버하는 단위 테스트
- 모든 HTTP 라우트와 상태 코드를 커버하는 API 테스트
- OpenAPI 계약 테스트로 스키마 검증
- 로깅, 속도 제한, 인증, CORS를 커버하는 미들웨어 테스트
- Webhook 구독, 디스패치, 전달 추적 테스트
- 대량 작업의 부분 실패 시나리오 테스트
- 커버리지 임계값: 80%

## 12. 운영 확장 권장 사항

- JSON 저장소를 데이터베이스로 교체 (`docs/DATABASE-MIGRATION.md` 참조)
- 인증 및 RBAC 추가
- 중앙 로그, 메트릭, 트레이싱 도입
- 백업 및 복구 절차 수립
- `docs/OPERATIONS.md` 및 `docs/SECURITY.md` 참조

## 13. 라이선스

MIT
