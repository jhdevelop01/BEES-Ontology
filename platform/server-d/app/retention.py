"""
InfluxDB 데이터 보존 정책 관리.

버킷별 보존 기간:
  - raw_7d:          7일 (168h)    — 원시 센서 데이터
  - aggregated_30d:  30일 (720h)   — 1시간 평균
  - aggregated_365d: 365일 (8760h) — 1일 평균
"""

import logging
from typing import Optional

from influxdb_client import InfluxDBClient, BucketRetentionRules
from influxdb_client.rest import ApiException

from .config import settings

logger = logging.getLogger("server-d.retention")

# 버킷 정의: (이름, 보존 기간 초)
BUCKET_DEFINITIONS: list[tuple[str, int]] = [
    ("raw_7d", 7 * 24 * 3600),          # 168시간
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

        for bucket_name, retention_seconds in BUCKET_DEFINITIONS:
            existing = buckets_api.find_bucket_by_name(bucket_name)
            if existing:
                logger.info("버킷 이미 존재: %s (보존: %dh)", bucket_name, retention_seconds // 3600)
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
                "버킷 생성 완료: %s (보존: %dh)", bucket_name, retention_seconds // 3600,
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
