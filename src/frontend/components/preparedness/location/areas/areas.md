# Münster area boundaries

Source: Stadt Münster, Stadtplanungsamt, statistical district boundaries.
[Official dataset](https://opendata.stadt-muenster.de/dataset/geokoordinaten-der-stadtteil-grenzen-geometriedaten-der-kleinr%C3%A4umigen-gebietsgliederung).
[Original GeoJSON](https://opendata.stadt-muenster.de/sites/default/files/stadtteile-statistische-bezirke-muenster.geojson).
License: [Datenlizenz Deutschland – Namensnennung – Version 2.0](https://www.govdata.de/dl-de/by-2-0).
Attribution: Stadt Münster. Retrieved 2026-09-26; geometry metadata states 2022-01-03.

Transformations: retain WGS84/CRS84 coordinates rounded to six decimal places (about 0.1 metre); remove unused properties;
rename area ID and name; map the four central subdivisions to Münster-Mitte.
No boundary simplification. 45 statistical districts (used as the area picker),
aggregated into six city districts. These are not a current residence register.
The data is bundled locally; determining an area never sends coordinates to a server.
