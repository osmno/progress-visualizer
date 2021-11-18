const map = L.map("map", {
  zoomControl: false,
}).setView([64.69135656676626, 10.795899331569672], 6);

L.control
  .zoom({
    position: "topright",
  })
  .addTo(map);

L.tileLayer(
  "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
  {
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: "mapbox/dark-v10",
    tileSize: 512,
    zoomOffset: -1,
    accessToken:
      "pk.eyJ1IjoibWF0aGlhc2g5OCIsImEiOiJja3c1ZGx6bmcwZmQyMm5sajJrZGQwdDF5In0.Vw5JcsEGSmSzYTVGzhHPNQ",
  }
).addTo(map);

init();

async function init() {
  const kommuner = await getKommuner();
  /** @type {L.geoJSON} */
  const kommuneLayer = renderKommuner(kommuner);

  const progressSelectorRef = document.getElementById("progress-selector");
  progressSelectorRef.addEventListener("change", (e) =>
    handleProgressSelectorChange(e.target.value, kommuneLayer)
  );

  handleProgressSelectorChange(progressSelectorRef.value, kommuneLayer);
}

/**
 *
 * @param {{"building" | "nvdb" | "stedsnavn"}} progressToVisualize
 */
async function handleProgressSelectorChange(progressToVisualize, kommuneLayer) {
  switch (progressToVisualize) {
    case "building":
      const buildingImportProgress = await getBuildingImportProgress();
      renderKommuneProgress(
        kommuneLayer,
        getKommuneProgress(buildingImportProgress, "Polygon_progress")
      );
      break;
    case "nvdb":
      const progress = await getNVDBManglerProgress();
      renderKommuneProgress(
        kommuneLayer,
        getKommuneProgress(progress, "Percent_missing", true)
      );
      break;
    case "stedsnavn":
      break;
    default:
      console.error(`${progressToVisualize} is not supported`);
      break;
  }
}

/**
 *
 * @param {{Id: string,}}} progress
 */
function renderProgress(progress) {
  const progressEl = document.querySelector("#progress");
  progressEl.textContent = progress;
}

/**
 * @param {KommunerGeoJson} kommuner
 * @return {L.geoJSON}
 */
function renderKommuner(kommuner) {
  return L.geoJSON(kommuner, {
    style: {
      color: "#ff0000",
      weight: 1,
      fillColor: "#fff",
      fillOpacity: 0.1,
    },
  }).addTo(map);
}

/**
 *
 * @param {Object} progress
 * @param {string} progressColumn
 * @param {bool} reverseScale
 * @return {{[id: string]: KommuneProgress}}
 */
function getKommuneProgress(progress, progressColumn, reverseScale = false) {
  /**@type {{[id: string]: number}} */
  const kommuneIdToProgress = {};

  for (const kommune of progress) {
    const progressAsNumber = Number(kommune[progressColumn].match(/\d+/)[0]);
    kommuneIdToProgress[kommune.Id] = {
      ...kommune,
      progress: reverseScale ? 100 - progressAsNumber : progressAsNumber,
    };
  }

  return kommuneIdToProgress;
}

/**
 * @param {L.geoJson} kommuneLayer
 * @param {{[id: string]: KommuneProgress}} kommuner
 */
function renderKommuneProgress(kommuneLayer, kommuner) {
  kommuneLayer.eachLayer((layer) => {
    const kommuneId = layer.feature.properties.kommunenummer;
    const kommune = kommuner[kommuneId];
    const progress = kommune.progress;
    layer.feature.properties.progress = progress;
    layer.setStyle({
      fillColor: getColor(progress),
      color: getColor(progress),
    });
    layer.bindPopup(`
    <div class="popup">
      <h1>${kommune.Municipality}</h1>
      <p>${JSON.stringify(kommune, null, "\t")}</p>
    </div>
    `);
  });
}

/**
 *
 * @param {number} value from 0 to 1
 * @returns {string} Color from red to green as hsl
 */
function getColor(value) {
  if (value <= 0.19) return "#ED1B2A";
  else if (value <= 0.39) return "#ED1B2A";
  else if (value <= 0.59) return "#F8B02C";
  else if (value <= 0.79) return "#FFD51F";
  else if (value <= 0.99) return "#BBCD5A";
  else return "#008B5A";
}

/**
 * @return {Promise<KommunerGeoJson>}
 */
async function getKommuner() {
  const resp = await fetch("./data/kommuner.geojson");

  if (resp.ok) {
    return resp.json();
  }
}

/**
 * @return {Promise<KommuneBuildingProgress[]>}
 */
function getBuildingImportProgress() {
  return convertWikiToJson(
    "https://wiki.openstreetmap.org/wiki/Import/Catalogue/Norway_Building_Import/Progress"
  );
}

/**
 * @return {Promise<Object[]>}
 */
function getNVDBManglerProgress() {
  return convertWikiToJson(
    "https://wiki.openstreetmap.org/wiki/Import/Catalogue/Road_import_(Norway)/Update"
  );
}

/**
 *
 * @param {string} url
 * @returns
 */
async function convertWikiToJson(url) {
  const resp = await fetch(
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  );

  if (resp.ok) {
    // parse html table and get percentage for each kommune
    const progressDocumentText = await resp.text();
    const progressHtml = new DOMParser().parseFromString(
      progressDocumentText,
      "text/html"
    );
    const progressTable = progressHtml.querySelector("table");
    const tableAsJson = parseHTMLTableElem(progressTable);
    console.dir(tableAsJson);
    return tableAsJson;
  }
}

/**
 *
 * @param {HTMLTableElement} tableEl
 * @returns {Object}
 */
function parseHTMLTableElem(tableEl) {
  const columns = Array.from(tableEl.querySelectorAll("th")).map((it) =>
    it.textContent.replace(/\\n/g, "").replace(/\s/g, "_")
  );
  const rows = tableEl.querySelectorAll("tbody > tr");
  const tableAsJson = [];
  rows.forEach((row) => {
    const rowObject = {};
    const cells = Array.from(row.querySelectorAll("td"));
    for (let i = 0; i < columns.length; i++) {
      const cell = cells[i];
      if (cell && cell.textContent) {
        rowObject[columns[i]] = cell.textContent.replace(/\\n/g, "");
      }
    }
    if (Object.keys(rowObject).length > 0) {
      tableAsJson.push(rowObject);
    }
  });
  return tableAsJson;
}

/**
 * @typedef {object} KommunerGeoJson
 * @property {object[]} features
 * @property {object} features.geometry
 * @property {array[]|number[]} features.geometry.coordinates
 * @property {string} features.geometry.type
 * @property {object} features.properties
 * @property {string} features.properties.kommunenavn
 * @property {string} features.properties.kommunenummer
 * @property {string} features.type
 * @property {string} type
 */

/**
 * @typedef {object} KommuneProgress
 * @property {number} progress
 * @property {any} [alleAndreProps]
 */

/**
 * @typedef {object} KommuneBuildingProgress
 * @property {string} Id
 * @property {string} Municipality
 * @property {string} County
 * @property {string} Matrikkel_buildings
 * @property {string} OSM_buildings
 * @property {string} Total_progress
 * @property {string} Polygon_progress
 * @property {string} Responsible_user(s)
 * @property {string} Status
 */
