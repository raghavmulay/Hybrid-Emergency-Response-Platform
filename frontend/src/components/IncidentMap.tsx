import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Incident, Responder } from '../types/incident';
import { PRIORITY_BADGE_CLASSES, PRIORITY_LABELS, STATUS_LABELS, AVAILABILITY_LABELS } from '../constants/incidentConfig';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#2563eb',
};

const AVAILABILITY_COLORS: Record<string, string> = {
  AVAILABLE: '#16a34a',
  BUSY: '#ca8a04',
  OFFLINE: '#6b7280',
};

function incidentIcon(priority: string) {
  const color = PRIORITY_COLORS[priority] ?? '#6366f1';
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

function responderIcon(availability: string) {
  const color = AVAILABILITY_COLORS[availability] ?? '#6b7280';
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;background:${color};border-radius:4px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:12px">🚑</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
  });
}

function MapFit({ incidents, responders }: { incidents: Incident[]; responders: Responder[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [
      ...incidents.filter((i) => i.latitude != null && i.longitude != null).map((i) => [i.latitude!, i.longitude!] as [number, number]),
      ...responders.filter((r) => r.latitude != null && r.longitude != null).map((r) => [r.latitude!, r.longitude!] as [number, number]),
    ];
    if (points.length === 0) return;
    if (points.length === 1) { map.setView(points[0], 13); return; }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
  }, [map, incidents, responders]);
  return null;
}

interface Props {
  incidents: Incident[];
  responders: Responder[];
  height?: string;
}

export default function IncidentMap({ incidents, responders, height = '420px' }: Props) {
  const center: [number, number] = incidents[0]?.latitude != null
    ? [incidents[0].latitude!, incidents[0].longitude!]
    : [18.5204, 73.8567];

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-md">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300">
          <span className="inline-block w-3 h-3 rounded-full bg-red-600" /> Incidents
        </span>
        <span className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300">
          <span className="inline-block w-3 h-3 rounded bg-green-600" /> Responders
        </span>
        <span className="text-gray-400">{incidents.length} incidents · {responders.length} responders plotted</span>
      </div>
      <div style={{ height, width: '100%' }}>
        <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFit incidents={incidents} responders={responders} />

          {incidents.map((inc) => (
            <Marker key={`inc-${inc.id}`} position={[inc.latitude!, inc.longitude!]} icon={incidentIcon(inc.priority)}>
              <Popup maxWidth={240}>
                <div className="space-y-1 text-sm">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE_CLASSES[inc.priority]}`}>
                    {PRIORITY_LABELS[inc.priority]}
                  </span>
                  <p className="font-bold text-gray-900 mt-1">{inc.incident_number}</p>
                  <p className="text-gray-700">{inc.title}</p>
                  <p className="text-xs text-gray-500">{STATUS_LABELS[inc.status] ?? inc.status}</p>
                  {inc.address && <p className="text-xs text-gray-500">📍 {inc.address}</p>}
                </div>
              </Popup>
            </Marker>
          ))}

          {responders.map((r) => (
            <Marker key={`resp-${r.id}`} position={[r.latitude!, r.longitude!]} icon={responderIcon(r.availability)}>
              <Popup maxWidth={200}>
                <div className="space-y-1 text-sm">
                  <p className="font-bold text-gray-900">{r.email}</p>
                  <p className="text-xs">{AVAILABILITY_LABELS[r.availability]}</p>
                  <p className="text-xs text-gray-500">{r.active_assignments} active assignment(s)</p>
                  <p className="text-xs text-gray-400 font-mono">
                    {r.latitude?.toFixed(5)}, {r.longitude?.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
