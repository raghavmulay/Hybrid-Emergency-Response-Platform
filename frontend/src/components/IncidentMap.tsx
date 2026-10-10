import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Incident, Responder } from '../types/incident';
import { PRIORITY_LABELS, STATUS_LABELS, AVAILABILITY_LABELS } from '../constants/incidentConfig';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#d97706',
  low:      '#2563eb',
};

const TYPE_EMOJI: Record<string, string> = {
  earthquake:             '🌍',
  flood:                  '🌊',
  cyclone:                '🌪️',
  landslide:              '⛰️',
  wildfire:               '🔥',
  building_collapse:      '🏚️',
  industrial_hazard:      '☣️',
  infrastructure_failure: '⚡',
  mass_casualty:          '🚨',
  other:                  '❓',
};

const AVAILABILITY_COLORS: Record<string, string> = {
  AVAILABLE: '#16a34a',
  BUSY:      '#ca8a04',
  OFFLINE:   '#6b7280',
};

const PING_STYLE = `<style>@keyframes herp-ping{75%,100%{transform:scale(2);opacity:0}}</style>`;

function incidentIcon(priority: string, type: string) {
  const color = PRIORITY_COLORS[priority] ?? '#6366f1';
  const emoji = TYPE_EMOJI[type] ?? '❗';
  const pulse = priority === 'critical'
    ? `<div style="position:absolute;inset:-5px;border-radius:50%;background:${color};opacity:0.3;animation:herp-ping 1.5s ease-out infinite"></div>`
    : '';
  return L.divIcon({
    className: '',
    html: `${PING_STYLE}
      <div style="position:relative;width:38px;height:38px">
        ${pulse}
        <div style="
          position:relative;z-index:1;
          width:38px;height:38px;
          background:${color};
          border-radius:50%;
          border:3px solid #fff;
          box-shadow:0 2px 12px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
          font-size:17px;line-height:1
        ">${emoji}</div>
      </div>`,
    iconSize:    [38, 38],
    iconAnchor:  [19, 19],
    popupAnchor: [0, -22],
  });
}

function responderIcon(availability: string) {
  const color = AVAILABILITY_COLORS[availability] ?? '#6b7280';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;
      background:${color};
      border-radius:8px;
      border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-size:15px
    ">🚑</div>`,
    iconSize:    [32, 32],
    iconAnchor:  [16, 16],
    popupAnchor: [0, -20],
  });
}

function MapFit({ incidents, responders }: { incidents: Incident[]; responders: Responder[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [
      ...incidents.filter((i) => i.latitude != null).map((i) => [i.latitude!, i.longitude!] as [number, number]),
      ...responders.filter((r) => r.latitude != null).map((r) => [r.latitude!, r.longitude!] as [number, number]),
    ];
    if (points.length === 0) return;
    if (points.length === 1) { map.setView(points[0], 13); return; }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
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
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
      {/* Legend bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: '6px 16px', padding: '8px 14px',
        backgroundColor: 'var(--bg-muted)', borderBottom: '1px solid var(--border)',
        fontSize: 11,
      }}>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>Priority:</span>
        {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
          <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: PRIORITY_COLORS[p], display: 'inline-block' }} />
            <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{p}</span>
          </span>
        ))}
        {responders.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13 }}>🚑</span>
            <span style={{ color: 'var(--text-muted)' }}>Responder</span>
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>
          {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
          {responders.length > 0 ? ` · ${responders.length} responder${responders.length !== 1 ? 's' : ''}` : ''}
        </span>
      </div>

      <div style={{ height, width: '100%' }}>
        <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFit incidents={incidents} responders={responders} />

          {incidents.map((inc) => (
            <Marker
              key={`inc-${inc.id}`}
              position={[inc.latitude!, inc.longitude!]}
              icon={incidentIcon(inc.priority, inc.type)}
            >
              <Popup maxWidth={260}>
                <div style={{ fontFamily: 'Inter, system-ui, sans-serif', minWidth: 210 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px',
                      borderRadius: 999, color: '#fff',
                      background: PRIORITY_COLORS[inc.priority] ?? '#6366f1',
                    }}>
                      {PRIORITY_LABELS[inc.priority]}
                    </span>
                    <span style={{ fontSize: 10, color: '#737373' }}>{STATUS_LABELS[inc.status]}</span>
                  </div>
                  <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 2px', color: '#0d0d0d' }}>
                    {inc.incident_number}
                  </p>
                  <p style={{ fontSize: 12, color: '#404040', margin: '0 0 4px' }}>{inc.title}</p>
                  {inc.address && (
                    <p style={{ fontSize: 11, color: '#737373', margin: '0 0 2px' }}>📍 {inc.address}</p>
                  )}
                  {inc.severity_score != null && (
                    <p style={{ fontSize: 11, color: '#737373', margin: 0 }}>
                      Severity: <strong>{inc.severity_score}/100</strong>
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {responders.map((r) => (
            <Marker key={`resp-${r.id}`} position={[r.latitude!, r.longitude!]} icon={responderIcon(r.availability)}>
              <Popup maxWidth={200}>
                <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 3px', color: '#0d0d0d' }}>{r.email}</p>
                  <p style={{ fontSize: 11, color: '#737373', margin: '0 0 2px' }}>{AVAILABILITY_LABELS[r.availability]}</p>
                  <p style={{ fontSize: 11, color: '#737373', margin: 0 }}>{r.active_assignments} active assignment(s)</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
