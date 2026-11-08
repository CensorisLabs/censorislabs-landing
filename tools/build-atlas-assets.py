"""Create the compact, attributed atlas layers used by the Living Atlas page.

Inputs include Natural Earth, Seshat Cliopatria, the Historical Conflict Event
Dataset, and UCDP GED/PRIO. The generated public assets are compact GeoJSON.
"""

from __future__ import annotations

import gzip
import ast
import csv
import json
import re
from pathlib import Path

import shapefile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".work" / "atlas-data"
OUTPUT = ROOT / "public" / "atlas"
HISTORY_INPUT = SOURCE / "cliopatria" / "cliopatria_polities_only_v021.geojson"
COUNTRY_INPUT = SOURCE / "ne-countries" / "ne_10m_admin_0_countries.shp"
HCED_INPUT = SOURCE / "HCED-Data-v3.csv"
UCDP_PRIO_INPUT = SOURCE / "ucdp" / "UcdpPrioConflict_v26_1.csv"
UCDP_GED_INPUT = SOURCE / "ucdp" / "ged261" / "GEDEvent_v26_1.csv"
HISTORY_TOLERANCE = 0.07


def point_segment_distance_sq(point, start, end):
    px, py = point
    sx, sy = start
    ex, ey = end
    dx, dy = ex - sx, ey - sy
    if dx == 0 and dy == 0:
        return (px - sx) ** 2 + (py - sy) ** 2
    t = max(0.0, min(1.0, ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)))
    return (px - (sx + t * dx)) ** 2 + (py - (sy + t * dy)) ** 2


def simplify_open(points, tolerance_sq):
    if len(points) <= 2:
        return points
    keep = bytearray(len(points))
    keep[0] = keep[-1] = 1
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        farthest = -1
        max_distance = tolerance_sq
        for index in range(first + 1, last):
            distance = point_segment_distance_sq(points[index], points[first], points[last])
            if distance > max_distance:
                max_distance, farthest = distance, index
        if farthest >= 0:
            keep[farthest] = 1
            stack.append((first, farthest))
            stack.append((farthest, last))
    return [point for point, retained in zip(points, keep) if retained]


def simplify_ring(ring):
    if len(ring) < 5:
        return ring
    points = [tuple(point[:2]) for point in ring[:-1]]
    if len(points) < 4:
        return ring
    # Split the loop at its point farthest from the first vertex, then simplify
    # both arcs so closed rings retain their overall shape.
    anchor = points[0]
    opposite_index = max(range(2, len(points) - 1), key=lambda i: (points[i][0] - anchor[0]) ** 2 + (points[i][1] - anchor[1]) ** 2)
    arc_a = simplify_open(points[: opposite_index + 1], HISTORY_TOLERANCE**2)
    arc_b = simplify_open(points[opposite_index:] + [points[0]], HISTORY_TOLERANCE**2)
    result = arc_a[:-1] + arc_b[:-1]
    if len(result) < 3:
        result = points
    result = [[round(x, 4), round(y, 4)] for x, y in result]
    result.append(result[0])
    return result


def simplify_geometry(geometry):
    coordinates = geometry["coordinates"]
    polygons = [coordinates] if geometry["type"] == "Polygon" else coordinates
    simplified = []
    for polygon in polygons:
        rings = [simplify_ring(ring) for ring in polygon]
        if rings and len(rings[0]) >= 4:
            simplified.append(rings)
    if geometry["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": simplified[0] if simplified else []}
    return {"type": "MultiPolygon", "coordinates": simplified}


def write_gzip_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0, compresslevel=9) as compressed:
            for chunk in json.JSONEncoder(separators=(",", ":"), ensure_ascii=False).iterencode(value):
                compressed.write(chunk.encode("utf-8"))


def build_history():
    with HISTORY_INPUT.open("r", encoding="utf-8") as handle:
        source = json.load(handle)
    features = []
    original_vertices = 0
    compact_vertices = 0

    def count_vertices(geometry):
        coords = geometry["coordinates"]
        polygons = [coords] if geometry["type"] == "Polygon" else coords
        return sum(len(ring) for polygon in polygons for ring in polygon)

    for feature in source["features"]:
        props = feature["properties"]
        geometry = feature["geometry"]
        original_vertices += count_vertices(geometry)
        clean_geometry = simplify_geometry(geometry)
        compact_vertices += count_vertices(clean_geometry)
        features.append({
            "type": "Feature",
            "properties": {
                "name": props.get("Name", ""),
                "from": props.get("FromYear"),
                "to": props.get("ToYear"),
                "area": props.get("Area", 0),
                "wiki": props.get("Wikipedia", ""),
                "wikidata": props.get("Wikidata", ""),
                "memberOf": props.get("MemberOf", ""),
            },
            "geometry": clean_geometry,
        })
    output = OUTPUT / "history-0.2.1.geojson.gz"
    write_gzip_json(output, {"type": "FeatureCollection", "features": features})
    return len(features), original_vertices, compact_vertices, output.stat().st_size


def build_countries():
    reader = shapefile.Reader(str(COUNTRY_INPUT), encoding="utf-8")
    fields = [field[0] for field in reader.fields[1:]]
    index = {name: fields.index(name) for name in ["ADMIN", "SOVEREIGNT", "ISO_A3", "FORMAL_EN"]}
    features = []
    for item in reader.iterShapeRecords():
        record = item.record
        if item.shape.shapeType == shapefile.NULL:
            continue
        geometry = item.shape.__geo_interface__
        features.append({
            "type": "Feature",
            "properties": {
                "name": record[index["ADMIN"]],
                "sovereign": record[index["SOVEREIGNT"]],
                "iso": record[index["ISO_A3"]],
                "formal": record[index["FORMAL_EN"]],
            },
            "geometry": geometry,
        })
    output = OUTPUT / "countries-10m.geojson.gz"
    write_gzip_json(output, {"type": "FeatureCollection", "features": features})
    return len(features), output.stat().st_size


def parse_list(value):
    value = (value or "").strip()
    if not value:
        return []
    try:
        parsed = ast.literal_eval(value)
        values = parsed if isinstance(parsed, (list, tuple)) else [parsed]
    except (SyntaxError, ValueError):
        values = [value]
    result = []
    for item in values:
        text = str(item).strip()
        if text and text.casefold() not in {"nan", "none", "unknown"} and text not in result:
            result.append(text)
    return result


def parse_year_range(value):
    value = (value or "").strip()
    if re.fullmatch(r"-?\d+", value):
        year = int(value)
        return year, year
    match = re.fullmatch(r"(-?\d+)\s*(?:-|–|—|to)\s*(-?\d+)", value, flags=re.IGNORECASE)
    if not match:
        return None
    start, end = int(match.group(1)), int(match.group(2))
    return min(start, end), max(start, end)


def build_hced_wars():
    features = []
    skipped = 0
    with HCED_INPUT.open("r", encoding="cp1252", newline="") as handle:
        for index, row in enumerate(csv.DictReader(handle)):
            if not (row.get("Battle") or "").strip():
                continue
            dates = parse_year_range(row.get("Year"))
            try:
                latitude = float(row.get("Latitude", ""))
                longitude = float(row.get("Longitude", ""))
            except (TypeError, ValueError):
                skipped += 1
                continue
            if not dates or not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                skipped += 1
                continue
            if dates[0] > 1988:
                continue
            dates = (dates[0], min(dates[1], 1988))

            participants = parse_list(row.get("Participants"))
            participant_a = (row.get("Participant 1") or "").strip()
            participant_b = (row.get("Participant 2") or "").strip()
            if not participant_a and participants:
                participant_a = participants[0]
            if not participant_b and len(participants) > 1:
                participant_b = participants[1]
            features.append({
                "type": "Feature",
                "properties": {
                    "id": f"hced-{(row.get('ID') or index).strip()}",
                    "source": "Historical Conflict Event Dataset v3",
                    "year": dates[0],
                    "yearEnd": dates[1],
                    "title": (row.get("Battle") or "").strip(),
                    "war": " · ".join(parse_list(row.get("War"))),
                    "place": (row.get("Country") or "").strip(),
                    "country": (row.get("Country") or "").strip(),
                    "sideA": participant_a,
                    "sideB": participant_b,
                    "participants": participants,
                    "winner": (row.get("Winner") or "").strip(),
                    "loser": (row.get("Loser") or "").strip(),
                    "theatre": (row.get("Theatre") or "").strip(),
                    "lat": latitude,
                    "lon": longitude,
                },
                "geometry": {"type": "Point", "coordinates": [longitude, latitude]},
            })
    output = OUTPUT / "wars-hced-v3.geojson.gz"
    write_gzip_json(output, {"type": "FeatureCollection", "features": features})
    return len(features), skipped, output.stat().st_size


def build_ucdp_wars():
    war_years = set()
    with UCDP_PRIO_INPUT.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                year = int(row["year"])
            except (KeyError, TypeError, ValueError):
                continue
            # UCDP defines intensity level 2 as at least 1,000 battle-related
            # deaths in a year. Keep the site's requested endpoint at 2022.
            if row.get("intensity_level") == "2" and 1989 <= year <= 2022:
                war_years.add((row.get("conflict_id", ""), year))

    grouped = {}
    with UCDP_GED_INPUT.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                year = int(row.get("year", ""))
                latitude = float(row.get("latitude", ""))
                longitude = float(row.get("longitude", ""))
            except (TypeError, ValueError):
                continue
            conflict_id = row.get("conflict_new_id", "")
            if not (1989 <= year <= 2022 and (conflict_id, year) in war_years):
                continue
            # Join only state-based, high-intensity war years. That way the
            # fine-grained locations belong to a year classified as a war.
            if row.get("type_of_violence") != "1" or row.get("active_year", "").casefold() != "true":
                continue
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                continue

            place = (row.get("where_coordinates") or row.get("where_description") or row.get("country") or "").strip()
            dyad_id = row.get("dyad_new_id", "")
            key = (conflict_id, dyad_id, place, round(latitude, 4), round(longitude, 4))
            item = grouped.get(key)
            if item is None:
                item = {
                    "id": f"ucdp-{conflict_id}-{dyad_id}-{len(grouped)}",
                    "source": "UCDP Georeferenced Event Dataset v26.1",
                    "title": (row.get("conflict_name") or "Armed conflict").strip(),
                    "war": (row.get("conflict_name") or "Armed conflict").strip(),
                    "place": place,
                    "country": (row.get("country") or "").strip(),
                    "sideA": (row.get("side_a") or "").strip(),
                    "sideB": (row.get("side_b") or "").strip(),
                    "lat": latitude,
                    "lon": longitude,
                    "activity": {},
                }
                grouped[key] = item
            activity = item["activity"].setdefault(year, [0, 0])
            activity[0] += 1
            try:
                activity[1] += int(float(row.get("best") or 0))
            except ValueError:
                pass

    features = []
    for item in grouped.values():
        activity = sorted((year, stats[0], stats[1]) for year, stats in item.pop("activity").items())
        if not activity:
            continue
        item["year"] = activity[0][0]
        item["yearEnd"] = activity[-1][0]
        item["years"] = [entry[0] for entry in activity]
        item["activity"] = activity
        item["eventCount"] = sum(entry[1] for entry in activity)
        item["fatalities"] = sum(entry[2] for entry in activity)
        features.append({
            "type": "Feature",
            "properties": item,
            "geometry": {"type": "Point", "coordinates": [item["lon"], item["lat"]]},
        })

    output = OUTPUT / "wars-ucdp-26.1.geojson.gz"
    write_gzip_json(output, {"type": "FeatureCollection", "features": features})
    return len(features), sum(item["properties"]["eventCount"] for item in features), output.stat().st_size


if __name__ == "__main__":
    required = [HISTORY_INPUT, COUNTRY_INPUT, HCED_INPUT, UCDP_PRIO_INPUT, UCDP_GED_INPUT]
    if any(not path.exists() for path in required):
        raise SystemExit("Atlas source archives are missing under .work/atlas-data")
    history = build_history()
    countries = build_countries()
    hced = build_hced_wars()
    ucdp = build_ucdp_wars()
    print(f"History: {history[0]} records, {history[1]:,} -> {history[2]:,} vertices, {history[3]:,} bytes")
    print(f"Countries: {countries[0]} polygons, {countries[1]:,} bytes")
    print(f"Historical battles: {hced[0]:,} mapped, {hced[1]:,} skipped, {hced[2]:,} bytes")
    print(f"UCDP high-intensity war locations: {ucdp[0]:,} locations, {ucdp[1]:,} events, {ucdp[2]:,} bytes")
