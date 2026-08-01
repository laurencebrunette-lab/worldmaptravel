(function () {
  "use strict";

  // ---- state -----------------------------------------------------------
  let nextId = 1;
  const trip = []; // ordered list of { id, name, lat, lng }
  const legs = []; // parallel to consecutive city pairs: { status: 'loading' | 'done', ... }
  let pendingClickResolve = false;

  // ---- map setup ---------------------------------------------------------
  const map = L.map("map", { worldCopyJump: true }).setView([20, 10], 2.3);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  const lineLayer = L.layerGroup().addTo(map);

  if (typeof initWorldLayers === "function") {
    initWorldLayers(map, {
      onCityClick: (city) => {
        addCity({ name: city.name, native: city.native, lat: city.lat, lng: city.lng });
      },
    });
  }

  map.on("click", async (e) => {
    if (pendingClickResolve) return;
    pendingClickResolve = true;

    const tempMarker = L.circleMarker(e.latlng, {
      radius: 6,
      color: "#4fb0ff",
      fillColor: "#4fb0ff",
      fillOpacity: 0.6,
    }).addTo(map);

    try {
      const place = await reverseGeocode(e.latlng.lat, e.latlng.lng);
      addCity(place);
    } catch (err) {
      showToast("Couldn't identify that location. Try again or use search.");
      console.error(err);
    } finally {
      map.removeLayer(tempMarker);
      pendingClickResolve = false;
    }
  });

  // ---- search box --------------------------------------------------------
  const searchInput = document.getElementById("city-search");
  const searchResultsEl = document.getElementById("search-results");
  let searchTimer = null;

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const query = searchInput.value;
    if (query.trim().length < 2) {
      hideSearchResults();
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const results = await searchPlaces(query);
        renderSearchResults(results);
      } catch (err) {
        console.error(err);
        showToast("Search failed. Check your connection and try again.");
      }
    }, 350);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) hideSearchResults();
  });

  function renderSearchResults(results) {
    searchResultsEl.innerHTML = "";
    if (!results.length) {
      hideSearchResults();
      return;
    }
    results.forEach((r) => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.innerHTML = `<div class="place-name">${escapeHtml(r.name)}</div><div class="place-detail">${escapeHtml(r.detail)}</div>`;
      item.addEventListener("click", () => {
        addCity({ name: r.name, lat: r.lat, lng: r.lng });
        map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 6));
        searchInput.value = "";
        hideSearchResults();
      });
      searchResultsEl.appendChild(item);
    });
    searchResultsEl.classList.remove("hidden");
  }

  function hideSearchResults() {
    searchResultsEl.classList.add("hidden");
  }

  // ---- trip mutation ------------------------------------------------------
  function addCity(place) {
    const city = { id: nextId++, name: place.name, native: place.native || null, lat: place.lat, lng: place.lng };
    trip.push(city);

    if (trip.length > 1) {
      const legIndex = legs.length;
      legs.push({ status: "loading" });
      renderAll();

      const delay = 900 + Math.random() * 700;
      setTimeout(() => {
        const from = trip[legIndex];
        const to = trip[legIndex + 1];
        const { distanceKm, costs } = estimateLegCosts(from, to);
        legs[legIndex] = {
          status: "done",
          distanceKm,
          costs,
          selectedMode: cheapestAvailableMode(costs),
        };
        renderAll();
      }, delay);
    } else {
      renderAll();
    }
  }
  window.__removeCity = removeCity;
  function removeCity(id) {
    const idx = trip.findIndex((c) => c.id === id);
    if (idx === -1) return;
    trip.splice(idx, 1);
    legs.length = 0;
    for (let i = 0; i < trip.length - 1; i++) {
      const { distanceKm, costs } = estimateLegCosts(trip[i], trip[i + 1]);
      legs.push({ status: "done", distanceKm, costs, selectedMode: cheapestAvailableMode(costs) });
    }
    renderAll();
  }

  function setLegMode(legIndex, mode) {
    const leg = legs[legIndex];
    if (!leg || leg.status !== "done" || leg.costs[mode] == null) return;
    leg.selectedMode = mode;
    renderAll();
  }
  window.__setLegMode = setLegMode;

  function clearTrip() {
    trip.length = 0;
    legs.length = 0;
    renderAll();
  }
  document.getElementById("clear-trip").addEventListener("click", clearTrip);

  // ---- rendering ------------------------------------------------------------
  const listEl = document.getElementById("itinerary-list");
  const emptyHintEl = document.getElementById("itinerary-empty");
  const cityCountEl = document.getElementById("city-count");
  const tripTotalEl = document.getElementById("trip-total");
  const clearBtn = document.getElementById("clear-trip");

  function renderAll() {
    renderMarkers();
    renderPolylines();
    renderItinerary();
    renderTotals();
  }

  function renderMarkers() {
    markerLayer.clearLayers();
    trip.forEach((city, i) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="city-marker-icon">${i + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker([city.lat, city.lng], { icon }).addTo(markerLayer);
      const nativeLine = city.native ? `<br/><em>${escapeHtml(city.native)}</em>` : "";
      marker.bindPopup(
        `<strong>${escapeHtml(city.name)}</strong>${nativeLine}<br/><a href="#" data-remove-id="${city.id}">Remove</a>`
      );
      marker.on("popupopen", () => {
        const link = document.querySelector(`[data-remove-id="${city.id}"]`);
        if (link) {
          link.addEventListener("click", (e) => {
            e.preventDefault();
            removeCity(city.id);
          });
        }
      });
    });
  }

  function renderPolylines() {
    lineLayer.clearLayers();
    for (let i = 0; i < trip.length - 1; i++) {
      const from = trip[i];
      const to = trip[i + 1];
      const leg = legs[i];
      const color = leg && leg.status === "done" ? modeColor(leg.selectedMode) : "#6b7c8f";
      L.polyline(
        [
          [from.lat, from.lng],
          [to.lat, to.lng],
        ],
        {
          color,
          weight: 2.5,
          dashArray: leg && leg.status === "loading" ? "6 6" : null,
          opacity: 0.85,
        }
      ).addTo(lineLayer);
    }
  }

  function renderItinerary() {
    listEl.innerHTML = "";
    emptyHintEl.classList.toggle("hidden", trip.length > 0);
    clearBtn.disabled = trip.length === 0;
    cityCountEl.textContent = trip.length;

    trip.forEach((city, i) => {
      const li = document.createElement("li");
      li.className = "city-node";
      const nativeSpan = city.native
        ? `<span class="city-name-native">${escapeHtml(city.native)}</span>`
        : "";
      li.innerHTML = `
        <span class="city-badge">${i + 1}</span>
        <span class="city-name">${escapeHtml(city.name)}${nativeSpan}</span>
        <button class="city-remove" title="Remove city">✕</button>
      `;
      li.querySelector(".city-remove").addEventListener("click", () => removeCity(city.id));
      listEl.appendChild(li);

      if (i < trip.length - 1) {
        listEl.appendChild(renderLegCard(legs[i], i));
      }
    });
  }

  function renderLegCard(leg, index) {
    const wrapper = document.createElement("li");
    wrapper.className = "leg-card";

    if (!leg || leg.status === "loading") {
      wrapper.classList.add("loading");
      wrapper.innerHTML = `<span class="spinner"></span> Estimating fares…`;
      return wrapper;
    }

    const distanceLabel = `${Math.round(leg.distanceKm).toLocaleString()} km`;
    const modeRows = Object.keys(leg.costs)
      .map((mode) => {
        const price = leg.costs[mode];
        const cfg = MODES[mode];
        const available = price != null;
        const checked = leg.selectedMode === mode ? "checked" : "";
        return `
          <label class="mode-option mode-${mode} ${available ? "" : "unavailable"}">
            <input type="radio" name="leg-${index}-mode" value="${mode}" ${checked} ${available ? "" : "disabled"} />
            <span class="mode-icon">${cfg.icon}</span>
            <span class="mode-label">${cfg.label}</span>
            <span class="mode-price">${available ? "$" + price.toLocaleString() : "n/a"}</span>
          </label>
        `;
      })
      .join("");

    wrapper.innerHTML = `
      <div class="leg-distance">${distanceLabel} between stops</div>
      <div class="mode-options">${modeRows}</div>
    `;

    wrapper.querySelectorAll(`input[name="leg-${index}-mode"]`).forEach((input) => {
      input.addEventListener("change", () => setLegMode(index, input.value));
    });

    return wrapper;
  }

  function renderTotals() {
    const total = legs.reduce((sum, leg) => {
      if (leg && leg.status === "done" && leg.costs[leg.selectedMode] != null) {
        return sum + leg.costs[leg.selectedMode];
      }
      return sum;
    }, 0);
    tripTotalEl.textContent = `$${total.toLocaleString()}`;
  }

  function modeColor(mode) {
    return { plane: "#4fb0ff", train: "#35d49c", bus: "#ffb454", taxi: "#ff6b81" }[mode] || "#6b7c8f";
  }

  // ---- misc helpers -----------------------------------------------------
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  let toastTimer = null;
  function showToast(message) {
    let toast = document.getElementById("app-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "app-toast";
      toast.style.cssText =
        "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1c2836;color:#e7edf3;border:1px solid #263241;padding:10px 16px;border-radius:8px;font-size:0.85rem;z-index:2000;box-shadow:0 8px 24px rgba(0,0,0,0.4);";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.style.display = "none"), 4000);
  }

  renderAll();
})();
