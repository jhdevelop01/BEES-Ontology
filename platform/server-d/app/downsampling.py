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
# 주의: 태스크 이름은 InfluxDB에 이미 프로비저닝된 태스크(downsample_30d/downsample_365d)와
#       일치시켜, 이미 존재하면 재생성하지 않고 skip(멱등)하도록 한다.
# 주의: flux에 'option task = {...}'를 넣지 않는다 — create_task_every가 name/every로
#       task 옵션을 자동 주입하므로, 중복 정의 시 "multiple task options defined" 400 발생.
TASKS = [
    {
        "name": "downsample_30d",
        "description": "5분 평균 집계: raw_7d → aggregated_30d",
        "every": "5m",
        "offset": "30s",
        "flux": '''from(bucket: "raw_7d")
  |> range(start: -10m)
  |> filter(fn: (r) => r._measurement == "sensor_data" and r._field == "value")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> set(key: "_measurement", value: "sensor_data")
  |> to(bucket: "aggregated_30d", org: "{org}")
''',
    },
    {
        "name": "downsample_365d",
        "description": "1시간 평균 집계: aggregated_30d → aggregated_365d",
        "every": "1h",
        "offset": "5m",
        "flux": '''from(bucket: "aggregated_30d")
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

        # create_task_every는 organization "객체"(.id 보유)를 요구한다.
        # client.org는 org "이름" 문자열이라 그대로 넘기면 내부에서 organization.id 참조 시
        # 'str' object has no attribute 'id' 예외 발생 → org 객체를 조회해 사용한다.
        org_api = client.organizations_api()
        org = None
        try:
            found = org_api.find_organizations(org=settings.influxdb_org)
            org = found[0] if found else None
        except Exception:
            org = None
        if org is None:  # 이름 필터 미지원/실패 시 전체 조회 후 이름 매칭
            for o in org_api.find_organizations():
                if o.name == settings.influxdb_org:
                    org = o
                    break
        if org is None:
            logger.error(
                "org 조회 실패: %s — 다운샘플 태스크 등록 건너뜀", settings.influxdb_org
            )
            return 0

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
                    organization=org,
                )
                created += 1
                logger.info(
                    "다운샘플링 태스크 생성: %s (every=%s)",
                    task_name, task_def["every"],
                )
            except Exception as e:
                # InfluxDB OSS Task API 미지원 등 개별 태스크 실패는 로그만 남기고 계속
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
