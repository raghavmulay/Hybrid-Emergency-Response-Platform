import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet marker icons when bundled with Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#d97706',
  LOW: '#2563eb',
};

function createIcon(priority: string | null | undefined, isSelected: boolean = false) {
  const color = PRIORITY_COLORS[priority ?? ''] ?? '#6366f1';
  const size = isSelected ? 36 : 28;
  const anchor = isSelected ? 18 : 14;
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:${size}px; height:${size}px;">
        <div style="
          background:${color};
          width:${size}px;
          height:${size}px;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:${isSelected ? '4px solid #facc15' : '3px solid white'};
          box-shadow:0 3px 10px rgba(0,0,0,0.4);
          animation:${isSelected ? 'pulse 1.5s infinite' : 'none'};
        "></div>
        <div style="
          position:absolute;
          top:50%;
          left:50%;
          transform:translate(-50%, -50%);
          font-size:${isSelected ? '14px' : '10px'};
          color:white;
        ">📍</div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [anchor, size],
    popupAnchor: [0, -size],
  });
}

export interface MapMessage {
  id: number;
  latitude?: number;
  longitude?: number;
  content: string;
  priority?: string | null;
  sender_id?: number;
  timestamp?: string;
  address?: string;
}

interface Props {
  messages: MapMessage[];
  selectedMessageId?: number | null;
  height?: string;
}

/** Controller to handle map invalidation and auto-centering */
function MapController({
  messages,
  selectedMessageId,
}: {
  messages: MapMessage[];
  selectedMessageId?: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    // Invalidate size in multiple intervals so tabs/collapsibles/modals always render full tiles
    const timer1 = setTimeout(() => map.invalidateSize(), 50);
    const timer2 = setTimeout(() => map.invalidateSize(), 250);
    const timer3 = setTimeout(() => map.invalidateSize(), 600);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [map]);

  useEffect(() => {
    const withCoords = messages.filter(
      (m) => m.latitude !== undefined && m.longitude !== undefined && m.latitude !== null && m.longitude !== null
    );

    if (selectedMessageId) {
      const selected = withCoords.find((m) => m.id === selectedMessageId);
      if (selected) {
        map.flyTo([selected.latitude!, selected.longitude!], 15, { duration: 1 });
        return;
      }
    }

    if (withCoords.length === 1) {
      map.setView([withCoords[0].latitude!, withCoords[0].longitude!], 14);
    } else if (withCoords.length > 1) {
      const bounds = L.latLngBounds(
        withCoords.map((m) => [m.latitude!, m.longitude!])
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [map, messages, selectedMessageId]);

  return null;
}

export default function MessageMap({
  messages,
  selectedMessageId,
  height = '420px',
}: Props) {
  const withCoords = messages.filter(
    (m) => m.latitude !== undefined && m.longitude !== undefined && m.latitude !== null && m.longitude !== null
  );

  const initialCenter: [number, number] =
    withCoords.length > 0
      ? [withCoords[0].latitude!, withCoords[0].longitude!]
      : [18.5204, 73.8567]; // Default to Pune/Maharashtra coordinates

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-md bg-white dark:bg-gray-800">
      {/* Legend Header */}
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-gray-700 dark:text-gray-300">Priority:</span>
          {Object.entries(PRIORITY_COLORS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span style={{ background: v }} className="inline-block w-3 h-3 rounded-full" />
              <span className="font-medium text-gray-700 dark:text-gray-300">{k}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          {withCoords.length > 0 ? (
            <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-semibold">
              📍 {withCoords.length} Location{withCoords.length !== 1 ? 's' : ''} Plotted
            </span>
          ) : (
            <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
              ⚠️ No reported locations yet
            </span>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div style={{ height, width: '100%', position: 'relative' }}>
        <MapContainer
          center={initialCenter}
          zoom={withCoords.length > 0 ? 12 : 6}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController messages={messages} selectedMessageId={selectedMessageId} />

          {withCoords.map((msg) => {
            const isSelected = msg.id === selectedMessageId;
            return (
              <Marker
                key={msg.id}
                position={[msg.latitude!, msg.longitude!]}
                icon={createIcon(msg.priority, isSelected)}
              >
                <Popup maxWidth={280}>
                  <div className="p-1 space-y-1.5 text-sm">
                    {msg.priority && (
                      <div>
                        <span
                          style={{ background: PRIORITY_COLORS[msg.priority] ?? '#6366f1' }}
                          className="text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm"
                        >
                          {msg.priority} EMERGENCY
                        </span>
                      </div>
                    )}
                    <p className="font-semibold text-gray-900 mt-1">{msg.content}</p>
                    {msg.address && (
                      <p className="text-xs text-gray-600">🏠 {msg.address}</p>
                    )}
                    <div className="text-xs text-gray-500 border-t pt-1 space-y-0.5">
                      {msg.sender_id !== undefined && (
                        <p>👤 Sender #{msg.sender_id}</p>
                      )}
                      {msg.timestamp && (
                        <p>🕒 {new Date(msg.timestamp).toLocaleString()}</p>
                      )}
                      <p className="font-mono text-gray-600">
                        📍 {msg.latitude!.toFixed(6)}, {msg.longitude!.toFixed(6)}
                      </p>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold block pt-1 hover:underline"
                    >
                      Open in Google Maps ↗
                    </a>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
