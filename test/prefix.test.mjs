import "./dom-shim.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const { haSlugify, aufloesenPrefix, TomtutPoolDosingCard } = await import(
  "../tomtut-pool-dosing-vigipool-card.js"
);

const fixture = JSON.parse(
  fs.readFileSync(fileURLToPath(new URL("./fixtures/ha-slugify.json", import.meta.url)), "utf8")
);

const PLATTFORM = "tomtut_pool_dosing_vigipool";
/** States-Objekt aus einer Liste von Entity-IDs bauen. */
const states = (...ids) => Object.fromEntries(ids.map((id) => [id, { state: "7.1", attributes: {} }]));
/** Entity-Registry-Auszug, wie ihn das HA-Frontend unter hass.entities bereitstellt. */
const registry = (...ids) => Object.fromEntries(ids.map((id) => [id, { platform: PLATTFORM }]));

/** Karten-Instanz ohne DOM: lit-Reactive-Properties durch eigene Datenfelder
 *  ersetzen, damit kein requestUpdate() aus dem Konstruktor noetig ist. */
function neueKarte(config, hass) {
  const karte = Object.create(TomtutPoolDosingCard.prototype);
  for (const feld of ["_config", "hass", "_settingsOpen"]) {
    Object.defineProperty(karte, feld, { value: undefined, writable: true, configurable: true });
  }
  if (config !== undefined) karte.setConfig(config);
  if (hass !== undefined) karte.hass = hass;
  return karte;
}

// --------------------------------------------------------------- haSlugify
test("haSlugify trifft HAs eigenes slugify fuer alle Fixture-Faelle", () => {
  for (const { name, ha_slug } of fixture.faelle) {
    assert.equal(haSlugify(name), ha_slug, `Name: ${name}`);
  }
});

test("haSlugify vertraegt leere und fehlende Eingaben", () => {
  for (const eingabe of [undefined, null, "", "   ", "---"]) {
    assert.equal(haSlugify(eingabe), "");
  }
});

test("die vier Namen, an denen die alte Card scheiterte, loesen jetzt korrekt auf", () => {
  // Genau die Mismatch-Zeilen aus der Diagnose zu Issue #1.
  const stolperer = [
    ["Pool Dosieranlage Süd", "pool_dosieranlage_sud"],
    ["Vigipool-Dosieranlage", "vigipool_dosieranlage"],
    ["Poolsteuerung (Garten)", "poolsteuerung_garten"],
    ["Dosieranlage 2.0", "dosieranlage_2_0"],
  ];
  for (const [name, erwartet] of stolperer) {
    const alteBerechnung = name.toLowerCase().replace(/\s+/g, "_");
    assert.notEqual(alteBerechnung, erwartet, `${name}: Fixture waere sinnlos, alt==neu`);
    assert.equal(haSlugify(name), erwartet, `Name: ${name}`);
    // und ueber die volle Aufloesung muss die echte Entity gefunden werden
    const echt = `sensor.${erwartet}`;
    assert.equal(
      aufloesenPrefix({ device_name: name }, { states: states(`${echt}_ph`) }),
      echt
    );
  }
});

// --------------------------------------------------------- aufloesenPrefix
test("Normalfall: Name passt direkt auf eine vorhandene Entity", () => {
  const hass = { states: states("sensor.orpheo_vp_pool_dosieranlage_ph") };
  assert.equal(
    aufloesenPrefix({ device_name: "Orpheo VP Pool Dosieranlage" }, hass),
    "sensor.orpheo_vp_pool_dosieranlage"
  );
});

test("HA-Kollisionssuffix _2 nach mehrfacher Neuinstallation wird gefunden", () => {
  const hass = { states: states("sensor.orpheo_vp_pool_dosieranlage_2_ph") };
  assert.equal(
    aufloesenPrefix({ device_name: "Orpheo VP Pool Dosieranlage" }, hass),
    "sensor.orpheo_vp_pool_dosieranlage_2"
  );
});

test("expliziter entity_prefix gewinnt, wenn er traegt", () => {
  const hass = { states: states("sensor.eigener_name_ph", "sensor.orpheo_ph") };
  assert.equal(
    aufloesenPrefix({ device_name: "Orpheo", entity_prefix: "sensor.eigener_name" }, hass),
    "sensor.eigener_name"
  );
});

test("kaputter entity_prefix aus einer Alt-Config heilt ueber den Geraetenamen", () => {
  // Genau der Zustand, den der alte Editor hinterlassen hat.
  const hass = { states: states("sensor.vigipool_dosieranlage_ph") };
  assert.equal(
    aufloesenPrefix(
      { device_name: "Vigipool-Dosieranlage", entity_prefix: "sensor.vigipool-dosieranlage" },
      hass
    ),
    "sensor.vigipool_dosieranlage"
  );
});

test("passt der Name gar nicht, entscheidet die Entity-Registry", () => {
  const hass = {
    states: states("sensor.voellig_anderer_name_ph", "sensor.fremde_integration_ph"),
    entities: registry("sensor.voellig_anderer_name_ph"),
  };
  assert.equal(
    aufloesenPrefix({ device_name: "Steht So Nirgends" }, hass),
    "sensor.voellig_anderer_name"
  );
});

test("fremde _ph-Sensoren ohne Registry-Treffer werden nicht gekapert", () => {
  const hass = { states: states("sensor.nachbars_pool_ph", "sensor.irgendwas_ph") };
  assert.equal(
    aufloesenPrefix({ device_name: "Meine Anlage" }, hass),
    "sensor.meine_anlage" // Basis bleibt stehen -> Card meldet ehrlich "nicht gefunden"
  );
});

test("_ph_firmware & Co. gelten nicht als pH-Sensor", () => {
  const hass = {
    states: states("sensor.anlage_ph_firmware", "sensor.anlage_ph_sollwert"),
    entities: registry("sensor.anlage_ph_firmware"),
  };
  assert.equal(aufloesenPrefix({ device_name: "Voellig Anders" }, hass), "sensor.voellig_anders");
});

test("ohne hass wird nicht geraten und nichts geworfen", () => {
  assert.equal(aufloesenPrefix({ device_name: "Pool" }, undefined), "sensor.pool");
  assert.equal(aufloesenPrefix({ entity_prefix: "sensor.x" }, undefined), "sensor.x");
  assert.equal(aufloesenPrefix({}, undefined), null);
  assert.equal(aufloesenPrefix({}, { states: {} }), null);
});

// ------------------------------------------------------------- setConfig
test("setConfig verlangt weiterhin device_name oder entity_prefix", () => {
  const karte = neueKarte();
  assert.throws(() => karte.setConfig({}), /device_name or entity_prefix/);
  assert.doesNotThrow(() => karte.setConfig({ device_name: "Pool" }));
  assert.doesNotThrow(() => karte.setConfig({ entity_prefix: "sensor.pool" }));
});

test("setConfig rechnet keinen Praefix mehr in die Config hinein", () => {
  const karte = neueKarte({ device_name: "Vigipool-Dosieranlage" });
  assert.equal(karte._config.entity_prefix, undefined);
  karte.hass = { states: states("sensor.vigipool_dosieranlage_ph") };
  assert.equal(karte._prefix, "sensor.vigipool_dosieranlage");
});

// --------------------------------------------- Stoerungsmeldung im Render
/** Sammelt alle Textbausteine aus einem lit-TemplateResult (ohne DOM). */
function textAus(knoten, raus = []) {
  if (knoten == null || typeof knoten === "boolean") return raus;
  if (Array.isArray(knoten)) {
    knoten.forEach((k) => textAus(k, raus));
  } else if (typeof knoten === "object") {
    if (Array.isArray(knoten.strings)) raus.push(...knoten.strings);
    if (Array.isArray(knoten.values)) knoten.values.forEach((v) => textAus(v, raus));
  } else {
    raus.push(String(knoten));
  }
  return raus;
}

function rendern(config, hass) {
  return textAus(neueKarte(config, hass).render()).join(" ");
}

const ALLE_ENTITIES = (prefix, zustand) => {
  const s = {};
  for (const suffix of ["_ph", "_orp_redox", "_ph_firmware"]) s[prefix + suffix] = { state: zustand, attributes: {} };
  return s;
};

test("fehlende Entity meldet 'nicht gefunden' statt 'Anlage offline'", () => {
  const text = rendern({ device_name: "Gibt Es Nicht" }, { states: {} });
  assert.match(text, /nicht gefunden/);
  assert.match(text, /sensor\.gibt_es_nicht_ph/);
  assert.doesNotMatch(text, /Anlage offline/);
});

test("vorhandene, aber unavailable Entity meldet weiterhin 'Anlage offline'", () => {
  const text = rendern(
    { device_name: "Pool" },
    { states: ALLE_ENTITIES("sensor.pool", "unavailable") }
  );
  assert.match(text, /Anlage offline/);
  assert.doesNotMatch(text, /nicht gefunden/);
});

test("mit echten Werten erscheint gar keine Stoerungsmeldung", () => {
  const text = rendern({ device_name: "Pool" }, { states: ALLE_ENTITIES("sensor.pool", "7.2") });
  assert.doesNotMatch(text, /Anlage offline/);
  assert.doesNotMatch(text, /nicht gefunden/);
});

test("der Stoerungsbanner liegt ausserhalb von .card-wrap (verdeckt nichts mehr)", () => {
  const karte = neueKarte({ device_name: "Pool" }, { states: ALLE_ENTITIES("sensor.pool", "unavailable") });
  const markup = karte.render().strings.join("\u0000");
  const bannerPos = markup.indexOf("offline-banner");
  const wrapPos = markup.indexOf('class="card-wrap');
  assert.ok(bannerPos === -1 || wrapPos === -1 || bannerPos < wrapPos,
    "offline-banner muss VOR .card-wrap stehen, sonst liegt er wieder darueber");
});

test("die entfernte Cloud-Entity wird nicht mehr abgefragt", () => {
  const quelle = fs.readFileSync(
    fileURLToPath(new URL("../tomtut-pool-dosing-vigipool-card.js", import.meta.url)), "utf8");
  for (const tot of ["cloud_verbindung", "show_cloud", "cloud-badge"]) {
    assert.equal(quelle.includes(tot), false, `toter Rest im Bundle: ${tot}`);
  }
});
