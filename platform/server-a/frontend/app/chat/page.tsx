"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
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
  type ChatSourceInfo,
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
  "example1", "example2", "example3", "example4", "example5", "example6",
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
  sources?: ChatSourceInfo[];
}

/* ── 섹션별 파싱 렌더링 컴포넌트 ── */

interface Section {
  label: string;
  body: string;
}

function parseStructuredResponse(text: string): Section[] | null {
  const sectionRegex = /\[(요약|상세|종합)\]\s*/g;
  const matches = Array.from(text.matchAll(sectionRegex));
  if (matches.length < 2) return null; // 구조화 응답이 아니면 null

  const sections: Section[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const body = text.slice(start, end).trim();
    if (body) {
      sections.push({ label: matches[i][1], body });
    }
  }
  return sections.length > 0 ? sections : null;
}

const SECTION_STYLES: Record<string, { border: string; bg: string; text: string; icon: string }> = {
  "요약": { border: "border-cyan-500/30", bg: "bg-cyan-500/5", text: "text-cyan-400", icon: "TL;DR" },
  "상세": { border: "border-slate-500/30", bg: "bg-white/[0.02]", text: "text-slate-400", icon: "Details" },
  "종합": { border: "border-emerald-500/30", bg: "bg-emerald-500/5", text: "text-emerald-400", icon: "Summary" },
};

function StructuredMessage({ content }: { content: string }) {
  const sections = parseStructuredResponse(content);

  if (!sections) {
    // 구조화 응답이 아닌 경우 일반 텍스트 렌더링
    return <div className="text-sm whitespace-pre-wrap text-slate-200">{content}</div>;
  }

  return (
    <div className="space-y-2.5">
      {sections.map((sec, i) => {
        const style = SECTION_STYLES[sec.label] || SECTION_STYLES["상세"];
        return (
          <div
            key={i}
            className={`rounded-md border ${style.border} ${style.bg} px-3 py-2.5`}
          >
            <div className={`text-[10px] font-medium ${style.text} mb-1.5 uppercase tracking-wider`}>
              {sec.label}
            </div>
            <div className="text-sm whitespace-pre-wrap text-slate-200 leading-relaxed">
              {sec.body}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Cypher 코드 블록 컴포넌트 ── */

function CypherBlock({ queries }: { queries: string[] }) {
  const [open, setOpen] = useState(false);

  if (queries.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
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
              className="bg-black/40 text-green-400 text-xs p-2.5 rounded-md overflow-x-auto border border-white/5"
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
  const t = useTranslations("chat");
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
          content: t("errorOccurred", { message: err instanceof Error ? err.message : "unknown" }),
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
      <Header title={t("title")} description={t("description")} />

      {/* 상태 바 */}
      <div className="px-6 py-2 border-b border-white/10 flex items-center gap-2">
        {statusLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
        ) : status?.available ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400">
              {t("connected", { model: status.model || "GPT-4o" })}
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-amber-400">{t("apiKeyNotSet")}</span>
          </>
        )}
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          /* 빈 상태 */
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-lg">
              <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-cyan-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                {t("assistantTitle")}
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                {t("assistantDesc")}
              </p>

              {/* 예제 질문 */}
              <div className="grid grid-cols-2 gap-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    className="text-left px-3 py-2.5 text-sm text-slate-300 bg-white/5 hover:bg-cyan-500/10 hover:text-cyan-300 rounded-lg border border-white/10 hover:border-cyan-500/20 transition-colors"
                    onClick={() => handleSend(t(q))}
                  >
                    {t(q)}
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
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-cyan-400" />
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
                        ? "bg-cyan-500/10 border-cyan-500/20"
                        : "bg-white/5"
                    }`}
                  >
                    <CardContent className="p-3">
                      {/* 메시지 본문 */}
                      {msg.role === "assistant" ? (
                        <StructuredMessage content={msg.content} />
                      ) : (
                        <div className="text-sm whitespace-pre-wrap text-white">
                          {msg.content}
                        </div>
                      )}

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
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <p className="text-[10px] text-slate-500 mb-1">
                            {t("sources")}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {msg.sources.map((s, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {s.tool} ({s.result_count} 건)
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
                        ? "text-right text-slate-500"
                        : "text-slate-500"
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
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {/* 로딩 인디케이터 */}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-cyan-400" />
                </div>
                <Card className="bg-white/5">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t("loadingData")}</span>
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
      <div className="border-t border-white/10 bg-white/5 backdrop-blur-xl p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            placeholder={t("inputPlaceholder")}
            className="flex-1 px-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
