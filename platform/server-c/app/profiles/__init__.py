"""
데이터 프로파일 패키지.
각 센서 유형별 데이터 생성 프로파일을 정의한다.
"""

from .ahu_5f import AHU_5F_DEVICE, AHU_5F_PROFILES

__all__ = ["AHU_5F_DEVICE", "AHU_5F_PROFILES"]
