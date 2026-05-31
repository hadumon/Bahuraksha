-- Fix existing ml-api rows where secondary_drivers and feature_contributions
-- are stored as JSON strings ("[]") instead of JSON arrays ([]).
-- Python json.dumps() produced double-encoded values.

update public.landslide_predictions
set
  secondary_drivers = (secondary_drivers #>> '{}')::jsonb,
  feature_contributions =
    case
      when feature_contributions is not null and jsonb_typeof(feature_contributions) = 'string'
      then (feature_contributions #>> '{}')::jsonb
      else feature_contributions
    end
where model_source = 'ml-api'
  and jsonb_typeof(secondary_drivers) = 'string';
