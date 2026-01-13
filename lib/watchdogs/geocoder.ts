/**
 * Geocoder - Extract and geocode locations from events
 */

import type { ClassifiedEvent, EventLocation } from "./types"
import {
  majorCities,
  getCityCoordinates,
  countryCoordinates,
  getCountryCoordinates,
} from "@/app/labs/watchdogs/data/watchdogs-data"

// Country name to ISO2 code mapping
const countryNameToCode: Record<string, string> = {
  // Common names
  "united states": "US",
  "usa": "US",
  "america": "US",
  "united kingdom": "GB",
  "uk": "GB",
  "britain": "GB",
  "england": "GB",
  "germany": "DE",
  "france": "FR",
  "japan": "JP",
  "china": "CN",
  "russia": "RU",
  "ukraine": "UA",
  "india": "IN",
  "brazil": "BR",
  "australia": "AU",
  "canada": "CA",
  "mexico": "MX",
  "south korea": "KR",
  "korea": "KR",
  "singapore": "SG",
  "hong kong": "HK",
  "taiwan": "TW",
  "iran": "IR",
  "israel": "IL",
  "saudi arabia": "SA",
  "uae": "AE",
  "united arab emirates": "AE",
  "egypt": "EG",
  "south africa": "ZA",
  "nigeria": "NG",
  "indonesia": "ID",
  "philippines": "PH",
  "thailand": "TH",
  "vietnam": "VN",
  "malaysia": "MY",
  "poland": "PL",
  "italy": "IT",
  "spain": "ES",
  "netherlands": "NL",
  "switzerland": "CH",
  "sweden": "SE",
  "norway": "NO",
  "austria": "AT",
  "belgium": "BE",
  "turkey": "TR",
  "argentina": "AR",
  "chile": "CL",
  "colombia": "CO",
  "peru": "PE",
}

// Region keywords for detecting geographic areas
const regionKeywords: Record<string, { name: string; coordinates: [number, number] }> = {
  "middle east": { name: "Middle East", coordinates: [45, 25] },
  "europe": { name: "Europe", coordinates: [10, 50] },
  "asia": { name: "Asia", coordinates: [100, 30] },
  "africa": { name: "Africa", coordinates: [20, 0] },
  "latin america": { name: "Latin America", coordinates: [-60, -15] },
  "south america": { name: "South America", coordinates: [-60, -15] },
  "north america": { name: "North America", coordinates: [-100, 40] },
  "pacific": { name: "Pacific Region", coordinates: [150, 0] },
  "caribbean": { name: "Caribbean", coordinates: [-70, 18] },
  "southeast asia": { name: "Southeast Asia", coordinates: [110, 10] },
  "east asia": { name: "East Asia", coordinates: [120, 35] },
  "western europe": { name: "Western Europe", coordinates: [5, 48] },
  "eastern europe": { name: "Eastern Europe", coordinates: [25, 50] },
  "central asia": { name: "Central Asia", coordinates: [65, 42] },
  "nordic": { name: "Nordic Region", coordinates: [15, 62] },
  "balkans": { name: "Balkans", coordinates: [20, 43] },
  "gulf": { name: "Gulf Region", coordinates: [50, 25] },
}

/**
 * Extract location from event text and entities
 */
function extractLocation(event: ClassifiedEvent): EventLocation | null {
  const text = `${event.rawArticle.title} ${event.rawArticle.description} ${event.entities.join(" ")}`.toLowerCase()

  // 1. Check for city names first (most specific)
  for (const [city, coords] of Object.entries(majorCities)) {
    if (text.includes(city.toLowerCase())) {
      // Try to determine country code from city
      let countryCode = "XX"
      if (["new york", "los angeles", "chicago", "houston", "washington", "san francisco", "miami"].some(c => city.toLowerCase().includes(c))) {
        countryCode = "US"
      } else if (["london"].includes(city.toLowerCase())) {
        countryCode = "GB"
      } else if (["tokyo", "osaka"].some(c => city.toLowerCase().includes(c))) {
        countryCode = "JP"
      } else if (["beijing", "shanghai"].some(c => city.toLowerCase().includes(c))) {
        countryCode = "CN"
      } else if (["paris"].includes(city.toLowerCase())) {
        countryCode = "FR"
      } else if (["berlin", "frankfurt"].some(c => city.toLowerCase().includes(c))) {
        countryCode = "DE"
      } else if (["moscow"].includes(city.toLowerCase())) {
        countryCode = "RU"
      } else if (["kyiv"].includes(city.toLowerCase())) {
        countryCode = "UA"
      }

      return {
        name: city,
        countryCode,
        lat: coords[1],
        lng: coords[0],
        type: "city",
      }
    }
  }

  // 2. Check for country names
  for (const [name, code] of Object.entries(countryNameToCode)) {
    if (text.includes(name)) {
      const coords = getCountryCoordinates(code)
      if (coords) {
        return {
          name: name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
          countryCode: code,
          lat: coords[1],
          lng: coords[0],
          type: "country",
        }
      }
    }
  }

  // 3. Check for region keywords
  for (const [keyword, region] of Object.entries(regionKeywords)) {
    if (text.includes(keyword)) {
      return {
        name: region.name,
        countryCode: "XX",
        lat: region.coordinates[1],
        lng: region.coordinates[0],
        type: "region",
      }
    }
  }

  // 4. Check entities for company headquarters (common companies)
  const companyLocations: Record<string, { name: string; coords: [number, number]; code: string }> = {
    "apple": { name: "Cupertino, CA", coords: [-122.0322, 37.323], code: "US" },
    "google": { name: "Mountain View, CA", coords: [-122.0841, 37.422], code: "US" },
    "microsoft": { name: "Redmond, WA", coords: [-122.1215, 47.6739], code: "US" },
    "amazon": { name: "Seattle, WA", coords: [-122.3321, 47.6062], code: "US" },
    "meta": { name: "Menlo Park, CA", coords: [-122.1817, 37.4529], code: "US" },
    "facebook": { name: "Menlo Park, CA", coords: [-122.1817, 37.4529], code: "US" },
    "tesla": { name: "Austin, TX", coords: [-97.7431, 30.2672], code: "US" },
    "nvidia": { name: "Santa Clara, CA", coords: [-121.9552, 37.3541], code: "US" },
  }

  for (const entity of event.entities) {
    const lower = entity.toLowerCase()
    for (const [company, loc] of Object.entries(companyLocations)) {
      if (lower.includes(company)) {
        return {
          name: loc.name,
          countryCode: loc.code,
          lat: loc.coords[1],
          lng: loc.coords[0],
          type: "city",
        }
      }
    }
  }

  // No location found
  return null
}

/**
 * Add location data to classified events
 */
export async function geocodeEvents(
  events: ClassifiedEvent[]
): Promise<ClassifiedEvent[]> {
  return events.map((event) => {
    const location = extractLocation(event)
    if (location) {
      return { ...event, location }
    }
    return event
  })
}
