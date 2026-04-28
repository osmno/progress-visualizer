const projectOptions = [
  { id: "ssr", label: "SSR" },
  { id: "nvdb", label: "NVDB missing" },
  { id: "highwayTagUpdate", label: "Highway tags" },
  { id: "n50", label: "N50" },
  { id: "barnehagefakta", label: "Barnehagefakta" },
  { id: "building", label: "Building import" },
];

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
  // Populate project selector with random project selected
  const defaultSelected =
    projectOptions[Math.floor(Math.random() * projectOptions.length)];
  /** @type {HTMLSelectElement} */
  const progressSelectorRef = document.getElementById("progress-selector");
  projectOptions.forEach((option) => {
    progressSelectorRef.options.add(
      new Option(
        option.label,
        option.id,
        defaultSelected.id === option.id,
        defaultSelected.id === option.id
      )
    );
  });

  const selectedProject = new URLSearchParams(window.location.search).get(
    "project"
  );

  const kommuner = await getKommuner();
  /** @type {L.geoJSON} */
  const kommuneLayer = renderKommuner(kommuner);

  if (
    Array.from(progressSelectorRef.options).some(
      (opt) => opt.value === selectedProject
    )
  ) {
    progressSelectorRef.value = selectedProject;
  }

  progressSelectorRef.addEventListener("change", (e) =>
    handleProgressSelectorChange(e.target.value, kommuneLayer)
  );

  document.getElementById("map-selector").addEventListener("change", (e) => {
    setTileLayer(e.target.value);
  });

  const dropdownToggle = document.getElementById("selector-dropdown-toggle");
  const dropdown = document.getElementById("selector-dropdown");
  dropdownToggle.addEventListener("click", () => {
    dropdown.classList.toggle("invisible");
    dropdownToggle.classList.toggle("flip");
    const isExpanded = dropdownToggle.getAttribute("aria-expanded") === "true";
    dropdownToggle.setAttribute("aria-expanded", String(!isExpanded));
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
      map.removeLayer(cartoLight);
      map.removeLayer(openStreetMapMapnik);
      break;
    case "carto-light":
      cartoLight.addTo(map);
      map.removeLayer(mapboxDark);
      map.removeLayer(openStreetMapMapnik);
      break;
    case "osm-mapnik":
      openStreetMapMapnik.addTo(map);
      map.removeLayer(mapboxDark);
      map.removeLayer(cartoLight);
      break;
    default:
      console.error(`${tileLayer} is not supported`);
      break;
  }
}

/**
 *
 * @param {{"building" | "nvdb" | "n50" | "ssr" | "barnehagefakta" | "highwayTagUpdate"}} progressToVisualize
 */
async function handleProgressSelectorChange(progressToVisualize, kommuneLayer) {
  try {
    kommuneLayer.resetStyle();
    document.getElementById("error").innerHTML = "Laster...";
    switch (progressToVisualize) {
      case "building": {
        const buildingImportProgress = await getBuildingImportProgress();
        renderKommuneProgress(kommuneLayer, buildingImportProgress);
        break;
      }
      case "nvdb": {
        const progress = await getNVDBManglerProgress();
        renderKommuneProgress(kommuneLayer, progress, getNVDBProgressColor);
        break;
      }
      case "n50": {
        const n50Progress = await getN50Progress();
        renderKommuneProgress(kommuneLayer, n50Progress, (num) =>
          getProgressColor(num, "#444")
        );
        break;
      }
      case "ssr": {
        const ssrProgress = await getSSRProgress();
        renderKommuneProgress(kommuneLayer, ssrProgress, ssrProgressColor);
        break;
      }
      case "barnehagefakta": {
        const barnehagefaktaProgress = await getBarnehagefaktaProgress();
        renderKommuneProgress(kommuneLayer, barnehagefaktaProgress);
        break;
      }
      case "highwayTagUpdate": {
        const highwayTagUpdateProgress = await getHighwayTagUpdateProgress();
        renderKommuneProgress(
          kommuneLayer,
          highwayTagUpdateProgress,
          highwayProgressColor
        );
        break;
      }
      default:
        console.error(`${progressToVisualize} is not supported`);
        break;
    }
    window.history.replaceState(null, null, `?project=${progressToVisualize}`);
    document.getElementById("error").innerHTML = "";
  } catch (error) {
    document.getElementById("error").innerHTML = error.message;
    console.error(error);
  }
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
 * @param {boolean} reverseScale
 * @return {{[id: string]: KommuneProgress}}
 */
function getKommuneProgress(progress, progressColumn, reverseScale = false) {
  /**@type {{[id: string]: number}} */
  const kommuneIdToProgress = {};

  for (const kommune of progress) {
    const valueAsPotentiallyString = kommune[progressColumn];
    const numberMatches = isNaN(valueAsPotentiallyString)
      ? valueAsPotentiallyString?.match(/\d+/)
      : [valueAsPotentiallyString];
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
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
        <h2>${escapeHtml(kommune.Municipality)}</h2>
        ${Object.keys(kommune)
          .map((key) => `<p><b>${escapeHtml(key)}:</b> ${escapeHtml(String(kommune[key]))}</p>`)
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
function getProgressColor(value, nullColor = "#fff") {
  if (value == null) return nullColor;
  else if (value === 0) return "#fff";
  else if (value <= 19) return "#ED1B2A";
  else if (value <= 39) return "#ED1B2A";
  else if (value <= 59) return "#F8B02C";
  else if (value <= 79) return "#FFD51F";
  else if (value <= 99) return "#BBCD5A";
  else return "#008B5A";
}

/**
 * Get progress color based on https://wiki.openstreetmap.org/wiki/Template:Progress
 * @param {number} value from 0 to 1
 * @returns {string} Color from red to green as hsl
 */
function highwayProgressColor(value, nullColor = "#fff") {
  if (value == null) return nullColor;
  else if (value === 0) return "#fff";
  else if (value <= 55) return "#ED1B2A";
  else if (value <= 69) return "#F8B02C";
  else if (value <= 79) return "#FFD51F";
  else if (value <= 99) return "#BBCD5A";
  else return "#008B5A";
}

/**
 * Get progress color based on https://wiki.openstreetmap.org/wiki/Template:Progress
 * @param {number} value from 0 to 1
 * @returns {string} Color from red to green as hsl
 */
function ssrProgressColor(value, nullColor = "#fff") {
  if (value == null) return nullColor;
  else if (value === 0) return "#fff";
  // red
  else if (value <= 10) return "#ED1B2A";
  // dark orange
  else if (value < 20) return "#F8B02C";
  // light orange
  else if (value < 40) return "#FFD51F";
  // yellow
  else if (value < 60) return "#BBCD5A";
  // green
  else return "#008B5A"; // green
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
  const resp = await fetch("./data/kommuner2024.geojson");

  if (resp.ok) {
    return resp.json();
  }
  throw new Error("Failed to load kommuner data");
}

/**
 * @return {Promise<{[id: string]: KommuneProgress}>}
 */
async function getBuildingImportProgress() {
  const hostname = "wiki.openstreetmap.org";
  const path = "wiki/Import/Catalogue/Norway_Building_Import/Progress";
  setProgressSourceUrl(`https://${hostname}/${path}`);
  const data = await convertWikiToJson(hostname, path);
  return getKommuneProgress(data, "Polygon_progress");
}

/**
 * @return {Promise<{[id: string]: KommuneProgress}>}
 */
async function getNVDBManglerProgress() {
  const hostname = "wiki.openstreetmap.org";
  const path = "wiki/Import/Catalogue/Road_import_(Norway)/Update";
  setProgressSourceUrl(`https://${hostname}/${path}`);
  const data = await convertWikiToJson(hostname, path);
  return getKommuneProgress(data, "Percent_missing", true);
}

/**
 * @return {Promise<{[id: string]: KommuneProgress}>}
 */
async function getHighwayTagUpdateProgress() {
  const hostname = "wiki.openstreetmap.org";
  const path = "wiki/Import/Catalogue/Road_import_(Norway)/Tag_Update";
  setProgressSourceUrl(`https://${hostname}/${path}`);
  const data = await convertWikiToJson(hostname, path);

  data.forEach((kommune) => {
    kommune.Id = kommune["Mnr"];
    kommune.avg_missing_percentage = getAvg([
      kommune["Local_highways_Percent_highways"],
      kommune["State/county_highways_Percent_highways"],
    ]);
  });
  console.dir(data);
  return getKommuneProgress(data, "avg_missing_percentage", true);
}

/**
 * @return {Promise<Object>}
 */
async function getSSRProgress() {
  const hostname = "wiki.openstreetmap.org";
  const path =
    "wiki/Import/Catalogue/Central_place_name_register_import_(Norway)/Progress";
  setProgressSourceUrl(`https://${hostname}/${path}`);
  const data = await convertWikiToJson(hostname, path);

  data.forEach((kommune) => {
    kommune.Municipality = kommune["Kommune"];
    kommune.Id = kommune["Knr"];
  });

  return getKommuneProgress(data, "Status");
}

/**
 * @return {Promise<Object>}
 */
async function getBarnehagefaktaProgress() {
  const hostname = "obtitus.github.io";
  const path = "barnehagefakta_osm_data/index.html";
  setProgressSourceUrl(`https://${hostname}/${path}`);
  const data = await convertWikiToJson(hostname, path);

  console.debug(data);

  data.forEach((kommune) => {
    kommune.Municipality = kommune["Kommune_navn"];
    kommune.Id = kommune["Kommune_nr"];
  });

  return getKommuneProgress(data, "Prosent_gjenkjent");
}

/**
 * @return {Promise<Object>}
 */
async function getN50Progress() {
  const hostname = "wiki.openstreetmap.org";
  const path = "wiki/Import/Catalogue/Topography_import_for_Norway/assignment";
  setProgressSourceUrl(`https://${hostname}/${path}`);
  const data = await convertWikiToJson(hostname, path);

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
      const existingKystlinje =
        parsedKommuner[kommuneId]["Progresjon_kystlinje(ikke_alltid_relevant)"];

      parsedKommuner[kommuneId] = {
        ...parsedKommuner[kommuneId],
        Progresjon_arealdekke: getAvg([newArealdekke, existingArealdekke]),
        Progresjon_vann: getAvg([newVann, existingVann]),
        "Progresjon_kystlinje(ikke_alltid_relevant)": getAvg([
          newKystlinje,
          existingKystlinje,
        ]),
      };
      parsedKommuner[kommuneId].progress = parsedKommuner[kommuneId][
        "Kommentar"
      ].includes("not be imported")
        ? null
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
          ? null
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

function setProgressSourceUrl(url) {
  document.getElementById("progress-source-url").href = url;
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
      if (num === "N/A") numberOfNotApplicable++;
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
 * Fetch a progress page and parse its first <table> into JSON.
 *
 * For wiki.openstreetmap.org we hit the MediaWiki action API with origin=*
 * for CORS. For other hosts we fetch the page directly — works as long as
 * the host sends Access-Control-Allow-Origin (GitHub Pages does).
 *
 * @param {string} hostname
 * @param {string} path
 * @returns
 */
async function convertWikiToJson(hostname, path) {
  let html;
  if (hostname === "wiki.openstreetmap.org") {
    const page = path.replace(/^wiki\//, "");
    const apiUrl = `https://${hostname}/w/api.php?action=parse&page=${encodeURIComponent(
      page
    )}&prop=text&format=json&origin=*`;
    const resp = await fetch(apiUrl);
    if (!resp.ok) throw new Error(resp.statusText);
    const json = await resp.json();
    if (json.error) throw new Error(json.error.info);
    html = json.parse.text["*"];
  } else {
    const resp = await fetch(`https://${hostname}/${path}`);
    if (!resp.ok) throw new Error(resp.statusText);
    html = await resp.text();
  }

  const progressHtml = new DOMParser().parseFromString(html, "text/html");
  const progressTable = progressHtml.querySelector("table");
  return parseHTMLTableElem(progressTable);
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
      if (cell?.textContent) {
        rowObject[columns[i]] = cell.textContent.replace(/\\n/g, "").trim();
      }
    }
    if (Object.keys(rowObject).length > 0) {
      tableAsJson.push(rowObject);
    }
  });
  return tableAsJson;
}

/*
 * Workaround for 1px lines appearing in some browsers due to fractional transforms
 * and resulting anti-aliasing.
 * https://github.com/Leaflet/Leaflet/issues/3575
 */
(function () {
  const originalInitTile = L.GridLayer.prototype._initTile;
  L.GridLayer.include({
    _initTile: function (tile) {
      originalInitTile.call(this, tile);

      const tileSize = this.getTileSize();

      tile.style.width = tileSize.x + 1 + "px";
      tile.style.height = tileSize.y + 1 + "px";
    },
  });
})();

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
