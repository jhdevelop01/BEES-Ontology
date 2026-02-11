"""BEES Ontology — Neo4j 임포트 검증 스크립트

TTL(rdflib) vs Neo4j 노드/관계 수를 비교하여 임포트 정합성을 확인한다.

사용법:
    python3 scripts/verify_neo4j.py
"""

from rdflib import Graph, Namespace
from neo4j import GraphDatabase

# === 설정 ===
TTL_PATH = "ontology/GEC_B_Ontology.ttl"
NEO4J_URI = "bolt://localhost:7689"
NEO4J_USER = "neo4j"
NEO4J_PASS = "bees2024"

BRICK = Namespace("https://brickschema.org/schema/Brick#")

EXPECTED_RELS = {
    "feeds": ("feeds", BRICK["feeds"]),
    "isFedBy": ("isFedBy", BRICK["isFedBy"]),
    "hasPart": ("hasPart", BRICK["hasPart"]),
    "isPartOf": ("isPartOf", BRICK["isPartOf"]),
    "hasLocation": ("hasLocation", BRICK["hasLocation"]),
    "isPointOf": ("isPointOf", BRICK["isPointOf"]),
}


def count_ttl():
    """rdflib로 TTL 통계 추출"""
    g = Graph()
    g.parse(TTL_PATH, format="turtle")

    result = {"triples": len(g), "rels": {}}
    for name, (_, prop) in EXPECTED_RELS.items():
        result["rels"][name] = len(list(g.triples((None, prop, None))))
    return result


def count_neo4j():
    """Neo4j에서 노드/관계 수 추출"""
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASS))
    result = {"nodes": 0, "rels": {}}

    with driver.session() as session:
        result["nodes"] = session.run("MATCH (n) RETURN count(n) AS c").single()["c"]

        for name, (neo4j_type, _) in EXPECTED_RELS.items():
            count = session.run(
                f"MATCH ()-[r:{neo4j_type}]->() RETURN count(r) AS c"
            ).single()["c"]
            result["rels"][name] = count

        # 한글 라벨 수
        result["korean_labels"] = session.run(
            "MATCH (n) WHERE n.label IS NOT NULL RETURN count(n) AS c"
        ).single()["c"]

    driver.close()
    return result


def main():
    print("=" * 60)
    print("BEES Ontology — TTL vs Neo4j 검증")
    print("=" * 60)

    ttl = count_ttl()
    neo = count_neo4j()

    print(f"\n{'항목':<20} {'TTL':>10} {'Neo4j':>10} {'일치':>6}")
    print("-" * 50)
    print(f"{'트리플/노드':<20} {ttl['triples']:>10} {neo['nodes']:>10}")
    print()

    all_match = True
    for name in EXPECTED_RELS:
        t = ttl["rels"][name]
        n = neo["rels"][name]
        match = "✓" if t == n else "✗"
        if t != n:
            all_match = False
        print(f"{name:<20} {t:>10} {n:>10} {match:>6}")

    print(f"\n{'한글 라벨 노드':<20} {'':>10} {neo['korean_labels']:>10}")
    print()

    if all_match:
        print("결과: 모든 관계 수 일치 — 임포트 정상")
    else:
        print("결과: 불일치 발견 — 확인 필요")


if __name__ == "__main__":
    main()
