/**
 * Watchdogs Dashboard - Static Data
 * Country colors, major city coordinates, and event data
 */

import type { EventCategory, RegionMarker } from "@/lib/watchdogs/types"
import { CATEGORY_COLORS } from "@/lib/watchdogs/config"

// Country colors based on most common event types
// These will be dynamically updated based on real events
export const countryColors: Record<string, string> = {
  // Financial hubs (blue)
  US: "#3b82f6",
  GB: "#3b82f6",
  JP: "#3b82f6",
  DE: "#3b82f6",
  CH: "#3b82f6",
  SG: "#3b82f6",
  HK: "#3b82f6",

  // Geopolitical hotspots (red)
  RU: "#ef4444",
  UA: "#ef4444",
  CN: "#ef4444",
  IR: "#ef4444",
  KP: "#ef4444",
  IL: "#ef4444",
  SY: "#ef4444",

  // Natural disaster prone (orange)
  ID: "#f59e0b",
  PH: "#f59e0b",
  MX: "#f59e0b",
  IN: "#f59e0b",
  BD: "#f59e0b",

  // Regulatory focus (purple)
  EU: "#8b5cf6",
  FR: "#8b5cf6",
  AU: "#8b5cf6",
  CA: "#8b5cf6",
  BR: "#8b5cf6",

  // Other countries (gray)
  default: "#525252",
}

// Get color for a country
export function getCountryColor(iso2: string): string {
  return countryColors[iso2] || countryColors.default
}

// Get color for an event category
export function getCategoryColor(category: EventCategory): string {
  return CATEGORY_COLORS[category]
}

// Major city coordinates for event markers
export const majorCities: Record<string, [number, number]> = {
  // North America
  "New York": [-74.006, 40.7128],
  "Los Angeles": [-118.2437, 34.0522],
  "Chicago": [-87.6298, 41.8781],
  "Houston": [-95.3698, 29.7604],
  "Washington": [-77.0369, 38.9072],
  "San Francisco": [-122.4194, 37.7749],
  "Toronto": [-79.3832, 43.6532],
  "Mexico City": [-99.1332, 19.4326],

  // Europe
  "London": [-0.1276, 51.5074],
  "Paris": [2.3522, 48.8566],
  "Berlin": [13.405, 52.52],
  "Frankfurt": [8.6821, 50.1109],
  "Zurich": [8.5417, 47.3769],
  "Amsterdam": [4.9041, 52.3676],
  "Brussels": [4.3517, 50.8503],
  "Madrid": [-3.7038, 40.4168],
  "Rome": [12.4964, 41.9028],
  "Moscow": [37.6173, 55.7558],
  "Kyiv": [30.5234, 50.4501],
  "Stockholm": [18.0686, 59.3293],

  // Asia
  "Tokyo": [139.6917, 35.6895],
  "Beijing": [116.4074, 39.9042],
  "Shanghai": [121.4737, 31.2304],
  "Hong Kong": [114.1694, 22.3193],
  "Singapore": [103.8198, 1.3521],
  "Seoul": [126.978, 37.5665],
  "Mumbai": [72.8777, 19.076],
  "Delhi": [77.1025, 28.7041],
  "Dubai": [55.2708, 25.2048],
  "Tel Aviv": [34.7818, 32.0853],
  "Tehran": [51.3890, 35.6892],
  "Taipei": [121.5654, 25.033],

  // Oceania
  "Sydney": [151.2093, -33.8688],
  "Melbourne": [144.9631, -37.8136],

  // South America
  "Sao Paulo": [-46.6333, -23.5505],
  "Buenos Aires": [-58.3816, -34.6037],
  "Rio de Janeiro": [-43.1729, -22.9068],

  // Africa
  "Cairo": [31.2357, 30.0444],
  "Johannesburg": [28.0473, -26.2041],
  "Lagos": [3.3792, 6.5244],
  "Nairobi": [36.8219, -1.2921],
}

// Get coordinates for a city/location name
export function getCityCoordinates(cityName: string): [number, number] | null {
  // Exact match
  if (majorCities[cityName]) {
    return majorCities[cityName]
  }

  // Partial match
  const lowerName = cityName.toLowerCase()
  for (const [city, coords] of Object.entries(majorCities)) {
    if (city.toLowerCase().includes(lowerName) || lowerName.includes(city.toLowerCase())) {
      return coords
    }
  }

  return null
}

// Country center coordinates for fallback
export const countryCoordinates: Record<string, [number, number]> = {
  US: [-95.7129, 37.0902],
  GB: [-3.436, 55.3781],
  DE: [10.4515, 51.1657],
  FR: [2.2137, 46.2276],
  JP: [138.2529, 36.2048],
  CN: [104.1954, 35.8617],
  RU: [105.3188, 61.524],
  IN: [78.9629, 20.5937],
  BR: [-51.9253, -14.235],
  AU: [133.7751, -25.2744],
  CA: [-106.3468, 56.1304],
  MX: [-102.5528, 23.6345],
  KR: [127.7669, 35.9078],
  SG: [103.8198, 1.3521],
  HK: [114.1694, 22.3193],
  UA: [31.1656, 48.3794],
  IR: [53.688, 32.4279],
  IL: [34.8516, 31.0461],
  SA: [45.0792, 23.8859],
  AE: [53.8478, 23.4241],
  EG: [30.8025, 26.8206],
  ZA: [22.9375, -30.5595],
  NG: [8.6753, 9.082],
  ID: [113.9213, -0.7893],
  PH: [121.774, 12.8797],
  TH: [100.9925, 15.87],
  VN: [108.2772, 14.0583],
  MY: [101.9758, 4.2105],
  PL: [19.1451, 51.9194],
  IT: [12.5674, 41.8719],
  ES: [-3.7492, 40.4637],
  NL: [5.2913, 52.1326],
  CH: [8.2275, 46.8182],
  SE: [18.6435, 60.1282],
  NO: [8.4689, 60.472],
  AT: [14.5501, 47.5162],
  BE: [4.4699, 50.5039],
  TR: [35.2433, 38.9637],
  AR: [-63.6167, -38.4161],
  CL: [-71.543, -35.6751],
  CO: [-74.2973, 4.5709],
  PE: [-75.0152, -9.19],
}

// Get country coordinates
export function getCountryCoordinates(iso2: string): [number, number] | null {
  return countryCoordinates[iso2] || null
}

// Region markers for major news sources/data centers
export const regionMarkers: RegionMarker[] = [
  // Financial centers
  { id: "nyc", name: "New York", coordinates: [-74.006, 40.7128], category: "financial" },
  { id: "lon", name: "London", coordinates: [-0.1276, 51.5074], category: "financial" },
  { id: "tok", name: "Tokyo", coordinates: [139.6917, 35.6895], category: "financial" },
  { id: "hkg", name: "Hong Kong", coordinates: [114.1694, 22.3193], category: "financial" },
  { id: "sgp", name: "Singapore", coordinates: [103.8198, 1.3521], category: "financial" },
  { id: "fra", name: "Frankfurt", coordinates: [8.6821, 50.1109], category: "financial" },

  // Geopolitical hotspots
  { id: "mow", name: "Moscow", coordinates: [37.6173, 55.7558], category: "geopolitical" },
  { id: "kyv", name: "Kyiv", coordinates: [30.5234, 50.4501], category: "geopolitical" },
  { id: "bjn", name: "Beijing", coordinates: [116.4074, 39.9042], category: "geopolitical" },
  { id: "thr", name: "Tehran", coordinates: [51.3890, 35.6892], category: "geopolitical" },
  { id: "tlv", name: "Tel Aviv", coordinates: [34.7818, 32.0853], category: "geopolitical" },

  // Regulatory centers
  { id: "bru", name: "Brussels", coordinates: [4.3517, 50.8503], category: "regulatory" },
  { id: "wdc", name: "Washington", coordinates: [-77.0369, 38.9072], category: "regulatory" },
  { id: "gen", name: "Geneva", coordinates: [6.1432, 46.2044], category: "regulatory" },

  // Natural disaster prone regions
  { id: "jkt", name: "Jakarta", coordinates: [106.8456, -6.2088], category: "natural" },
  { id: "mnl", name: "Manila", coordinates: [120.9842, 14.5995], category: "natural" },
  { id: "mia", name: "Miami", coordinates: [-80.1918, 25.7617], category: "natural" },
]

// Format number with commas
export function formatNumber(num: number): string {
  return num.toLocaleString("en-US")
}

// Initial stats for display
export const initialStats = {
  totalEvents: 0,
  financial: 0,
  geopolitical: 0,
  natural: 0,
  regulatory: 0,
  eventsPerMinute: 0,
}
