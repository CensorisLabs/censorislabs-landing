"""Build the close-zoom place-label assets used by the Living Atlas.

City labels come from the GeoNames cities15000 gazetteer (CC BY 4.0).
Landmark labels come from Wikidata items that are UNESCO World Heritage
Sites or classified as architectural landmarks (CC0). Both source extracts
are kept outside the published site; this script writes only compact,
attributed JSON assets under public/atlas.
"""

from __future__ import annotations

import gzip
import json
import re
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".work" / "geonames"
OUTPUT = ROOT / "public" / "atlas"
CITY_INPUT = SOURCE / "cities15000.zip"
LANDMARK_INPUT = SOURCE / "landmarks-raw.json"

# Only keep places that read as landmarks, rather than settlements, parks,
# lakes, mountains, or other natural features that share the UNESCO list.
KIND_BY_TYPE = [
    ("Q839954", "Archaeological site"),
    ("Q15661340", "Ancient city"),
    ("Q109607", "Ruins"),
    ("Q93342462", "Archaeological site"),
    ("Q21752084", "Archaeological site"),
    ("Q1081138", "Historic site"),
    ("Q4443227", "Archaeological site"),
    ("Q12137573", "Archaeological site"),
    ("Q11269813", "Archaeological site"),
    ("Q125857545", "Archaeological site"),
    ("Q3363945", "Archaeological park"),
    ("Q7251867", "Ancient city"),
    ("Q2202509", "Ancient city"),
    ("Q655593", "Ancient site"),
    ("Q69391739", "Ancient site"),
    ("Q15243209", "Historic quarter"),
    ("Q1497375", "Heritage ensemble"),
    ("Q33506", "Museum"),
    ("Q207694", "Museum"),
    ("Q16735822", "Museum"),
    ("Q115154402", "Museum"),
    ("Q3867560", "Museum"),
    ("Q112132527", "Museum"),
    ("Q112132534", "Museum"),
    ("Q124830411", "Museum"),
    ("Q2087181", "Historic house"),
    ("Q162875", "Mausoleum"),
    ("Q381885", "Tomb"),
    ("Q179700", "Statue"),
    ("Q4989906", "Monument"),
    ("Q5003624", "Memorial"),
    ("Q12516", "Pyramid"),
    ("Q174782", "Square"),
    ("Q26987258", "Square"),
    ("Q2319498", "Landmark"),
    ("Q2065736", "Heritage site"),
    ("Q210272", "Heritage site"),
    ("Q358", "Heritage site"),
    ("Q96211395", "Heritage site"),
    ("Q2434238", "Heritage site"),
    ("Q38048707", "Heritage site"),
    ("Q35112127", "Historic building"),
    ("Q1497364", "Historic complex"),
    ("Q41176", "Historic building"),
    ("Q811165", "Heritage monument"),
    ("Q16560", "Palace"),
    ("Q53536964", "Palace"),
    ("Q751876", "Château"),
    ("Q23413", "Castle"),
    ("Q92026", "Castle"),
    ("Q57831", "Fortress"),
    ("Q1785071", "Fortress"),
    ("Q88291", "Citadel"),
    ("Q677678", "Fortified town"),
    ("Q20097897", "Sea fort"),
    ("Q29968665", "Fortress island"),
    ("Q81917", "Fortified tower"),
    ("Q57346", "Defensive wall"),
    ("Q39715", "Lighthouse"),
    ("Q3378136", "Lighthouse"),
    ("Q32815", "Mosque"),
    ("Q1454820", "Mosque"),
    ("Q4588528", "Sacred place"),
    ("Q44539", "Temple"),
    ("Q842402", "Temple"),
    ("Q5393308", "Temple"),
    ("Q845945", "Shrine"),
    ("Q2736554", "Temple"),
    ("Q13016741", "Temple"),
    ("Q1922704", "Temple"),
    ("Q16970", "Church"),
    ("Q120560", "Basilica"),
    ("Q163687", "Basilica"),
    ("Q56242215", "Cathedral"),
    ("Q56242225", "Cathedral"),
    ("Q678552", "Cathedral"),
    ("Q334383", "Abbey"),
    ("Q44613", "Monastery"),
    ("Q160742", "Abbey"),
    ("Q19323827", "Monastery"),
    ("Q844619", "Monastery"),
    ("Q29553", "Sanctuary"),
    ("Q15135589", "Pilgrimage site"),
    ("Q1107656", "Garden"),
    ("Q167346", "Garden"),
    ("Q1343246", "Historic house"),
    ("Q918230", "Roman villa"),
    ("Q153562", "Opera house"),
    ("Q158438", "Bridge"),
    ("Q1223230", "Bridge"),
    ("Q3397526", "Bridge"),
    ("Q158218", "Bridge"),
    ("Q1210334", "Bridge"),
    ("Q1429218", "Bridge"),
    ("Q12042110", "Bridge"),
    ("Q13218676", "Aqueduct"),
    ("Q14752696", "Roman structure"),
    ("Q146924", "Roman limes"),
    ("Q12493", "Dome"),
    ("Q48356", "Minaret"),
    ("Q631305", "Rock formation"),
    ("Q45791", "Geoglyph"),
    ("Q1131329", "Grotto"),
    ("Q1149405", "Rock shelter"),
]
KINDS = {type_id: kind for type_id, kind in KIND_BY_TYPE}
NATURAL_TYPES = {
    "Q8502",       # mountain
    "Q46831",      # mountain range
    "Q23397",      # lake
    "Q4022",       # river
    "Q34038",      # waterfall
    "Q23442",      # island
    "Q33837",      # archipelago
    "Q11292",      # reef
    "Q35509",      # cave
    "Q473972",     # protected area
    "Q46169",      # national park
    "Q158454",     # biosphere reserve
    "Q39816",      # valley
    "Q4421",       # forest
    "Q179049",     # nature reserve
    "Q631305",     # rock formation
}
KIND_ORDER = [
    "Q162875", "Q381885", "Q179700", "Q4989906", "Q5003624", "Q12516",
    "Q16560", "Q53536964", "Q751876", "Q23413", "Q92026", "Q57831",
    "Q1785071", "Q88291", "Q677678", "Q20097897", "Q29968665", "Q81917",
    "Q32815", "Q1454820", "Q44539", "Q842402", "Q5393308", "Q845945",
    "Q2736554", "Q13016741", "Q1922704", "Q16970", "Q120560", "Q163687",
    "Q56242215", "Q56242225", "Q678552", "Q334383", "Q44613", "Q160742",
    "Q19323827", "Q844619", "Q29553", "Q15135589", "Q153562", "Q39715",
    "Q3378136", "Q158438", "Q1223230", "Q3397526", "Q158218", "Q1210334",
    "Q1429218", "Q12042110", "Q13218676", "Q14752696", "Q146924",
    "Q33506", "Q207694", "Q16735822", "Q115154402", "Q3867560",
    "Q112132527", "Q112132534", "Q124830411", "Q2087181", "Q918230",
    "Q1343246", "Q1107656", "Q167346", "Q35112127", "Q1497364", "Q41176",
    "Q811165", "Q15243209", "Q1081138", "Q2319498", "Q839954",
    "Q15661340", "Q109607", "Q93342462", "Q21752084", "Q4443227",
    "Q12137573", "Q11269813", "Q125857545", "Q3363945", "Q7251867",
    "Q2202509", "Q655593", "Q69391739", "Q1497375", "Q2065736",
    "Q210272", "Q358", "Q96211395", "Q2434238", "Q38048707", "Q174782",
    "Q26987258", "Q12493", "Q48356", "Q45791", "Q1131329", "Q1149405",
]


def write_gzip_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0, compresslevel=9) as compressed:
            for chunk in json.JSONEncoder(separators=(",", ":"), ensure_ascii=False).iterencode(value):
                compressed.write(chunk.encode("utf-8"))


def build_cities() -> tuple[int, int, set[str]]:
    cities = []
    with zipfile.ZipFile(CITY_INPUT) as archive:
        with archive.open("cities15000.txt") as handle:
            for raw in handle:
                fields = raw.decode("utf-8").rstrip("\n").split("\t")
                if len(fields) < 19:
                    continue
                try:
                    population = int(fields[14] or 0)
                    latitude = float(fields[4])
                    longitude = float(fields[5])
                except ValueError:
                    continue
                # Cities15000 is already a compact gazetteer. Keeping larger
                # towns plus every capital gives close views useful labels
                # without loading every village on Earth.
                if population < 50_000 and fields[7] != "PPLC":
                    continue
                cities.append({
                    "name": fields[1],
                    "lat": round(latitude, 5),
                    "lon": round(longitude, 5),
                    "population": population,
                    "country": fields[8],
                    "geonameid": int(fields[0]),
                })
    cities.sort(key=lambda item: (-item["population"], item["name"]))
    output = OUTPUT / "gazetteer-cities.json.gz"
    write_gzip_json(output, {"cities": cities})
    return len(cities), output.stat().st_size, {city["name"].casefold() for city in cities}


def parse_point(value: str) -> tuple[float, float] | None:
    match = re.fullmatch(r"Point\(([-0-9.]+) ([-0-9.]+)\)", value)
    if not match:
        return None
    longitude, latitude = float(match.group(1)), float(match.group(2))
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    return latitude, longitude


def build_landmarks(city_names: set[str]) -> tuple[int, int]:
    payload = json.loads(LANDMARK_INPUT.read_text(encoding="utf-8"))
    by_item = {}
    for binding in payload["results"]["bindings"]:
        item = binding["item"]["value"].rsplit("/", 1)[-1]
        if item in by_item:
            continue
        coordinate = parse_point(binding["coord"]["value"])
        if coordinate is None:
            continue
        types = {value.rsplit("/", 1)[-1] for value in binding["types"]["value"].split("|")}
        if types & NATURAL_TYPES:
            continue
        kind = next((KINDS[value] for value in KIND_ORDER if value in types), None)
        if kind is None:
            continue
        name = binding.get("itemLabel", {}).get("value", "").strip()
        if not name or len(name) > 64 or name.casefold() in city_names:
            continue
        by_item[item] = {
            "name": name,
            "lat": round(coordinate[0], 5),
            "lon": round(coordinate[1], 5),
            "kind": kind,
            "wikidata": item,
            "sitelinks": int(binding.get("sitelinks", {}).get("value", 0)),
        }
    # A place can have several coordinates in Wikidata. Keep one point per
    # item, then one label per name so close views do not repeat a name.
    landmarks = sorted(by_item.values(), key=lambda item: (-item["sitelinks"], item["name"]))
    seen_names = set()
    unique = []
    for landmark in landmarks:
        key = landmark["name"].casefold()
        if key in seen_names:
            continue
        seen_names.add(key)
        unique.append(landmark)
    unique.sort(key=lambda item: (-item["sitelinks"], item["name"]))
    output = OUTPUT / "gazetteer-landmarks.json.gz"
    write_gzip_json(output, {"landmarks": unique})
    return len(unique), output.stat().st_size


if __name__ == "__main__":
    if not CITY_INPUT.exists() or not LANDMARK_INPUT.exists():
        raise SystemExit("GeoNames cities15000.zip and Wikidata landmarks-raw.json are required under .work/geonames")
    cities = build_cities()
    landmarks = build_landmarks(cities[2])
    print(f"Cities: {cities[0]:,} labels, {cities[1]:,} bytes")
    print(f"Landmarks: {landmarks[0]:,} labels, {landmarks[1]:,} bytes")
