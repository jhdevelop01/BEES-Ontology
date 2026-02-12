"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  sendChatMessage,
  getChatStatus,
  type ChatMessage,
  type ChatResponse,
  type ChatStatusResponse,
} from "@/lib/api";
import {
  Send,
  Bot,
  User,
  Loader2,
  MessageCircle,
  Database,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

/* ── 예제 질문 ── */

const EXAMPLE_QUESTIONS = [
  "5층에 있는 장비 목록 보여줘",
  "AHU_UFAD_1과 연결된 센서는?",
  "냉방 시스템의 에너지 흐름을 설명해줘",
  "B동에서 가장 많은 센서가 있는 층은?",
  "칠드실링 시스템 구성을 알려줘",
  "GEC B동 건물 개요를 설명해줘",
];

/* ── 메시지 항목 타입 ── */

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  cypherQueries?: string[];
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result_count: number;
  }>;
  sources?: string[];
}

/* ── Cypher 코드 블록 컴포넌트 ── */

function CypherBlock({ queries }: { queries: string[] }) {
  const [open, setOpen] = useState(false);

  if (queries.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Database className="h-3 w-3" />
        Cypher 쿼리 ({queries.length})
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {queries.map((q, i) => (
            <pre
              key={i}
              className="bg-gray-900 text-green-400 text-xs p-2.5 rounded-md overflow-x-auto"
            >
              {q}
            </pre>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 메인 페이지 ── */

export default function ChatPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ChatStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── 서비스 상태 확인 ── */
  useEffect(() => {
    const checkStatus = async () => {
      setStatusLoading(true);
      try {
        const s = await getChatStatus();
        setStatus(s);
      } catch {
        setStatus({ available: false, model: null });
      } finally {
        setStatusLoading(false);
      }
    };
    checkStatus();
  }, []);

  /* ── 자동 스크롤 ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ── 메시지 전송 ── */
  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || loading) return;

      const userMsg: DisplayMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: msg,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        // ChatMessage 이력 구성 (최근 10개)
        const history: ChatMessage[] = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res: ChatResponse = await sendChatMessage(msg, history);

        const assistantMsg: DisplayMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.response,
          timestamp: new Date(),
          cypherQueries: res.cypher_queries,
          toolCalls: res.tool_calls,
          sources: res.sources,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg: DisplayMessage = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `오류가 발생했습니다: ${
            err instanceof Error ? err.message : "알 수 없는 오류"
          }`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
        // 입력 필드로 포커스 복귀
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [input, loading, messages]
  );

  /* ── 키보드 이벤트 ── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── 렌더 ── */
  return (
    <div className="min-h-screen flex flex-col">
      <Header title="AI 채팅" description="GEC B동 온톨로지 기반 질의응답" />

      {/* 상태 바 */}
      <div className="px-6 py-2 border-b border-gray-100 flex items-center gap-2">
        {statusLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
        ) : status?.available ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-green-600">
              {status.model || "GPT-4o"} 연결됨
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
            <span className="text-xs text-yellow-600">API 키 미설정</span>
          </>
        )}
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          /* 빈 상태 */
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-lg">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                GEC B동 AI 어시스턴트
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Brick Schema 온톨로지와 Neo4j 그래프 데이터를 기반으로
                건물 시스템에 대해 질문할 수 있습니다.
              </p>

              {/* 예제 질문 */}
              <div className="grid grid-cols-2 gap-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    className="text-left px-3 py-2.5 text-sm text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors"
                    onClick={() => handleSend(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* 메시지 리스트 */
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {/* 어시스턴트 아바타 */}
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                )}

                {/* 메시지 버블 */}
                <div
                  className={`max-w-[75%] ${
                    msg.role === "user" ? "order-first" : ""
                  }`}
                >
                  <Card
                    className={`${
                      msg.role === "user"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white"
                    }`}
                  >
                    <CardContent className="p-3">
                      {/* 메시지 본문 */}
                      <div
                        className={`text-sm whitespace-pre-wrap ${
                          msg.role === "user" ? "text-white" : "text-gray-800"
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* 도구 호출 배지 */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {msg.toolCalls.map((tc, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[10px]"
                            >
                              {tc.name} ({tc.result_count} 건)
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Cypher 쿼리 */}
                      {msg.cypherQueries && msg.cypherQueries.length > 0 && (
                        <CypherBlock queries={msg.cypherQueries} />
                      )}

                      {/* 출처 */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-[10px] text-gray-400 mb-1">
                            출처
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {msg.sources.map((s, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 타임스탬프 */}
                  <p
                    className={`text-[10px] mt-1 ${
                      msg.role === "user"
                        ? "text-right text-gray-400"
                        : "text-gray-400"
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* 사용자 아바타 */}
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {/* 로딩 인디케이터 */}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
                <Card className="bg-white">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Neo4j에서 데이터를 조회하고 있습니다...</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력 바 */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="GEC B동에 대해 질문하세요..."
            className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
