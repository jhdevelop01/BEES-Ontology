#!/usr/bin/env python3
"""
BEES 온톨로지 품질 검사 스크립트.

rdflib로 TTL을 로드하여 다음 항목을 점검한다:
  1. rdfs:label 없는 인스턴스
  2. hasLocation 없는 Equipment
  3. isPointOf 없는 Point
  4. hasPart ↔ isPartOf 비대칭
  5. feeds ↔ isFedBy 비대칭

결과: 콘솔 출력 + JSON 파일 저장
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

from rdflib import Graph, Namespace, RDF, RDFS

# ── 네임스페이스 ──────────────────────────────────────────────────────
BRICK = Namespace("https://brickschema.org/schema/Brick#")
BLDG = Namespace("https://example.org/gec-b#")

# Brick 관계 URI
HAS_LOCATION = BRICK["hasLocation"]
IS_PART_OF = BRICK["isPartOf"]
HAS_PART = BRICK["hasPart"]
IS_POINT_OF = BRICK["isPointOf"]
FEEDS = BRICK["feeds"]
IS_FED_BY = BRICK["isFedBy"]

# Equipment 상위 클래스
EQUIPMENT_CLASSES = {
    BRICK["Equipment"],
    BRICK["HVAC_Equipment"],
    BRICK["AHU"],
    BRICK["Fan_Coil_Unit"],
    BRICK["Chiller"],
    BRICK["Boiler"],
    BRICK["Cooling_Tower"],
    BRICK["Pump"],
    BRICK["Fan"],
    BRICK["Exhaust_Fan"],
    BRICK["Supply_Fan"],
    BRICK["Chilled_Water_Pump"],
    BRICK["Condenser_Water_Pump"],
    BRICK["Hot_Water_Pump"],
    BRICK["Damper"],
    BRICK["Valve"],
    BRICK["Heat_Exchanger"],
    BRICK["Lighting_Equipment"],
    BRICK["Meter"],
    BRICK["Elevator"],
}

# Point 상위 클래스
POINT_CLASSES = {
    BRICK["Point"],
    BRICK["Sensor"],
    BRICK["Command"],
    BRICK["Setpoint"],
    BRICK["Status"],
    BRICK["Alarm"],
    BRICK["Temperature_Sensor"],
    BRICK["Humidity_Sensor"],
    BRICK["Pressure_Sensor"],
    BRICK["Flow_Sensor"],
    BRICK["CO2_Sensor"],
    BRICK["Power_Sensor"],
    BRICK["Current_Sensor"],
}


def short_name(uri):
    """URI를 짧은 이름으로 변환."""
    s = str(uri)
    if "#" in s:
        return "bldg:" + s.rsplit("#", 1)[1]
    return s


def check_quality(ttl_path: str) -> dict:
    """온톨로지 품질 검사 실행."""
    g = Graph()
    g.parse(ttl_path, format="turtle")
    print(f"\n=== BEES 온톨로지 품질 검사 ===")
    print(f"파일: {ttl_path}")
    print(f"트리플 수: {len(g)}")
    print()

    results = {
        "file": ttl_path,
        "triple_count": len(g),
        "issues": {},
    }

    # ── 1. rdfs:label 없는 bldg: 인스턴스 ──
    bldg_instances = set()
    for s in g.subjects():
        if str(s).startswith(str(BLDG)):
            bldg_instances.add(s)

    no_label = []
    for inst in bldg_instances:
        labels = list(g.objects(inst, RDFS.label))
        if not labels:
            no_label.append(short_name(inst))

    results["issues"]["no_rdfs_label"] = sorted(no_label)
    print(f"1. rdfs:label 없는 인스턴스: {len(no_label)}개")
    if no_label:
        for name in sorted(no_label)[:10]:
            print(f"   - {name}")
        if len(no_label) > 10:
            print(f"   ... 외 {len(no_label) - 10}개")
    print()

    # ── 2. hasLocation 없는 Equipment ──
    equipment_set = set()
    for eq_class in EQUIPMENT_CLASSES:
        for inst in g.subjects(RDF.type, eq_class):
            if str(inst).startswith(str(BLDG)):
                equipment_set.add(inst)

    no_location = []
    for eq in equipment_set:
        locations = list(g.objects(eq, HAS_LOCATION))
        if not locations:
            no_location.append(short_name(eq))

    results["issues"]["equipment_no_location"] = sorted(no_location)
    print(f"2. hasLocation 없는 Equipment: {len(no_location)}개 / 전체 {len(equipment_set)}개")
    if no_location:
        for name in sorted(no_location)[:10]:
            print(f"   - {name}")
        if len(no_location) > 10:
            print(f"   ... 외 {len(no_location) - 10}개")
    print()

    # ── 3. isPointOf 없는 Point ──
    point_set = set()
    for pt_class in POINT_CLASSES:
        for inst in g.subjects(RDF.type, pt_class):
            if str(inst).startswith(str(BLDG)):
                point_set.add(inst)

    no_point_of = []
    for pt in point_set:
        owners = list(g.objects(pt, IS_POINT_OF))
        if not owners:
            no_point_of.append(short_name(pt))

    results["issues"]["point_no_isPointOf"] = sorted(no_point_of)
    print(f"3. isPointOf 없는 Point: {len(no_point_of)}개 / 전체 {len(point_set)}개")
    if no_point_of:
        for name in sorted(no_point_of)[:10]:
            print(f"   - {name}")
        if len(no_point_of) > 10:
            print(f"   ... 외 {len(no_point_of) - 10}개")
    print()

    # ── 4. hasPart ↔ isPartOf 비대칭 ──
    has_part_pairs = set()
    is_part_of_pairs = set()

    for s, o in g.subject_objects(HAS_PART):
        has_part_pairs.add((str(s), str(o)))
    for s, o in g.subject_objects(IS_PART_OF):
        is_part_of_pairs.add((str(o), str(s)))  # 역방향으로 변환

    missing_is_part_of = has_part_pairs - is_part_of_pairs
    missing_has_part = is_part_of_pairs - has_part_pairs

    asymmetric_part = []
    for parent, child in missing_is_part_of:
        asymmetric_part.append(f"{short_name(parent)} hasPart {short_name(child)} (isPartOf 없음)")
    for parent, child in missing_has_part:
        asymmetric_part.append(f"{short_name(child)} isPartOf {short_name(parent)} (hasPart 없음)")

    results["issues"]["hasPart_isPartOf_asymmetry"] = asymmetric_part
    print(f"4. hasPart ↔ isPartOf 비대칭: {len(asymmetric_part)}건")
    if asymmetric_part:
        for item in asymmetric_part[:10]:
            print(f"   - {item}")
        if len(asymmetric_part) > 10:
            print(f"   ... 외 {len(asymmetric_part) - 10}개")
    print()

    # ── 5. feeds ↔ isFedBy 비대칭 ──
    feeds_pairs = set()
    is_fed_by_pairs = set()

    for s, o in g.subject_objects(FEEDS):
        feeds_pairs.add((str(s), str(o)))
    for s, o in g.subject_objects(IS_FED_BY):
        is_fed_by_pairs.add((str(o), str(s)))  # 역방향

    missing_is_fed_by = feeds_pairs - is_fed_by_pairs
    missing_feeds = is_fed_by_pairs - feeds_pairs

    asymmetric_feed = []
    for src, dst in missing_is_fed_by:
        asymmetric_feed.append(f"{short_name(src)} feeds {short_name(dst)} (isFedBy 없음)")
    for src, dst in missing_feeds:
        asymmetric_feed.append(f"{short_name(dst)} isFedBy {short_name(src)} (feeds 없음)")

    results["issues"]["feeds_isFedBy_asymmetry"] = asymmetric_feed
    print(f"5. feeds ↔ isFedBy 비대칭: {len(asymmetric_feed)}건")
    if asymmetric_feed:
        for item in asymmetric_feed[:10]:
            print(f"   - {item}")
        if len(asymmetric_feed) > 10:
            print(f"   ... 외 {len(asymmetric_feed) - 10}개")
    print()

    # ── 요약 ──
    total_issues = sum(
        len(v) if isinstance(v, list) else 0
        for v in results["issues"].values()
    )
    results["total_issues"] = total_issues

    print("=" * 50)
    print(f"총 이슈: {total_issues}건")
    if total_issues == 0:
        print("온톨로지 품질 검사 통과!")
    else:
        print("위 이슈를 확인하고 수정을 권장합니다.")
    print()

    return results


def main():
    ttl_path = "ontology/GEC_B_Ontology.ttl"
    if len(sys.argv) > 1:
        ttl_path = sys.argv[1]

    if not Path(ttl_path).exists():
        print(f"ERROR: 파일 없음: {ttl_path}")
        sys.exit(1)

    results = check_quality(ttl_path)

    # JSON 저장
    output_path = "scripts/quality_check_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"결과 저장: {output_path}")


if __name__ == "__main__":
    main()
