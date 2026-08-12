/**
 * Calcula a distância entre dois pontos geográficos usando a fórmula de Haversine.
 * Retorna a distância em metros.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export type LocationStatus = 'MATCH' | 'REVIEW' | 'OUTSIDE' | 'UNAVAILABLE';

export interface LocationValidationResult {
  distance: number | null;
  status: LocationStatus;
  accuracy: number;
}

/**
 * Valida a localização capturada em relação às coordenadas da loja.
 */
export function validateVisitLocation(
  capturedLat: number,
  capturedLon: number,
  accuracy: number,
  storeLat: number | null,
  storeLon: number | null
): LocationValidationResult {
  if (storeLat === null || storeLon === null) {
    return { distance: null, status: 'UNAVAILABLE', accuracy };
  }

  const distance = calculateHaversineDistance(
    capturedLat,
    capturedLon,
    storeLat,
    storeLon
  );

  // Regras de negócio da Missão 3
  // MATCH: até 100m E precisão boa (<= 100m)
  // REVIEW: entre 100m e 250m OU precisão ruim (> 100m)
  // OUTSIDE: acima de 250m

  if (distance > 250) {
    return { distance, status: 'OUTSIDE', accuracy };
  }

  if (distance > 100 || accuracy > 100) {
    return { distance, status: 'REVIEW', accuracy };
  }

  return { distance, status: 'MATCH', accuracy };
}
