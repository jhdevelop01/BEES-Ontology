"""
LLM 채팅 API 라우터
OpenAI GPT Function Calling을 통한 건물 온톨로지 자연어 질의.
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import openai_service

router = APIRouter(prefix="/api", tags=["채팅"])


# ─── Pydantic 모델 ───────────────────────────────────────────

class ChatMessage(BaseModel):
    """채팅 메시지"""
    role: str = Field(..., description="메시지 역할 (user, assistant)")
    content: str = Field(..., description="메시지 내용")


class ChatRequest(BaseModel):
    """채팅 요청"""
    message: str = Field(..., description="사용자 메시지")
    history: list[ChatMessage] = Field(
        default_factory=list,
        description="대화 이력 (최근 메시지)",
    )


class ChatResponse(BaseModel):
    """채팅 응답"""
    response: str = Field(..., description="AI 응답 텍스트")
    cypher_queries: list[str] = Field(
        default_factory=list,
        description="실행된 Cypher 쿼리 목록",
    )
    sources: list[dict[str, Any]] = Field(
        default_factory=list,
        description="데이터 소스 정보",
    )
    tool_calls: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Function Calling 실행 로그",
    )


# ─── 엔드포인트 ──────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat_with_llm(request: ChatRequest) -> ChatResponse:
    """
    LLM 채팅 엔드포인트.
    자연어 질문을 받아 건물 온톨로지를 조회한 후 자연어로 응답합니다.
    """
    # 대화 이력을 dict 리스트로 변환
    history = [
        {"role": msg.role, "content": msg.content}
        for msg in request.history
    ]

    result = await openai_service.chat(
        message=request.message,
        history=history,
    )

    return ChatResponse(**result)


@router.get("/chat/status")
async def chat_status() -> dict[str, Any]:
    """
    채팅 서비스 상태 확인.
    OpenAI API 사용 가능 여부와 모델 정보를 반환합니다.
    """
    from app.config import OPENAI_MODEL

    return {
        "available": openai_service.is_available(),
        "model": OPENAI_MODEL if openai_service.is_available() else None,
    }
