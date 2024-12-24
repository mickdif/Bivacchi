import 'ol/ol.css'; // Importa lo stile
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import Overlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';

// Creazione della mappa di base
const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM(), // Mappa di base OpenStreetMap
    }),
  ],
  view: new View({
    center: fromLonLat([9.5, 45.5]), // Lombardia
    zoom: 8,
  }),
});

// Funzione per caricare i dati
async function loadShelters() {
  const query = `
[out:json][timeout:25];
area["name"="Lombardia"]->.searchArea;
(
  node["tourism"~"wilderness_hut|alpine_hut"](area.searchArea);
  node["shelter_type"="basic_hut"](area.searchArea);
  way["tourism"~"wilderness_hut|alpine_hut"](area.searchArea);
  way["shelter_type"="basic_hut"](area.searchArea);
  relation["tourism"~"wilderness_hut|alpine_hut"](area.searchArea);
  relation["shelter_type"="basic_hut"](area.searchArea);
);
out body geom;
  `;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const features = data.elements
      .map((el) => {
        const info = {
          name: el.tags.name || false,
          operator: el.tags.operator || false,
          description: el.tags.description || false,
          capacity: el.tags.capacity || el.tags.beds || false,
          water: el.tags.drinking_water || false,
          opening: el.tags.opening_hours || false,
          addr: el.tags.addr || false,
          city: el.tags.city || false,
          mattress: el.tags.mattress || false,
        }
        if (info.name && el.type === 'node') {
          return new Feature({
            geometry: new Point(fromLonLat([el.lon, el.lat])),
            ... info,
          });
        } else if (info.name && el.type === 'way') {
          return new Feature({
            geometry: new Point(fromLonLat([el.bounds.minlon, el.bounds.minlat])),
            ... info,
          });
        }
        return null;
      })
      .filter(Boolean);

    const vectorSource = new VectorSource({
      features,
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: 'red' }),
          stroke: new Stroke({ color: 'white', width: 2 }),
        }),
      }),
    });

    map.addLayer(vectorLayer);

    const overlay = new Overlay({
      element: document.createElement('div'),
      autoPan: true,
      autoPanAnimation: { duration: 250 },
    });
    map.addOverlay(overlay);

    map.on('click', (event) => {
      overlay.setPosition(undefined);
      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const coord = feature.getGeometry().getCoordinates();
        const name = feature.get('name');
        const description = feature.get('description');
        const operator = feature.get("operator");
        const capacity = feature.get("capacity");
        const opening = feature.get("opening");
        const water = feature.get("water");
        const addr = feature.get("addr");
        const city = feature.get("city");
        const mattress = feature.get("mattress");
        // Crea dinamicamente il contenuto del popup solo se i valori esistono
        let popupContent = '<div style="background: white; padding: 5px; border: 1px solid black;">';
        if (name) popupContent += `<strong>${name}</strong><br>`;
        if (description) popupContent += `Info: ${description}<br>`;
        if (operator) { popupContent += `Gestione: ${operator}<br>`;}
        if (capacity) { popupContent += `Posti letto: ${capacity}<br>`;}
        if (mattress) { popupContent += `Materassi: ${mattress}<br>`;}
        if (opening) { popupContent += `Apertra: ${opening}<br>`;}
        if (water) { popupContent += `Acqua: ${water}<br>`;}
        if (addr) { popupContent += `Località: ${addr}<br>`;}
        if (city) { popupContent += `Paese: ${city}<br>`;}
        popupContent += '</div>';

        // Mostra il popup solo se c'è contenuto significativo
        if (name || description || operator) {
          overlay.getElement().innerHTML = popupContent;
          overlay.setPosition(coord);
        }
      });
    });
  } catch (error) {
    console.error('Errore nel caricamento dei dati:', error);
  }
}

loadShelters();
