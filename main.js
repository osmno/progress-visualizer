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
 * @param {{"building" | "nvdb" | "n50"}} progressToVisualize
 */
async function handleProgressSelectorChange(progressToVisualize, kommuneLayer) {
  try {
    const kommuner = await getKommuner();
    /** @type {L.geoJSON} */
    const kommuneLayer = renderKommuner(kommuner);
    document.getElementById("error").innerHTML = "Laster...";
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
          getKommuneProgress(progress, "Percent_missing", true),
          getNVDBProgressColor
        );
        break;
      case "n50":
        const n50Progress = await getN50Progress();
        renderKommuneProgress(
          kommuneLayer,
          getKommuneProgress(n50Progress, "Progresjon_arealdekke")
        );
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
    let progressAsNumber = 0;
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
  console.debug(kommuneLayer, kommuner);
  kommuneLayer.eachLayer((layer) => {
    const kommuneId = layer.feature.properties.kommunenummer;
    const kommune = kommuner[kommuneId] ?? kommuner[Number(kommuneId)];
    if (kommune) {
      const progress = kommune.progress;
      layer.feature.properties.progress = progress;
      layer.setStyle({
        fillColor: colorFunction(progress),
        color: colorFunction(progress),
        fillOpacity: 0.1,
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
      console.error(
        `Could not find kommune with id: ${kommuneId}, length of id: ${kommuneId.length}`
      );
    }
  });
}

/**
 * Get progress color based on https://wiki.openstreetmap.org/wiki/Template:Progress
 * @param {number} value from 0 to 1
 * @returns {string} Color from red to green as hsl
 */
function getProgressColor(value) {
  if (value <= 19) return "#ED1B2A";
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
 * @return {Promise<Object[]>}
 */
async function getN50Progress() {
  const data = await convertWikiToJson(
    "https://wiki.openstreetmap.org/wiki/Import/Catalogue/Topography_import_for_Norway/assignment"
  );

  data.forEach((kommune) => {
    kommune.Id = kommune["Kommune-nummer"];
    kommune.Municipality = kommune["Kommunenavn"];
  });

  return data;
}

/**
 *
 * @param {string} url
 * @returns
 */
async function convertWikiToJson(url) {
  // const resp = await fetch(
  //   `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  // );
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
    console.dir(tableAsJson);
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
