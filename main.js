const map = L.map("map", {
  zoomControl: false,
}).setView([64.69135656676626, 10.795899331569672], 6);

L.control
  .zoom({
    position: "topright",
  })
  .addTo(map);

const mapboxDark = L.tileLayer(
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
);

const cartoLight = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png",
  {
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.carto.com/">carto.com</a>',
  }
);

const openStreetMapMapnik = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }
);

mapboxDark.addTo(map);

init();

async function init() {
  const kommuner = await getKommuner();
  /** @type {L.geoJSON} */
  const kommuneLayer = renderKommuner(kommuner);

  const progressSelectorRef = document.getElementById("progress-selector");
  progressSelectorRef.addEventListener("change", (e) =>
    handleProgressSelectorChange(e.target.value, kommuneLayer)
  );

  document.getElementById("map-selector").addEventListener("change", (e) => {
    setTileLayer(e.target.value);
  });

  handleProgressSelectorChange(progressSelectorRef.value, kommuneLayer);
}

/**
 *
 * @param {"mapbox-dark" | "carto-light" | "osm-mapnik"} tileLayer
 */
function setTileLayer(tileLayer) {
  switch (tileLayer) {
    case "mapbox-dark":
      mapboxDark.addTo(map);
      break;
    case "carto-light":
      cartoLight.addTo(map);
      break;
    case "osm-mapnik":
      openStreetMapMapnik.addTo(map);
      break;
    default:
      console.error(`${tileLayer} is not supported`);
      break;
  }
}

/**
 *
 * @param {{"building" | "nvdb" | "n50"}} progressToVisualize
 */
async function handleProgressSelectorChange(progressToVisualize, kommuneLayer) {
  try {
    kommuneLayer.resetStyle();
    document.getElementById("error").innerHTML = "Laster...";
    switch (progressToVisualize) {
      case "building":
        const buildingImportProgress = await getBuildingImportProgress();
        renderKommuneProgress(kommuneLayer, buildingImportProgress);
        break;
      case "nvdb":
        const progress = await getNVDBManglerProgress();
        renderKommuneProgress(kommuneLayer, progress, getNVDBProgressColor);
        break;
      case "n50":
        const n50Progress = await getN50Progress();
        renderKommuneProgress(kommuneLayer, n50Progress);
        break;
      default:
        console.error(`${progressToVisualize} is not supported`);
        break;
    }
    document.getElementById("error").innerHTML = "";
  } catch (error) {
    document.getElementById("error").innerHTML = error.message;
    console.error(error);
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
      color: "#999",
      weight: 1,
      fillColor: "#fff",
      fillOpacity: 0.01,
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
    const numberMatches = kommune[progressColumn]?.match(/\d+/);
    let progressAsNumber = null;
    if (numberMatches && numberMatches.length > 0) {
      progressAsNumber = Number(numberMatches[0]);
    }
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
 * @param {function(number): string} colorFunction
 */
function renderKommuneProgress(
  kommuneLayer,
  kommuner,
  colorFunction = getProgressColor
) {
  kommuneLayer.eachLayer((layer) => {
    const kommuneId = layer.feature.properties.kommunenummer;
    const kommune = kommuner[kommuneId] ?? kommuner[Number(kommuneId)];
    if (kommune) {
      const progress = kommune.progress;
      layer.feature.properties.progress = progress;
      layer.setStyle({
        fillColor: colorFunction(progress),
        fillOpacity: 0.2,
      });
      layer.bindPopup(`
      <div class="popup">
        <h2>${kommune.Municipality}</h2>
        ${Object.keys(kommune)
          .map((key) => `<p><b>${key}:</b> ${kommune[key]}</p>`)
          .join("")}
      </div>
      `);
    } else {
      console.warn(`Could not find kommune with id: ${kommuneId}`);
    }
  });
}

/**
 * Get progress color based on https://wiki.openstreetmap.org/wiki/Template:Progress
 * @param {number} value from 0 to 1
 * @returns {string} Color from red to green as hsl
 */
function getProgressColor(value) {
  if (value === null || value === 0) return "#fff";
  else if (value <= 19) return "#ED1B2A";
  else if (value <= 39) return "#ED1B2A";
  else if (value <= 59) return "#F8B02C";
  else if (value <= 79) return "#FFD51F";
  else if (value <= 99) return "#BBCD5A";
  else return "#008B5A";
}

/**
 *
 * @param {number} value from 0 to 1
 * @returns {string} Color from red to green as hsl
 */
function getNVDBProgressColor(value) {
  // red
  if (value <= 90) return "#ED1B2A";
  // dark orange
  else if (value < 93) return "#F8B02C";
  // light orange
  else if (value < 95) return "#FFD51F";
  // yellow
  else if (value < 98) return "#BBCD5A";
  // green
  else return "#008B5A"; // green
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
 * @return {Promise<{[id: string]: KommuneProgress}>}
 */
async function getBuildingImportProgress() {
  const data = await convertWikiToJson(
    "https://wiki.openstreetmap.org/wiki/Import/Catalogue/Norway_Building_Import/Progress"
  );
  return getKommuneProgress(data, "Polygon_progress");
}

/**
 * @return {Promise<{[id: string]: KommuneProgress}>}
 */
async function getNVDBManglerProgress() {
  const data = await convertWikiToJson(
    "https://wiki.openstreetmap.org/wiki/Import/Catalogue/Road_import_(Norway)/Update"
  );
  return getKommuneProgress(data, "Percent_missing", true);
}

/**
 * @return {Promise<Object[]>}
 */
async function getN50Progress() {
  const data = await convertWikiToJson(
    "https://wiki.openstreetmap.org/wiki/Import/Catalogue/Topography_import_for_Norway/assignment"
  );

  const parsedKommuner = {};
  data.forEach((kommune) => {
    /**@type {string} */
    const kommuneId = kommune["Kommune-nummer"].includes("-")
      ? kommune["Kommune-nummer"].split("-")[0]
      : kommune["Kommune-nummer"];

    if (parsedKommuner[kommuneId]) {
      const newArealdekke = kommune["Progresjon_arealdekke"];
      const existingArealdekke =
        parsedKommuner[kommuneId]["Progresjon_arealdekke"];

      const newVann = kommune["Progresjon_vann"];
      const existingVann = parsedKommuner[kommuneId]["Progresjon_vann"];

      const newKystlinje =
        kommune["Progresjon_kystlinje(ikke_alltid_relevant)"];
      const exisitingKystlinje =
        parsedKommuner[kommuneId]["Progresjon_kystlinje(ikke_alltid_relevant)"];

      parsedKommuner[kommuneId] = {
        ...parsedKommuner[kommuneId],
        Progresjon_arealdekke: getAvg([newArealdekke, existingArealdekke]),
        Progresjon_vann: getAvg([newVann, existingVann]),
        "Progresjon_kystlinje(ikke_alltid_relevant)": getAvg([
          newKystlinje,
          exisitingKystlinje,
        ]),
      };
      parsedKommuner[kommuneId].progress = parsedKommuner[kommuneId][
        "Kommentar"
      ].includes("not be imported")
        ? 100
        : getAvg([
            parsedKommuner[kommuneId].progress,
            getAvg([
              kommune["Progresjon_kystlinje(ikke_alltid_relevant)"],
              kommune["Progresjon_arealdekke"],
              kommune["Progresjon_vann"],
            ]),
          ]);
    } else {
      parsedKommuner[kommuneId] = {
        ...kommune,
        Id: kommuneId,
        Municipality: kommune["Kommunenavn"],
        progress: kommune["Kommentar"].includes("not be imported")
          ? 100
          : Number(
              getAvg([
                kommune["Progresjon_kystlinje(ikke_alltid_relevant)"],
                kommune["Progresjon_arealdekke"],
                kommune["Progresjon_vann"],
              ])
            ),
      };
    }
  });
  return parsedKommuner;
}

/**
 * @param {(string | number)[]} nums
 * @returns {number} average
 */
function getAvg(nums) {
  let numberOfNotApplicable = 0;
  let total = 0;

  nums.forEach((num) => {
    if (!isNaN(num)) {
      total += num;
    } else {
      const numNumberMatches = num.match(/\d+/g);
      if (num == "N/A") numberOfNotApplicable++;
      const numAsNumber =
        numNumberMatches && numNumberMatches.length > 0
          ? Number(numNumberMatches[0])
          : 0;
      total += numAsNumber;
    }
  });

  return Math.round(total / Math.max(1, nums.length - numberOfNotApplicable));
}

/**
 *
 * @param {string} url
 * @returns
 */
async function convertWikiToJson(url) {
  const resp = await fetch(
    `https://production.osmno-cors-proxy.mathiash98.workers.dev/${url.replace(
      "https://wiki.openstreetmap.org/",
      ""
    )}`
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
    return tableAsJson;
  } else {
    throw new Error(resp.statusText);
  }
}

/**
 *
 * @param {HTMLTableElement} tableEl
 * @returns {Object}
 */
function parseHTMLTableElem(tableEl) {
  const columns = Array.from(tableEl.querySelectorAll("th")).map((it) =>
    it.textContent.trim().replace(/\\n/g, "").replace(/\s/g, "_").trim()
  );
  const rows = tableEl.querySelectorAll("tbody > tr");
  const tableAsJson = [];
  rows.forEach((row) => {
    const rowObject = {};
    const cells = Array.from(row.querySelectorAll("td"));
    for (let i = 0; i < columns.length; i++) {
      const cell = cells[i];
      if (cell && cell.textContent) {
        rowObject[columns[i]] = cell.textContent.replace(/\\n/g, "").trim();
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
