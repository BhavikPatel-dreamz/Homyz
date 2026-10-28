-- A catalog stamp is not a collected stamp. These rows were created by the
-- retired automatic-award flow and are identifiable by its `rule` evidence.
-- Explicit USER_SELECTED, USER_CUSTOM, manual, and legacy user selections are
-- intentionally preserved.
DELETE FROM "UserTravelStamp"
WHERE jsonb_typeof("evidenceMetadata") = 'object'
  AND "evidenceMetadata" ? 'rule';

-- An empty URL can never represent uploaded media. Removing only these invalid
-- rows fixes the ghost-card count without touching real user media.
DELETE FROM "TravelPhoto" WHERE btrim("url") = '';
DELETE FROM "TripPhoto" WHERE btrim("url") = '';
