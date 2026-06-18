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

## 빠른 시작

```bash
npm install
npm start
```

기본 주소:

- `http://127.0.0.1:3000`

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
