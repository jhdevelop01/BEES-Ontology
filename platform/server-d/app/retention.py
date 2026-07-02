"""
InfluxDB 데이터 보존 정책 관리.

버킷별 보존 기간:
  - raw_7d:          무한 보존 (0)  — 원시 센서 데이터 (수집분 전량 영구 저장, 삭제 안 함)
  - aggregated_30d:  30일 (720h)   — 5분 평균 (다운샘플 롤업)
  - aggregated_365d: 365일 (8760h) — 1시간 평균 (다운샘플 롤업)

주의: 'raw_7d'는 명칭상 7일이었으나, "수집 데이터 무손실 저장" 요구에 따라
보존 기간을 0(무한)으로 변경함. 버킷 이름은 ingestion 경로(settings.influxdb_bucket)
호환을 위해 유지(명칭은 레거시). every_seconds=0 = InfluxDB 무한 보존.
"""

import logging
from typing import Optional

from influxdb_client import InfluxDBClient, BucketRetentionRules
from influxdb_client.rest import ApiException

from .config import settings

logger = logging.getLogger("server-d.retention")

# 버킷 정의: (이름, 보존 기간 초). 0 = 무한 보존(삭제 안 함).
BUCKET_DEFINITIONS: list[tuple[str, int]] = [
    ("raw_7d", 0),                        # 무한 보존 — 수집 원시 데이터 전량 영구 저장
    ("aggregated_30d", 30 * 24 * 3600),  # 720시간
    ("aggregated_365d", 365 * 24 * 3600),  # 8760시간
]


def ensure_buckets(client: Optional[InfluxDBClient] = None) -> int:
    """
    InfluxDB 버킷이 존재하는지 확인하고, 없으면 생성한다.

    Returns:
        생성된 버킷 수. 이미 존재하면 0.
    """
    close_after = False
    if client is None:
        client = InfluxDBClient(
            url=settings.influxdb_url,
            token=settings.influxdb_token,
            org=settings.influxdb_org,
        )
        close_after = True

    try:
        buckets_api = client.buckets_api()
        created = 0

        def _fmt(sec: int) -> str:
            return "무한" if sec == 0 else f"{sec // 3600}h"

        for bucket_name, retention_seconds in BUCKET_DEFINITIONS:
            existing = buckets_api.find_bucket_by_name(bucket_name)
            if existing:
                # 기존 버킷의 보존정책이 목표와 다르면 갱신 (원시 버킷 무한보존 반영 등).
                # find/skip만 하면 이미 생성된 버킷엔 정책 변경이 적용되지 않으므로 반드시 update.
                rules = existing.retention_rules or []
                current = rules[0].every_seconds if rules else 0
                if current != retention_seconds:
                    existing.retention_rules = [
                        BucketRetentionRules(type="expire", every_seconds=retention_seconds)
                    ]
                    buckets_api.update_bucket(bucket=existing)
                    logger.info(
                        "버킷 보존정책 갱신: %s (%s → %s)",
                        bucket_name, _fmt(current), _fmt(retention_seconds),
                    )
                else:
                    logger.info("버킷 이미 존재: %s (보존: %s)", bucket_name, _fmt(retention_seconds))
                continue

            # 버킷 생성
            retention_rules = BucketRetentionRules(
                type="expire",
                every_seconds=retention_seconds,
            )
            buckets_api.create_bucket(
                bucket_name=bucket_name,
                retention_rules=retention_rules,
                org=settings.influxdb_org,
            )
            created += 1
            logger.info(
                "버킷 생성 완료: %s (보존: %s)", bucket_name, _fmt(retention_seconds),
            )

        logger.info("보존 정책 확인 완료: %d개 신규 생성", created)
        return created

    except ApiException as e:
        logger.error("InfluxDB API 오류 (버킷 생성): %s", e)
        return 0
    except Exception as e:
        logger.error("버킷 확인/생성 실패: %s", e)
        return 0
    finally:
        if close_after:
            client.close()
