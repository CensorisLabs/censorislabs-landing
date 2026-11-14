# Living Atlas data and attribution

## Present-day country outlines

`countries-10m.geojson.gz` is derived from the Natural Earth 1:10m Admin 0 countries dataset. Natural Earth makes its map data public domain and permits use in projects of any type.

- Source and downloads: <https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/>
- General data terms: <https://www.naturalearthdata.com/about/terms-of-use/>
- Changes: converted from the Natural Earth shapefile to compact GeoJSON with country name, sovereign, ISO code, and formal name properties.

## Historical political outlines

`history-0.2.1.geojson.gz` is derived from Cliopatria v0.2.1, part of the Seshat Global History Databank. The source dataset records more than 1,600 political entities from 3400 BCE to 2024 CE. The atlas displays one selected snapshot per century from 3000 BCE to 2022 CE.

Suggested attribution: **Cliopatria, Seshat Global History Databank, v0.2.1**. The dataset is licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

- Project and data description: <https://github.com/Seshat-Global-History-Databank/cliopatria>
- License: <https://github.com/Seshat-Global-History-Databank/cliopatria/blob/main/LICENSE.md>
- Changes: simplified polygon coordinates at a 0.07-degree tolerance and retained polity name, date range, area, Wikipedia/Wikidata references, and membership properties.

Historical polygon coverage and dates vary across regions. These are scholarly reconstructions, not survey-accurate borders. Cliopatria identifies political entities; it does not provide a complete list of individual rulers for every location and year. The atlas therefore labels the matched polity as the historical authority and links to its reference page where available.

## Historical battles and war event locations

`wars-hced-v3.geojson.gz` is derived from the **Historical Conflict Event Dataset v3** by Charles Miller and K. Shuvo Bakar. It contains named battle records with recorded dates, coordinates, participants, and outcomes where the source provides them. The upstream collection covers 1468 BCE–2003 CE; this atlas uses events dated through 1988 so the later timeline can use UCDP's more detailed georeferenced records. Rows without usable coordinates or dates are omitted, and multi-year dates are preserved.

- Dataset and version: <https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/6ZFC0V>
- Paper: Miller and Bakar (2023), “Conflict Events Worldwide Since 1468BC: Introducing the Historical Conflict Event Dataset,” *Journal of Conflict Resolution*, DOI <https://doi.org/10.1177/00220027221119085>
- License: CC0 1.0 Universal, as stated in the Harvard Dataverse record.
- Changes: converted the source CSV to compact point GeoJSON and retained battle, war, country, combatants, winner/loser, theatre, date range, and coordinates.

`wars-ucdp-26.1.geojson.gz` combines the **UCDP Georeferenced Event Dataset v26.1** with the **UCDP/PRIO Armed Conflict Dataset v26.1**. It keeps state-based georeferenced events from 1989 through 2022 only when the matching conflict/year is coded at intensity level 2 (“war”). UCDP defines this level as at least 1,000 battle-related deaths in a calendar year. Events are grouped by conflict, dyad, and named location; the output preserves the years, event counts, best-estimate deaths, sides, and coordinates.

- Dataset downloads and citation guidance: <https://ucdp.uu.se/downloads/>
- GED v26.1 codebook: <https://ucdp.uu.se/downloads/ged/ged261.pdf>
- PRIO v26.1 codebook: <https://ucdp.uu.se/downloads/ucdpprio/ucdp-prio-acd-261.pdf>
- License: Creative Commons Attribution 4.0 International (CC BY 4.0). Cite UCDP GED version 26.1 and the relevant UCDP publications listed on the download page.
- Changes: filtered GED events to state-based, high-intensity conflict-years and the atlas's 2022 endpoint; grouped repeated events at the same named point without changing the recorded coordinates.

The selected period may be earlier than these sources' coverage. The historical battle catalog starts in 1468 BCE, and the UCDP war-event layer starts in 1989. Blank time ranges mean this combined catalog has no displayed records for that slice; they are not evidence that no conflicts occurred. The UCDP points are georeferenced incident locations, not front lines or complete territorial control. Both sources have selection and reporting limits, and this atlas does not claim to contain every documented war or battle.

## Close-zoom city and landmark labels

`gazetteer-cities.json.gz` is derived from the **GeoNames** `cities15000` gazetteer. It contains places with populations of 50,000 or more, plus national capitals, with name, coordinates, population, country code, and GeoNames identifier. GeoNames data is licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

- Gazetteer downloads: <https://download.geonames.org/export/dump/>
- GeoNames: <https://www.geonames.org/>
- Changes: filtered to the atlas's close-zoom city set, selected the required fields, rounded coordinates to five decimal places, and compressed the result as gzipped JSON.

`gazetteer-landmarks.json.gz` is derived from **Wikidata** items that are UNESCO World Heritage Sites or architectural landmarks. The extract keeps places classified as archaeological sites, monuments, museums, palaces, fortresses, religious sites, bridges, and other cultural landmarks, with their English label, coordinates, landmark type, and Wikidata identifier. Wikidata's structured data is released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

- Wikidata query service: <https://query.wikidata.org/>
- UNESCO World Heritage designation: <https://www.wikidata.org/wiki/Q9259>
- Changes: removed settlements, natural features, duplicate items, and duplicate names; selected one coordinate per item; compressed the result as gzipped JSON.

Both label layers load only when the viewer reaches the closest zoom band. They are modern reference labels and do not change with the historical year selected in the atlas. The landmark selection is representative rather than exhaustive, and coordinates are cartographic reference points rather than surveyed boundaries.

The map assets were generated with `tools/build-atlas-assets.py`, and the close-zoom label assets with `tools/build-atlas-labels.py`, from source archives stored outside the published site. The user-provided GeaCron offline page folder is used as a visual reference only; its third-party map tiles are not copied into this atlas.
