function isWithinZone(userLat, userLng, zone, zoneWindowConfig = null, nowMoment = null) {
  const activeRange = getActiveZoneRange(zone, zoneWindowConfig, nowMoment);
  if (!activeRange || !zone?.lat || !zone?.lng) return false;

  const userLocation = { lat: userLat, lon: userLng };
  const zoneLocation = { lat: zone.lat, lon: zone.lng };
  const distance = haversine(userLocation, zoneLocation);

  return distance <= activeRange;
}