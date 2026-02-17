"""
BEES Platform — InfluxDB 다운샘플링 태스크 등록

보존 정책별 데이터 집계:
  raw_7d (5초 원시) → aggregated_30d (5분 평균) → aggregated_365d (1시간 평균)

InfluxDB Task API를 사용하여 Flux 태스크를 자동 등록한다.
"""

import logging
from typing import Optional

from influxdb_client import InfluxDBClient
from influxdb_client.client.tasks_api import TasksApi
from influxdb_client.rest import ApiException

from .config import settings

logger = logging.getLogger("server-d.downsampling")

# Flux 태스크 정의
TASKS = [
    {
        "name": "bees_downsample_5m",
        "description": "5분 평균 집계: raw_7d → aggregated_30d",
        "every": "5m",
        "offset": "30s",
        "flux": '''
option task = {{name: "bees_downsample_5m", every: 5m, offset: 30s}}

from(bucket: "raw_7d")
  |> range(start: -10m)
  |> filter(fn: (r) => r._measurement == "sensor_data" and r._field == "value")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> set(key: "_measurement", value: "sensor_data")
  |> to(bucket: "aggregated_30d", org: "{org}")
''',
    },
    {
        "name": "bees_downsample_1h",
        "description": "1시간 평균 집계: aggregated_30d → aggregated_365d",
        "every": "1h",
        "offset": "5m",
        "flux": '''
option task = {{name: "bees_downsample_1h", every: 1h, offset: 5m}}

from(bucket: "aggregated_30d")
  |> range(start: -2h)
  |> filter(fn: (r) => r._measurement == "sensor_data" and r._field == "value")
  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
  |> set(key: "_measurement", value: "sensor_data")
  |> to(bucket: "aggregated_365d", org: "{org}")
''',
    },
]


def ensure_downsampling_tasks(client: Optional[InfluxDBClient] = None) -> int:
    """
    InfluxDB 다운샘플링 태스크를 확인/등록한다.

    Returns:
        생성된 태스크 수
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
        tasks_api: TasksApi = client.tasks_api()
        created = 0

        for task_def in TASKS:
            task_name = task_def["name"]

            # 기존 태스크 확인
            existing = tasks_api.find_tasks(name=task_name)
            if existing:
                logger.info("다운샘플링 태스크 이미 존재: %s", task_name)
                continue

            # Flux 스크립트에 org 삽입
            flux_script = task_def["flux"].format(org=settings.influxdb_org)

            # 태스크 생성
            try:
                tasks_api.create_task_every(
                    name=task_name,
                    flux=flux_script,
                    every=task_def["every"],
                    organization=client.org,
                )
                created += 1
                logger.info(
                    "다운샘플링 태스크 생성: %s (every=%s)",
                    task_name, task_def["every"],
                )
            except ApiException as e:
                # InfluxDB OSS는 Task API 미지원일 수 있음
                logger.warning(
                    "태스크 생성 실패 (InfluxDB OSS 제한 가능): %s — %s",
                    task_name, e,
                )

        return created

    except Exception as e:
        logger.error("다운샘플링 태스크 확인/등록 실패: %s", e)
        return 0
    finally:
        if close_after:
            client.close()
