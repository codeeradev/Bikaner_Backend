const haversine = require("haversine-distance");

const checkUserZone = (user, zones, settings = {}) => {
    const configuredRange = Number(settings.range);
    const range =
        Number.isFinite(configuredRange) && configuredRange > 0
            ? configuredRange
            : 5000; // meters

    if (!user?.lat || !user?.lng) {
        return null;
    }

    let matchedZone = null;
    let shortestDistance = Infinity;

    for (const zone of zones) {
        const distance = haversine(
            {
                lat: user.lat,
                lng: user.lng,
            },
            {
                lat: zone.lat,
                lng: zone.lng,
            }
        );

        // Inside range & nearest zone
        if (distance <= range && distance < shortestDistance) {
            shortestDistance = distance;
            matchedZone = zone;
        }
    }

    if (!matchedZone) {
        return null;
    }

    return {
        zone: matchedZone,
        distance: shortestDistance, // meters
    };
};

module.exports = checkUserZone;
