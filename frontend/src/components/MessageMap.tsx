import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default icon paths for Leaflet when bundled with Vite
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface Message {
  id: number;
  latitude?: number;
  longitude?: number;
  content: string;
  priority?: string | null;
}

interface Props {
  messages: Message[];
}

export default function MessageMap({ messages }: Props) {
  // Determine map center: first message with coordinates or default to (0,0)
  const first = messages.find((m) => m.latitude !== undefined && m.longitude !== undefined);
  const center: [number, number] = first ? [first.latitude!, first.longitude!] : [0, 0];

  return (
    <MapContainer center={center} zoom={5} style={{ height: '400px', width: '100%' }}>
      <TileLayer
        attribution="&copy; <a href='https://www.openstreetmap.org/'>OpenStreetMap</a> contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {messages.map(
        (msg) =>
          msg.latitude !== undefined &&
          msg.longitude !== undefined && (
            <Marker key={msg.id} position={[msg.latitude, msg.longitude]}>
              <Popup>
                <strong>Priority:</strong> {msg.priority ?? 'N/A'}<br />
                {msg.content}
              </Popup>
            </Marker>
          )
      )}
    </MapContainer>
  );
}
