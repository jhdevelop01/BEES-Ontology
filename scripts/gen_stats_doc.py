#!/usr/bin/env python3
"""
gen_stats_doc.py — _docs/07_온톨로지_통계_요약.md 의 canonical 통계 수치를
GEC_B_Ontology.ttl / GEC_B_SHACL.ttl 실측값으로 자동 갱신한다.

배경: 07 문서는 손으로 쓴 설비/센서/ESG 표(도메인 지식)와,
      TTL 에서 기계적으로 셀 수 있는 canonical 수치(트리플/클래스/속성/인스턴스/관계 카운트)가 섞여 있다.
      후자는 온톨로지가 확장될 때마다 drift(문서가 뒤처짐)가 발생했다.
      이 스크립트는 "파생 가능한 수치"만 자동 갱신하고, 손으로 쓴 산문/스펙 표는 절대 건드리지 않는다.

자동 관리 대상:
  1) §1 전체 요약 표          → <!-- AUTOGEN:overview --> 마커 블록 전체 재생성
  2) §1 인스턴스 대분류 표     → <!-- AUTOGEN:instances --> 마커 블록 전체 재생성
  3) §7 관계 통계 표          → <!-- AUTOGEN:relationships --> 마커 블록 전체 재생성
  4) §11 주요 수치 표의 파생행 → 라벨 앵커(행 라벨 고정)로 숫자 셀만 치환
  5) 헤더 TTL 라인 수 / 푸터 트리플 검증값 → 앵커 치환

사용법:
  python3 scripts/gen_stats_doc.py            # 문서 갱신(write)
  python3 scripts/gen_stats_doc.py --check    # drift 검출만(비수정), stale 있으면 exit 1  (CI 용)

주의: rdflib serialize 로 TTL 을 재직렬화하지 않는다(문서만 텍스트 편집).
"""
from __future__ import annotations
import argparse
import re
import subprocess
import sys
from pathlib import Path

from rdflib import Graph, RDF, OWL, Namespace, URIRef

ROOT = Path(__file__).resolve().parent.parent
TTL = ROOT / "ontology" / "GEC_B_Ontology.ttl"
SHACL = ROOT / "ontology" / "GEC_B_SHACL.ttl"
DOC = ROOT / "_docs" / "07_온톨로지_통계_요약.md"

SH = Namespace("http://www.w3.org/ns/shacl#")

# §7 관계표에 노출할 관계와 (손으로 쓴) 설명 — 순서/설명은 여기서 관리
REL_ROWS = [
    ("feeds", "에너지/유체 공급 관계"),
    ("isFedBy", "역방향 공급 관계"),
    ("isPartOf", "부분→전체 소속 관계"),
    ("hasPart", "전체→부분 포함 관계"),
    ("hasLocation", "물리적 위치 지정"),
    ("isPointOf", "포인트→장비/시스템 연결"),
    ("hasPoint", "장비/시스템→포인트 연결"),
]

# ── 인스턴스 대분류(§1) ─────────────────────────────────────────────────────
# 규칙은 Brick 클래스명 접미사/열거 기반. 우선순위 순서대로 첫 매치 버킷에 배정하며,
# 마지막 "Equipment/기타"가 잔여(residual) 버킷이라 분류는 항상 전수 파티션이 된다
# (= 합계가 canonical 인스턴스 수와 필연적으로 일치. 미분류 버킷이 생길 수 없음).
#
# 복수 rdf:type 인스턴스(현재 3건: Mechanical_Room+Room ×2, Controller+Server ×1)는
# 우선순위가 앞선 버킷 하나에만 계상해 중복 집계를 막는다.
#
# 위치 계열(Location) 열거 — Brick 계층을 TTL이 import 하지 않아 이름 기반으로 명시
LOCATION_CLASSES = {
    "Room", "Office_Space", "Meeting_Room", "Server_Room", "Support_Space",
    "Mechanical_Room", "Location", "Building", "Site",
}
# 에너지/ESG 프로파일 계열 — 시계열/집계 데이터 노드
PROFILE_CLASSES = {"EnergyBreakdown"}
# 시스템 계열 중 접미사 규칙(_System)으로 잡히지 않는 것
SYSTEM_EXTRA = {"Chiller_Plant", "BAS_Network_Layer"}

# 표에 노출할 버킷 라벨 (우선순위 = 판정 순서. Equipment/기타는 반드시 마지막)
BUCKETS = [
    "Alarm",
    "Floor",
    "HVAC Zone",
    "Status (상태점)",
    "Command/Setpoint",
    "Sensor",
    "System",
    "Room/Space",
    "Profile (에너지/ESG)",
    "Equipment/기타",
]


def classify(cls: str) -> str:
    """Brick 클래스명 → §1 대분류 버킷. 어떤 이름이든 반드시 하나의 버킷을 반환."""
    if cls == "Alarm" or cls.endswith("_Alarm"):
        return "Alarm"
    if cls == "Floor":
        return "Floor"
    if cls == "HVAC_Zone":
        return "HVAC Zone"
    if cls.endswith("_Status"):
        return "Status (상태점)"
    if cls.endswith("_Command") or cls.endswith("_Setpoint"):
        return "Command/Setpoint"
    if cls == "Sensor" or cls.endswith("_Sensor"):
        return "Sensor"
    if cls.endswith("_System") or cls in SYSTEM_EXTRA:
        return "System"
    if cls in LOCATION_CLASSES:
        return "Room/Space"
    if (
        "Profile" in cls
        or cls.startswith("GHG_")
        or cls.endswith("_Category_Score")
        or cls in PROFILE_CLASSES
    ):
        return "Profile (에너지/ESG)"
    return "Equipment/기타"  # 잔여 버킷 (장비 + 미분류 전부)


def measure() -> dict:
    """TTL/SHACL 을 파싱해 canonical 수치를 실측한다."""
    g = Graph()
    g.parse(str(TTL), format="turtle")
    ns = dict(g.namespaces())
    bees = str(ns.get("bees", "https://example.org/bees#"))
    brick = Namespace(str(ns.get("brick", "https://brickschema.org/schema/Brick#")))

    triples = len(g)
    classes = sum(
        1 for s, _, _ in g.triples((None, RDF.type, OWL.Class)) if str(s).startswith(bees)
    )
    props = sum(
        1
        for s, _, _ in g.triples((None, RDF.type, OWL.DatatypeProperty))
        if str(s).startswith(bees)
    )
    schema_types = {
        OWL.Class,
        OWL.DatatypeProperty,
        OWL.ObjectProperty,
        OWL.Ontology,
        OWL.NamedIndividual,
        RDF.Property,
    }
    # 인스턴스 → 보유 클래스명 집합 (복수 rdf:type 대응)
    inst_types: dict = {}
    for s, _, o in g.triples((None, RDF.type, None)):
        if o in schema_types:
            continue
        inst_types.setdefault(s, set()).add(str(o).split("#")[-1])
    instances = len(inst_types)

    # 대분류 집계 — 복수 rdf:type 인스턴스는 대표 클래스 1개만 뽑아 계상.
    # buckets 와 cls_counts 를 같은 대표 클래스로 세야 §1(대분류)과 §11(파생행)이
    # 구조적으로 정합한다. 클래스별로 따로 세면 같은 버킷에 속한 두 타입이 이중계상됨.
    buckets = {b: 0 for b in BUCKETS}
    cls_counts: dict = {}  # 세부 클래스 카운트(§11 파생행용)
    for _s, types in inst_types.items():
        winner = min(types, key=lambda c: (BUCKETS.index(classify(c)), c))
        buckets[classify(winner)] += 1
        cls_counts[winner] = cls_counts.get(winner, 0) + 1

    bsum = sum(buckets.values())
    if bsum != instances:  # 잔여 버킷 구조상 발생 불가 — 방어적 assert
        raise SystemExit(
            f"[ERROR] 대분류 합계({bsum}) != 인스턴스 수({instances}). classify() 규칙 점검 필요"
        )
    if sum(cls_counts.values()) != instances:
        raise SystemExit(
            f"[ERROR] 세부 클래스 합계({sum(cls_counts.values())}) != 인스턴스 수({instances})."
            " 인스턴스당 대표 클래스 1개 계상 규칙이 깨졌음"
        )

    # §11 파생행용 세부 카운트 (§1 대분류와 필연적으로 정합)
    def csum(pred) -> int:
        return sum(v for k, v in cls_counts.items() if pred(k))

    commands = csum(lambda c: c.endswith("_Command"))
    setpoints = csum(lambda c: c.endswith("_Setpoint"))
    cert = csum(lambda c: c.endswith("_Category_Score"))  # LEED/G-SEED 인증 데이터
    energy_model = buckets["Profile (에너지/ESG)"] - cert  # 나머지 = 에너지/GHG 모델

    confidence = len(list(g.triples((None, URIRef(bees + "hasConfidence"), None))))

    rel_counts = {
        name: len(list(g.triples((None, brick[name], None)))) for name, _ in REL_ROWS
    }
    rel_total = sum(rel_counts.values())
    rel_pct = rel_total / triples * 100 if triples else 0.0

    # SHACL: NodeShape 수 + Conforms
    sg = Graph()
    sg.parse(str(SHACL), format="turtle")
    shapes = len(set(sg.subjects(RDF.type, SH.NodeShape)))

    conforms = shacl_conforms()

    ttl_lines = sum(1 for _ in TTL.open(encoding="utf-8"))

    return {
        "triples": triples,
        "classes": classes,
        "props": props,
        "instances": instances,
        "buckets": buckets,
        "commands": commands,
        "setpoints": setpoints,
        "cert": cert,
        "energy_model": energy_model,
        "confidence": confidence,
        "rel_counts": rel_counts,
        "rel_total": rel_total,
        "rel_pct": rel_pct,
        "shapes": shapes,
        "conforms": conforms,
        "ttl_lines": ttl_lines,
    }


def shacl_conforms() -> bool:
    """pyshacl 로 SHACL 적합성 검증. pyshacl 미설치/실패 시 None."""
    try:
        out = subprocess.run(
            [sys.executable, "-m", "pyshacl", "-s", str(SHACL), "-d", str(TTL)],
            capture_output=True,
            text=True,
            timeout=300,
        )
        return "Conforms: True" in out.stdout
    except Exception:
        return None


def fmt(n: int) -> str:
    return f"{n:,}"


def build_overview(m: dict) -> str:
    shacl_label = f"SHACL 검증 ({m['shapes']} shapes)"
    if m["conforms"] is True:
        shacl_val = "✅ 통과 (Conforms: True)"
    elif m["conforms"] is False:
        shacl_val = "❌ 위반 (Conforms: False)"
    else:
        shacl_val = "⚠️ 미검증 (pyshacl 없음)"
    return "\n".join(
        [
            "| 항목 | 수치 |",
            "|------|:----:|",
            f"| **총 트리플 수** | **{fmt(m['triples'])}** |",
            f"| 커스텀 클래스 (`bees:`, owl:Class) | {m['classes']} |",
            f"| 커스텀 속성 (`bees:`, owl:DatatypeProperty) | {m['props']} |",
            f"| 고유 인스턴스 수 (rdf:type 기준) | {fmt(m['instances'])} |",
            f"| {shacl_label} | {shacl_val} |",
        ]
    )


def build_instances(m: dict) -> str:
    total = m["instances"]
    # 수치 내림차순, 동수는 BUCKETS 우선순위 순서로 안정 정렬(재실행 idempotent 보장)
    rows = sorted(
        m["buckets"].items(), key=lambda kv: (-kv[1], BUCKETS.index(kv[0]))
    )
    lines = ["| 대분류 | 인스턴스 수 | 비율 |", "|--------|:----------:|:----:|"]
    for name, n in rows:
        pct = n / total * 100 if total else 0.0
        lines.append(f"| {name} | {fmt(n)} | {pct:.1f}% |")
    lines.append(f"| **합계** | **{fmt(total)}** | **100%** |")
    return "\n".join(lines)


def build_relationships(m: dict) -> str:
    lines = ["| 관계 속성 | 트리플 수 | 설명 |", "|-----------|:---------:|------|"]
    for name, desc in REL_ROWS:
        lines.append(f"| brick:{name} | {fmt(m['rel_counts'][name])} | {desc} |")
    lines.append(
        f"| **합계** | **{fmt(m['rel_total'])}** | 전체 트리플의 {m['rel_pct']:.1f}% |"
    )
    return "\n".join(lines)


def replace_marker(text: str, key: str, body: str) -> tuple[str, bool]:
    """<!-- AUTOGEN:key START ... --> ... <!-- AUTOGEN:key END --> 사이를 body 로 교체."""
    pat = re.compile(
        r"(<!-- AUTOGEN:" + re.escape(key) + r" START[^>]*-->\n).*?(\n<!-- AUTOGEN:" + re.escape(key) + r" END -->)",
        re.DOTALL,
    )
    if not pat.search(text):
        raise SystemExit(f"[ERROR] AUTOGEN:{key} 마커를 문서에서 찾지 못함 — 마커를 먼저 삽입해야 함")
    new = pat.sub(lambda mo: mo.group(1) + body + mo.group(2), text)
    return new, (new != text)


def replace_row(text: str, label: str, value: str) -> tuple[str, bool]:
    """'| <label> | <숫자> |' 형태의 표 행에서 값 셀만 치환(라벨 앵커)."""
    pat = re.compile(r"(\|\s*" + re.escape(label) + r"\s*\|\s*)([^|]*?)(\s*\|)")
    if not pat.search(text):
        return text, False
    new = pat.sub(lambda mo: mo.group(1) + value + mo.group(3), text, count=1)
    return new, (new != text)


def apply(m: dict, text: str) -> tuple[str, list[str]]:
    changes = []
    text, ch = replace_marker(text, "overview", build_overview(m))
    if ch:
        changes.append("§1 전체 요약 표 (AUTOGEN:overview)")
    text, ch = replace_marker(text, "instances", build_instances(m))
    if ch:
        changes.append("§1 인스턴스 대분류 표 (AUTOGEN:instances)")
    text, ch = replace_marker(text, "relationships", build_relationships(m))
    if ch:
        changes.append("§7 관계 통계 표 (AUTOGEN:relationships)")

    # §11 주요 수치 표 — 파생 가능한 행만 라벨 앵커로 갱신.
    # 값은 전부 §1 대분류(m["buckets"])에서 파생시켜 §1↔§11 모순을 구조적으로 차단한다.
    b = m["buckets"]
    row_updates = {
        "총 트리플": fmt(m["triples"]),
        "총 인스턴스": fmt(m["instances"]),
        "커스텀 클래스": str(m["classes"]),
        "커스텀 속성": str(m["props"]),
        "Floor (층)": fmt(b["Floor"]),
        "HVAC Zone": fmt(b["HVAC Zone"]),
        "Room/Space": fmt(b["Room/Space"]),
        "**시스템**": f"**{fmt(b['System'])}**",
        "**장비 인스턴스**": f"**{fmt(b['Equipment/기타'])}**",
        "**센서**": f"**{fmt(b['Sensor'])}**",
        "**명령**": f"**{fmt(m['commands'])}**",
        "**설정값**": f"**{fmt(m['setpoints'])}**",
        "**상태/알람**": f"**{fmt(b['Status (상태점)'] + b['Alarm'])}**",
        "**인증 데이터**": f"**{fmt(m['cert'])}**",
        "**에너지 모델**": f"**{fmt(m['energy_model'])}**",
        "**관계 트리플**": f"**{fmt(m['rel_total'])}**",
        "**신뢰도 태깅**": f"**{fmt(m['confidence'])}**",
        "feeds 관계": fmt(m["rel_counts"]["feeds"]),
        "isPartOf 관계": fmt(m["rel_counts"]["isPartOf"]),
        "isPointOf 관계": fmt(m["rel_counts"]["isPointOf"]),
    }
    # ⚠ replace_row 는 count=1(첫 매치)이라 문서 전체에 걸면 §1 대분류 표의 동명 행
    #   ('HVAC Zone', 'Room/Space' 등)을 먼저 잡아 §11 이 영원히 갱신되지 않는다.
    #   → §11 헤딩 이후 구간으로 스코프를 좁혀서 치환한다.
    split = re.search(r"^## 11\.", text, re.MULTILINE)
    if not split:
        raise SystemExit("[ERROR] '## 11.' 섹션을 찾지 못함 — §11 파생행 갱신 불가")
    head, tail = text[: split.start()], text[split.start() :]
    for label, val in row_updates.items():
        tail, ch = replace_row(tail, label, val)
        if ch:
            changes.append(f"§11 행 '{label}' → {val}")
    text = head + tail

    # 헤더 TTL 라인 수: '(~14,556줄)' 형태
    new = re.sub(r"\(~[\d,]+줄\)", f"(~{fmt(m['ttl_lines'])}줄)", text)
    if new != text:
        changes.append(f"헤더 TTL 라인 수 → ~{fmt(m['ttl_lines'])}줄")
        text = new

    # 푸터 검증값: "print(f'트리플: {len(g)}')\" → 11,527"
    new = re.sub(r"(→\s*)[\d,]+(\s*$)", lambda mo: mo.group(1) + fmt(m["triples"]) + mo.group(2), text, flags=re.MULTILINE)
    if new != text:
        changes.append(f"푸터 검증값 → {fmt(m['triples'])}")
        text = new

    return text, changes


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="drift 검출만(비수정). stale 있으면 exit 1")
    args = ap.parse_args()

    m = measure()
    original = DOC.read_text(encoding="utf-8")
    updated, changes = apply(m, original)

    print("=== 실측 canonical 수치 ===")
    print(f"  트리플 {fmt(m['triples'])} | 클래스 {m['classes']} | 속성 {m['props']} | 인스턴스 {fmt(m['instances'])}")
    print(f"  SHACL {m['shapes']} shapes, Conforms={m['conforms']}")
    print(
        "  대분류: "
        + ", ".join(f"{k} {v}" for k, v in m["buckets"].items() if v)
        + f" | 합계 {fmt(sum(m['buckets'].values()))}"
    )
    print(f"  관계: " + ", ".join(f"{k} {v}" for k, v in m["rel_counts"].items()) + f" | 합계 {fmt(m['rel_total'])} ({m['rel_pct']:.1f}%)")

    if args.check:
        if updated != original:
            print("\n[CHECK] ❌ 문서가 실측값과 불일치(stale). 갱신 필요:")
            for c in changes:
                print(f"  - {c}")
            return 1
        print("\n[CHECK] ✅ 문서가 실측값과 일치 — drift 없음")
        return 0

    if updated == original:
        print("\n변경 없음 — 이미 최신 상태")
        return 0
    DOC.write_text(updated, encoding="utf-8")
    print(f"\n✅ {DOC.name} 갱신 완료 — 변경 {len(changes)}건:")
    for c in changes:
        print(f"  - {c}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
