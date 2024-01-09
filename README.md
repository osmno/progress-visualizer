# progress-visualizer

Visualizing progress of various projects in the norwegian OSM-mapping community

### Made possible with:

- Norwegian mapping community https://wiki.openstreetmap.org/wiki/Norway
- OpenStreetMap https://www.openstreetmap.org/
- Leaflet https://leafletjs.com/reference.html
- Mapbox https://www.mapbox.com/
- CORSflare https://github.com/Darkseal/CORSflare for proxying requests to the wiki sites and to bypass CORS

## Update kommuner.geojson

1. Go to Overpass Turbo and run https://overpass-turbo.eu/#

```Overpass
[out:json][timeout:25];
{{geocodeArea:Norge}}->.searchArea;
wr["admin_level"="7"](area.searchArea);
out geom;
```

2. Export to GeoJSON
3. Simplify with https://www.npmjs.com/package/simplify-geojson: `cat kommuner2024.geojson | simplify-geojson -t 0.01 > kommuner2024-simplified.geojson`
4. Remove unnecessary `@relations` from all features in geojson array with `cat kommuner2024-simplified.geojson | jq 'del(.features[].properties["@relations"])' > kommuner2024-simplified-reduced.geojson`
5. Delete all points from the geojson file by searching for `Type": "Point`
