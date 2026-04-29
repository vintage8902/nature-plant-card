const NATURE_PLANT_CARD_VERSION = "0.2.2";

console.info(
  `%c NATURE-PLANT-CARD %c v${NATURE_PLANT_CARD_VERSION} `,
  "color: #EAD8B5; background: #1E3A2F; font-weight: 700;",
  "color: #1E3A2F; background: #A8C49A; font-weight: 700;",
);

const METRICS = [
  {
    key: "illuminance",
    icon: "mdi:white-balance-sunny",
    cls: "light",
    fallbackUnit: "lx",
    aliases: ["illuminance", "light", "lux", "ppfd", "dli"],
    max: 200,
    minAliases: ["min_illuminance", "minimum_illuminance", "min_light", "minimum_light", "min_lysstyrke"],
    maxAliases: ["max_illuminance", "maximum_illuminance", "max_light", "maximum_light", "maks_lysstyrke"],
  },
  {
    key: "moisture",
    icon: "mdi:water",
    cls: "moisture",
    fallbackUnit: "%",
    aliases: ["moisture", "humidity", "soil_moisture"],
    max: 100,
    minAliases: ["min_moisture", "minimum_moisture", "min_soil_moisture", "min_jordfuktighet"],
    maxAliases: ["max_moisture", "maximum_moisture", "max_soil_moisture", "maks_jordfuktighet"],
  },
  {
    key: "temperature",
    icon: "mdi:thermometer",
    cls: "",
    fallbackUnit: "°C",
    aliases: ["temperature", "temp", "soil_temperature"],
    max: 35,
    minAliases: ["min_temperature", "minimum_temperature", "min_temperatur"],
    maxAliases: ["max_temperature", "maximum_temperature", "maks_temperatur"],
  },
  {
    key: "conductivity",
    icon: "mdi:water-alert",
    cls: "warning",
    fallbackUnit: "µS/cm",
    aliases: ["conductivity", "fertility", "ec"],
    max: 200,
    minAliases: ["min_conductivity", "minimum_conductivity", "min_fertility", "min_ledning", "min_ledningsevne"],
    maxAliases: ["max_conductivity", "maximum_conductivity", "max_fertility", "maks_ledning", "maks_ledningsevne"],
  },
];

class NaturePlantCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("nature-plant-card-editor");
  }

  static getStubConfig() {
    return {
      entity: "plant.my_plant",
      name: "Jungle Pal",
      species: "Alocasia zebrina",
    };
  }

  setConfig(config) {
    if (!config?.entity) {
      throw new Error("You need to define a plant entity");
    }

    this.config = {
      sensors: {},
      colors: {},
      ranges: {},
      ...config,
    };

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 4;
  }

  _state(entityId) {
    return entityId ? this._hass?.states?.[entityId] : null;
  }

  _friendlyName(entityId) {
    const stateObj = this._state(entityId);
    return stateObj?.attributes?.friendly_name || entityId;
  }

  _slug(entityId) {
    return entityId?.split(".")[1] || "";
  }

  _escape(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  _plantDeviceId() {
    return this._hass?.entities?.[this.config.entity]?.device_id || null;
  }

  _entityMatchesMetric(entityId, metric) {
    const entity = this._hass?.entities?.[entityId] || {};
    const stateObj = this._state(entityId);
    const haystack = [
      entityId,
      entity.name,
      entity.original_name,
      stateObj?.attributes?.friendly_name,
      stateObj?.attributes?.device_class,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return metric.aliases.some((alias) => haystack.includes(alias));
  }

  _entityMatchesAliases(entityId, aliases) {
    const entity = this._hass?.entities?.[entityId] || {};
    const stateObj = this._state(entityId);
    const haystack = [
      entityId,
      entity.name,
      entity.original_name,
      stateObj?.attributes?.friendly_name,
      stateObj?.attributes?.device_class,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return aliases.some((alias) => haystack.includes(alias));
  }

  _findSensor(metric) {
    const manual = this.config.sensors?.[metric.key];
    if (manual) return manual;

    const plantAttrs = this._state(this.config.entity)?.attributes || {};
    const attrValue = plantAttrs[metric.key] || plantAttrs[`${metric.key}_sensor`];
    if (typeof attrValue === "string" && attrValue.includes(".")) return attrValue;

    const allSensors = Object.keys(this._hass?.states || {}).filter((entityId) => entityId.startsWith("sensor."));
    const deviceId = this._plantDeviceId();

    if (deviceId) {
      const sameDevice = allSensors.find((entityId) => {
        return this._hass?.entities?.[entityId]?.device_id === deviceId && this._entityMatchesMetric(entityId, metric);
      });
      if (sameDevice) return sameDevice;
    }

    const slug = this._slug(this.config.entity).replace(/^plant_/, "");
    return (
      allSensors.find((entityId) => {
        const id = this._slug(entityId);
        return id.includes(slug) && this._entityMatchesMetric(entityId, metric);
      }) ||
      allSensors.find((entityId) => this._entityMatchesMetric(entityId, metric)) ||
      null
    );
  }

  _findRangeSensor(metric, side) {
    const configured = this.config.ranges?.[metric.key]?.[side];
    if (configured && String(configured).includes(".")) return configured;

    const aliases = side === "min" ? metric.minAliases || [] : metric.maxAliases || [];
    if (!aliases.length) return null;

    const allRangeEntities = Object.keys(this._hass?.states || {}).filter((entityId) => {
      return entityId.startsWith("sensor.") || entityId.startsWith("number.");
    });
    const deviceId = this._plantDeviceId();

    if (deviceId) {
      const sameDevice = allRangeEntities.find((entityId) => {
        return this._hass?.entities?.[entityId]?.device_id === deviceId && this._entityMatchesAliases(entityId, aliases);
      });
      if (sameDevice) return sameDevice;
    }

    const slug = this._slug(this.config.entity).replace(/^plant_/, "");
    return (
      allRangeEntities.find((entityId) => {
        const id = this._slug(entityId);
        return id.includes(slug) && this._entityMatchesAliases(entityId, aliases);
      }) ||
      allRangeEntities.find((entityId) => this._entityMatchesAliases(entityId, aliases)) ||
      null
    );
  }

  _rangeValue(metric, side) {
    const configured = this.config.ranges?.[metric.key]?.[side];
    if (configured !== undefined && configured !== null && configured !== "" && !String(configured).includes(".")) {
      return Number(configured);
    }

    const sensor = this._findRangeSensor(metric, side);
    const value = Number(this._state(sensor)?.state);
    return Number.isFinite(value) ? value : null;
  }

  _metricData(metric) {
    const entityId = this._findSensor(metric);
    const stateObj = this._state(entityId);
    const raw = stateObj?.state;
    const value = raw && !["unknown", "unavailable"].includes(raw) ? raw : "-";
    const unit = stateObj?.attributes?.unit_of_measurement || metric.fallbackUnit;
    const numeric = Number(value);
    const min = this._rangeValue(metric, "min");
    const idealMax = this._rangeValue(metric, "max");
    const scaleMax = Math.max(
      Number(this.config.ranges?.[metric.key]?.scale_max || 0),
      idealMax || 0,
      metric.max,
      Number.isFinite(numeric) ? numeric : 0,
    );
    const marker = Number.isFinite(numeric) && scaleMax > 0 ? Math.max(0, Math.min(100, (numeric / scaleMax) * 100)) : 0;
    const rangeStart = min !== null && scaleMax > 0 ? Math.max(0, Math.min(100, (min / scaleMax) * 100)) : 0;
    const rangeEnd = idealMax !== null && scaleMax > 0 ? Math.max(0, Math.min(100, (idealMax / scaleMax) * 100)) : 100;
    const rangeWidth = Math.max(0, rangeEnd - rangeStart);
    const outside =
      Number.isFinite(numeric) &&
      ((min !== null && numeric < min) || (idealMax !== null && numeric > idealMax));

    return { entityId, value, unit, marker, rangeStart, rangeWidth, outside };
  }

  _displayData() {
    const plant = this._state(this.config.entity);
    const attrs = plant?.attributes || {};
    return {
      name: this.config.name || attrs.friendly_name || this._friendlyName(this.config.entity) || "Plant",
      species:
        this.config.species ||
        attrs.species ||
        attrs.scientific_name ||
        attrs.plant_species ||
        attrs.display_species ||
        "",
      image: this.config.image || attrs.entity_picture || attrs.image || attrs.picture || "",
    };
  }

  _render() {
    if (!this.shadowRoot || !this._hass || !this.config) return;

    const data = this._displayData();
    const backgroundImage = this.config.background_image || "";
    const colors = {
      surface: "rgba(60, 94, 74, 0.72)",
      border: "rgba(168, 196, 154, 0.18)",
      accent: "#A8C49A",
      text: "#EAD8B5",
      muted: "rgba(234,216,181,0.84)",
      light: "#F2C75D",
      moisture: "#86B8C8",
      warning: "#E9695A",
      track: "rgba(168,196,154,0.16)",
      ...this.config.colors,
    };

    const metrics = METRICS.map((metric) => {
      const item = this._metricData(metric);
      return `
        <div class="metric ${metric.cls}">
          <ha-icon icon="${metric.icon}"></ha-icon>
          <div class="range-bar ${item.outside ? "outside" : ""}">
            <span class="ideal" style="left:${item.rangeStart}%; width:${item.rangeWidth}%"></span>
            <span class="marker" style="left:${item.marker}%"></span>
          </div>
          <div class="value">${item.value} <small>${item.unit}</small></div>
        </div>
      `;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --npc-surface: ${colors.surface};
          --npc-border: ${colors.border};
          --npc-accent: ${colors.accent};
          --npc-text: ${colors.text};
          --npc-muted: ${colors.muted};
          --npc-light: ${colors.light};
          --npc-moisture: ${colors.moisture};
          --npc-warning: ${colors.warning};
          --npc-track: ${colors.track};
        }

        ha-card {
          height: ${this.config.height || 150}px;
          padding: 0;
          border-radius: 18px;
          background: var(--npc-surface);
          border: 1px solid var(--npc-border);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 26px rgba(0,0,0,0.18);
          overflow: hidden;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: 42% 58%;
          position: relative;
        }

        ha-card::before {
          content: ${backgroundImage ? '""' : "none"};
          position: absolute;
          inset: 0;
          background-image: url("${this._escape(backgroundImage)}");
          background-size: cover;
          background-position: center;
          pointer-events: none;
        }

        ha-card > * {
          position: relative;
          z-index: 1;
        }

        .left {
          position: relative;
          height: 100%;
          display: grid;
          grid-template-rows: 1fr auto auto;
          justify-items: center;
          align-items: center;
          padding: 12px 10px;
          box-sizing: border-box;
          overflow: hidden;
          border-right: 1px solid var(--npc-border);
        }

        .left::before {
          content: none;
        }

        .image {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: linear-gradient(145deg, rgba(233,241,232,0.72), rgba(168,196,154,0.42));
          border: 2px solid color-mix(in srgb, var(--npc-accent) 82%, transparent);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.24), 0 10px 22px rgba(0,0,0,0.20);
          overflow: hidden;
          display: grid;
          place-items: center;
          z-index: 1;
        }

        .image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .image ha-icon {
          width: 38px;
          height: 38px;
          color: var(--npc-accent);
        }

        .name {
          z-index: 1;
          color: var(--npc-text);
          font-size: 16px;
          font-weight: 800;
          line-height: 19px;
          margin-top: 6px;
          text-shadow: 0 1px 2px rgba(15,36,28,0.35);
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .species {
          z-index: 1;
          color: var(--npc-muted);
          font-size: 12px;
          line-height: 15px;
          margin-top: 2px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .metrics {
          height: 100%;
          display: grid;
          align-content: center;
          gap: 10px;
          padding: 12px 14px;
          box-sizing: border-box;
        }

        .metric {
          display: grid;
          grid-template-columns: 22px 1fr minmax(62px, auto);
          gap: 9px;
          align-items: center;
          color: var(--npc-text);
        }

        .metric ha-icon {
          width: 21px;
          height: 21px;
          color: var(--npc-accent);
        }

        .metric.light ha-icon {
          color: var(--npc-light);
        }

        .metric.moisture ha-icon {
          color: var(--npc-moisture);
        }

        .metric.warning ha-icon {
          color: var(--npc-warning);
        }

        .range-bar {
          position: relative;
          height: 7px;
          border-radius: 999px;
          background: var(--npc-track);
        }

        .ideal {
          position: absolute;
          top: 0;
          display: block;
          height: 100%;
          border-radius: 999px;
          background: var(--npc-accent);
        }

        .marker {
          position: absolute;
          top: 50%;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--npc-text);
          border: 1px solid rgba(15,36,28,0.55);
          box-shadow: 0 0 0 2px rgba(234,216,181,0.14);
          transform: translate(-50%, -50%);
        }

        .range-bar.outside .marker {
          background: var(--npc-warning);
          box-shadow: 0 0 0 2px rgba(233,105,90,0.18);
        }

        .metric.light .ideal {
          background: linear-gradient(90deg, var(--npc-light), var(--npc-text));
        }

        .metric.moisture .ideal {
          background: linear-gradient(90deg, var(--npc-moisture), var(--npc-accent));
        }

        .metric.warning .ideal {
          background: linear-gradient(90deg, var(--npc-warning), #F07C6D);
        }

        .value {
          font-size: 13px;
          font-weight: 700;
          text-align: right;
          white-space: nowrap;
        }

        .value small {
          color: color-mix(in srgb, var(--npc-text) 78%, transparent);
          font-size: 10px;
          font-weight: 600;
        }
      </style>

      <ha-card>
        <div class="left">
          <div class="image">
            ${
              data.image
                ? `<img src="${this._escape(data.image)}" alt="">`
                : `<ha-icon icon="mdi:sprout"></ha-icon>`
            }
          </div>
          <div class="name">${this._escape(data.name)}</div>
          <div class="species">${this._escape(data.species)}</div>
        </div>
        <div class="metrics">${metrics}</div>
      </ha-card>
    `;
  }
}

customElements.define("nature-plant-card", NaturePlantCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "nature-plant-card",
  name: "Nature Plant Card",
  description: "Nature-inspired plant monitor card",
});

class NaturePlantCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  set hass(hass) {
    this._hass = hass;
    if (this.config && !this._renderedWithHass) this._render();
  }

  setConfig(config) {
    this.config = {
      sensors: {},
      colors: {},
      ranges: {},
      ...config,
    };
    this._render();
  }

  _fireConfigChanged(config) {
    this.config = config;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      }),
    );
    this._render();
  }

  _setValue(key, value) {
    const config = { ...this.config };
    if (value) {
      config[key] = value;
    } else {
      delete config[key];
    }
    this._fireConfigChanged(config);
  }

  _setNested(section, key, value) {
    const next = { ...(this.config[section] || {}) };
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    const config = { ...this.config };
    if (Object.keys(next).length) {
      config[section] = next;
    } else {
      delete config[section];
    }
    this._fireConfigChanged(config);
  }

  _escape(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  _input(label, value, placeholder = "") {
    return `
      <label>
        <span>${label}</span>
        <input value="${this._escape(value)}" placeholder="${this._escape(placeholder)}">
      </label>
    `;
  }

  _entityPicker(label, value, domains, cls) {
    const entities = Object.keys(this._hass?.states || {})
      .filter((entityId) => domains.some((domain) => entityId.startsWith(`${domain}.`)))
      .sort((a, b) => {
        const aName = this._hass.states[a]?.attributes?.friendly_name || a;
        const bName = this._hass.states[b]?.attributes?.friendly_name || b;
        return aName.localeCompare(bName);
      });

    const selectedName = this._hass?.states?.[value]?.attributes?.friendly_name;
    const displayValue = selectedName ? `${selectedName} (${value})` : value || "";

    return `
      <label>
        <span>${label}</span>
        <div class="entity-combo ${cls}">
          <input class="entity-input" value="${this._escape(displayValue)}" placeholder="Search entity" autocomplete="off">
          <div class="entity-options">
            ${entities
              .map((entityId) => {
                const name = this._hass.states[entityId]?.attributes?.friendly_name || entityId;
                return `
                  <button type="button" class="entity-option" data-entity="${this._escape(entityId)}">
                    <span>${this._escape(name)}</span>
                    <small>${this._escape(entityId)}</small>
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
      </label>
    `;
  }

  _render() {
    if (!this.shadowRoot || !this.config) return;
    if (this._hass) this._renderedWithHass = true;

    const sensors = this.config.sensors || {};
    const colors = this.config.colors || {};

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--primary-text-color);
        }

        .editor {
          display: grid;
          gap: 18px;
          padding: 16px;
        }

        .section {
          display: grid;
          gap: 12px;
        }

        h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        label {
          display: grid;
          gap: 6px;
          color: var(--secondary-text-color);
          font-size: 12px;
        }

        input {
          width: 100%;
          min-height: 56px;
          box-sizing: border-box;
          border: 0;
          border-bottom: 1px solid var(--primary-color);
          border-radius: 4px 4px 0 0;
          padding: 18px 16px 6px;
          background: var(--secondary-background-color, #303030);
          color: var(--primary-text-color);
          font: inherit;
          outline: none;
        }

        input::placeholder {
          color: var(--secondary-text-color);
          opacity: 1;
        }

        input:focus {
          border-bottom-color: var(--primary-color);
          box-shadow: inset 0 -1px 0 var(--primary-color);
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        details {
          border: 1px solid var(--divider-color);
          border-radius: 12px;
          padding: 12px;
        }

        summary {
          cursor: pointer;
          font-weight: 600;
        }

        .details-content {
          display: grid;
          gap: 10px;
          margin-top: 12px;
        }

        .entity-combo {
          position: relative;
        }

        .entity-options {
          position: absolute;
          z-index: 10;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          max-height: 220px;
          overflow-y: auto;
          display: none;
          border-radius: 0 0 4px 4px;
          background: var(--secondary-background-color, #303030);
          box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.24));
        }

        .entity-combo.open .entity-options {
          display: block;
        }

        .entity-option {
          width: 100%;
          display: grid;
          gap: 2px;
          padding: 9px 12px;
          border: 0;
          background: transparent;
          color: var(--primary-text-color);
          text-align: left;
          font: inherit;
        }

        .entity-option:hover,
        .entity-option:focus {
          background: var(--secondary-background-color);
        }

        .entity-option small {
          color: var(--secondary-text-color);
          font-size: 11px;
        }

        .entity-option[hidden] {
          display: none;
        }
      </style>

      <div class="editor">
        <div class="section">
          <h3>Plant</h3>
          ${this._entityPicker("Plant entity", this.config.entity, ["plant"], "plant-entity")}
          <div class="grid">
            ${this._input("Name (Optional)", this.config.name, "Uses plant name")}
            ${this._input("Species (Optional)", this.config.species, "Uses plant species")}
            ${this._input("Image (Optional)", this.config.image)}
            ${this._input("Background image (Optional)", this.config.background_image)}
            ${this._input("Height", this.config.height, "150")}
          </div>
        </div>

        <details>
          <summary>Sensor overrides</summary>
          <div class="details-content grid">
            ${METRICS.map((metric) =>
              this._entityPicker(metric.key, sensors[metric.key], ["sensor"], `sensor-${metric.key}`),
            ).join("")}
          </div>
        </details>

        <details>
          <summary>Colors</summary>
          <div class="details-content grid">
            ${[
              ["surface", "Surface"],
              ["border", "Border"],
              ["accent", "Accent"],
              ["text", "Text"],
              ["muted", "Muted text"],
              ["light", "Light"],
              ["moisture", "Moisture"],
              ["warning", "Warning"],
              ["track", "Track"],
            ]
              .map(([key, label]) => this._input(label, colors[key], key === "accent" ? "#A8C49A" : ""))
              .join("")}
          </div>
        </details>
      </div>
    `;

    this._bindEntityCombo(".plant-entity", (value) => this._setValue("entity", value));

    METRICS.forEach((metric) => {
      this._bindEntityCombo(`.sensor-${metric.key}`, (value) => this._setNested("sensors", metric.key, value));
    });

    const topInputs = this.shadowRoot.querySelectorAll(".section .grid input");
    ["name", "species", "image", "background_image", "height"].forEach((key, index) => {
      topInputs[index]?.addEventListener("change", (ev) => this._setValue(key, ev.target.value.trim()));
    });

    const colorInputs = this.shadowRoot.querySelectorAll("details:nth-of-type(2) input");
    ["surface", "border", "accent", "text", "muted", "light", "moisture", "warning", "track"].forEach((key, index) => {
      colorInputs[index]?.addEventListener("change", (ev) => this._setNested("colors", key, ev.target.value.trim()));
    });
  }

  _bindEntityCombo(selector, callback) {
    const combo = this.shadowRoot.querySelector(selector);
    const input = combo?.querySelector(".entity-input");
    const options = combo?.querySelectorAll(".entity-option") || [];

    input?.addEventListener("focus", () => combo.classList.add("open"));
    input?.addEventListener("input", (ev) => {
      const query = ev.target.value.toLowerCase();
      combo.classList.add("open");
      options.forEach((option) => {
        option.hidden = !option.textContent.toLowerCase().includes(query);
      });
    });
    input?.addEventListener("change", (ev) => {
      const value = ev.target.value.trim();
      const directEntity = value.match(/([a-z_]+\.[^) ]+)/)?.[1] || value;
      callback(directEntity);
    });
    options.forEach((option) => {
      option.addEventListener("click", (ev) => {
        ev.preventDefault();
        callback(ev.currentTarget.dataset.entity);
      });
    });
  }
}

customElements.define("nature-plant-card-editor", NaturePlantCardEditor);
