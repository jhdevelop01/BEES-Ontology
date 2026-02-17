"""
Server B — 명령 큐잉 시스템

Server C 호출 실패 시 명령을 큐에 보관하고 지수 백오프로 재시도한다.

기능:
  - FIFO 큐: asyncio.Queue 기반
  - 재시도: 최대 5회, 지수 백오프 (1s, 2s, 4s, 8s, 16s)
  - TTL: 30분 이후 만료 처리
  - 상태 조회: 큐 크기, 대기 명령, 만료 건수
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger("server-b.command_queue")


@dataclass
class QueuedCommand:
    """큐에 보관된 명령."""
    command_id: str
    device_id: str
    command: str
    params: dict[str, Any]
    user_id: int
    retry_count: int = 0
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        """직렬화 가능한 딕셔너리로 변환."""
        return {
            "command_id": self.command_id,
            "device_id": self.device_id,
            "command": self.command,
            "params": self.params,
            "user_id": self.user_id,
            "retry_count": self.retry_count,
            "created_at": self.created_at,
            "age_seconds": round(time.time() - self.created_at, 1),
        }


class CommandQueue:
    """명령 재시도 큐."""

    def __init__(
        self,
        max_retries: int = 5,
        ttl_seconds: int = 1800,
    ) -> None:
        self._queue: asyncio.Queue[QueuedCommand] = asyncio.Queue()
        self._max_retries = max_retries
        self._ttl = ttl_seconds
        self._processor_task: Optional[asyncio.Task] = None

        # 통계
        self._enqueued: int = 0
        self._succeeded: int = 0
        self._expired: int = 0
        self._failed: int = 0

        # Server C 호출 함수 (외부에서 주입)
        self._send_fn: Optional[Any] = None

    def set_send_function(self, fn) -> None:
        """Server C 호출 함수를 설정한다."""
        self._send_fn = fn

    async def enqueue(self, command: dict[str, Any]) -> str:
        """
        명령을 큐에 추가한다.

        Args:
            command: {"deviceId", "command", "params", "userId"}

        Returns:
            command_id: 생성된 명령 식별자
        """
        command_id = str(uuid.uuid4())[:8]
        queued = QueuedCommand(
            command_id=command_id,
            device_id=command["deviceId"],
            command=command["command"],
            params=command.get("params", {}),
            user_id=command.get("userId", 0),
        )
        await self._queue.put(queued)
        self._enqueued += 1
        logger.info(
            "명령 큐 추가: id=%s, device=%s, command=%s (큐 크기: %d)",
            command_id, queued.device_id, queued.command, self._queue.qsize(),
        )
        return command_id

    async def start_processor(self) -> None:
        """큐 프로세서 백그라운드 태스크 시작."""
        self._processor_task = asyncio.create_task(self._process_queue())
        logger.info("명령 큐 프로세서 시작")

    async def stop_processor(self) -> None:
        """큐 프로세서 중지."""
        if self._processor_task:
            self._processor_task.cancel()
            try:
                await self._processor_task
            except asyncio.CancelledError:
                pass
            logger.info("명령 큐 프로세서 중지")

    async def _process_queue(self) -> None:
        """큐에서 명령을 꺼내 재시도한다."""
        while True:
            try:
                cmd = await self._queue.get()

                # TTL 만료 체크
                age = time.time() - cmd.created_at
                if age > self._ttl:
                    self._expired += 1
                    logger.warning(
                        "명령 TTL 만료: id=%s, device=%s (경과: %.0f초)",
                        cmd.command_id, cmd.device_id, age,
                    )
                    self._queue.task_done()
                    continue

                # 재시도 횟수 초과 체크
                if cmd.retry_count >= self._max_retries:
                    self._failed += 1
                    logger.error(
                        "명령 재시도 초과: id=%s, device=%s (%d/%d)",
                        cmd.command_id, cmd.device_id,
                        cmd.retry_count, self._max_retries,
                    )
                    self._queue.task_done()
                    continue

                # 지수 백오프 대기 (1s, 2s, 4s, 8s, 16s)
                delay = 2 ** cmd.retry_count
                logger.info(
                    "명령 재시도 대기: id=%s, retry=%d, delay=%ds",
                    cmd.command_id, cmd.retry_count + 1, delay,
                )
                await asyncio.sleep(delay)

                # Server C 호출 시도
                success = await self._try_send(cmd)
                if success:
                    self._succeeded += 1
                    logger.info(
                        "큐 명령 전송 성공: id=%s, device=%s (retry=%d)",
                        cmd.command_id, cmd.device_id, cmd.retry_count + 1,
                    )
                else:
                    # 재시도 카운트 증가 후 큐에 재삽입
                    cmd.retry_count += 1
                    await self._queue.put(cmd)
                    logger.warning(
                        "큐 명령 전송 실패: id=%s, device=%s (retry=%d/%d)",
                        cmd.command_id, cmd.device_id,
                        cmd.retry_count, self._max_retries,
                    )

                self._queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("큐 프로세서 오류: %s", e)
                await asyncio.sleep(1)

    async def _try_send(self, cmd: QueuedCommand) -> bool:
        """Server C에 명령을 전송한다."""
        if self._send_fn is None:
            logger.error("send_fn 미설정 — 명령 전송 불가")
            return False

        try:
            return await self._send_fn(cmd.device_id, cmd.command, cmd.params)
        except Exception as e:
            logger.error("Server C 호출 예외: %s", e)
            return False

    def get_status(self) -> dict[str, Any]:
        """큐 상태 조회."""
        return {
            "queue_size": self._queue.qsize(),
            "max_retries": self._max_retries,
            "ttl_seconds": self._ttl,
            "stats": {
                "enqueued": self._enqueued,
                "succeeded": self._succeeded,
                "expired": self._expired,
                "failed": self._failed,
            },
        }


# 싱글톤 인스턴스
command_queue = CommandQueue()
