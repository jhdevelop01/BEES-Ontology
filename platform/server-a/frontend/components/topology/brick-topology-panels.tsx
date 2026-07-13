/**
 * Brick Schema 개념 토폴로지 — 부가 프레젠테이션 패널 3종
 *
 * _imgs/온톨로지_토폴로지.png 우측 상단 범례, 하단 좌측 예시 경로,
 * 하단 우측 주요 관계 설명 박스를 재현한다.
 *
 * 데이터는 brick-topology-data.ts(단일 진실원)에서만 가져온다 — 이 파일은 순수 표현(presentation) 레이어.
 */

import {
  CATEGORY_META,
  RELATION_META,
  EXAMPLE_PATHS,
  LEGEND_CATEGORY_ORDER,
  RELATION_ORDER,
} from "./brick-topology-data";

/* ── 공통: 카드 래퍼 ── */
function PanelCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 shadow-xl backdrop-blur-xl ${className}`}
    >
      <h3 className="mb-2.5 text-[13px] font-bold text-slate-100">{title}</h3>
      {children}
    </div>
  );
}

/* ── 관계 선 스타일 샘플 (실선/점선 + 화살표) ── */
function RelationLineSample({ color, dashed }: { color: string; dashed: boolean }) {
  return (
    <svg width="34" height="12" viewBox="0 0 34 12" className="flex-shrink-0">
      <line
        x1="1"
        y1="6"
        x2="26"
        y2="6"
        stroke={color}
        strokeWidth={1.75}
        strokeDasharray={dashed ? "3,2.5" : undefined}
      />
      <path d="M 26 2 L 33 6 L 26 10 Z" fill={color} />
    </svg>
  );
}

/* ── 1) 범례 (Legend) ── */
export function BrickLegend() {
  return (
    <PanelCard title="범례 (Legend)">
      {/* 카테고리 3종 */}
      <div className="mb-3 flex flex-col gap-1.5">
        {LEGEND_CATEGORY_ORDER.map((catKey) => {
          const meta = CATEGORY_META[catKey];
          return (
            <div key={catKey} className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 flex-shrink-0 rounded-[4px]"
                style={{ background: meta.accent, border: `1.5px solid ${meta.accent}` }}
              />
              <span className="text-[12px] text-slate-300">
                {meta.labelKo} ({meta.labelEn})
              </span>
            </div>
          );
        })}
      </div>

      <div className="my-2 h-px bg-white/10" />

      {/* 관계 8종 */}
      <div className="mb-1 text-[12px] font-semibold text-slate-400">관계 (Relationships)</div>
      <div className="flex flex-col gap-1.5">
        {RELATION_ORDER.map((relKey) => {
          const meta = RELATION_META[relKey];
          return (
            <div key={relKey} className="flex items-center gap-2">
              <RelationLineSample color={meta.color} dashed={meta.dashed} />
              <span className="text-[12px] text-slate-300">
                {meta.labelEn} / {meta.labelKo}
              </span>
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}

/* ── 2) 예시 경로 (Example Paths) ── */
const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤"];

export function BrickExamplePaths() {
  return (
    <PanelCard title="예시 경로 (Example Paths)">
      <div className="flex flex-col gap-2.5">
        {EXAMPLE_PATHS.map((path, i) => (
          <div key={path.no} className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="mr-0.5 font-bold text-slate-300">
              {CIRCLED_NUMBERS[i] ?? `${path.no}.`}
            </span>
            {path.steps.map((step, j) => {
              const meta = CATEGORY_META[step.category];
              return (
                <span key={j} className="flex items-center gap-1.5">
                  {j > 0 && (
                    <span
                      className="text-[13px] font-bold"
                      style={{ color: meta.accent }}
                      aria-hidden
                    >
                      →
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: meta.accent }}
                    />
                    <span className="text-slate-300">{step.labelKo}</span>
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

/* ── 3) 주요 관계 설명 (Relationship Reference) ── */
export function BrickRelationReference() {
  return (
    <PanelCard title="주요 관계 설명 (Relationship Reference)">
      <div className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
        {RELATION_ORDER.map((relKey) => {
          const meta = RELATION_META[relKey];
          return (
            <div key={relKey} className="text-[12px] leading-snug">
              <span className="font-semibold" style={{ color: meta.color }}>
                {meta.labelEn} / {meta.labelKo}
              </span>
              <span className="text-slate-400"> : {meta.desc}</span>
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}
