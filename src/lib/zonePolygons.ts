import type { FeatureCollection, Polygon } from "geojson";

export const ZONE_POLYGONS: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { zoneName: "Kathmandu Metro" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [85.280, 27.740],
          [85.360, 27.740],
          [85.360, 27.695],
          [85.280, 27.695],
          [85.280, 27.740],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { zoneName: "Lalitpur Sub-Metro" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [85.300, 27.680],
          [85.350, 27.680],
          [85.350, 27.640],
          [85.300, 27.640],
          [85.300, 27.680],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { zoneName: "Bhaktapur Municipality" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [85.400, 27.690],
          [85.460, 27.690],
          [85.460, 27.650],
          [85.400, 27.650],
          [85.400, 27.690],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { zoneName: "Kirtipur Municipality" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [85.260, 27.690],
          [85.300, 27.690],
          [85.300, 27.660],
          [85.260, 27.660],
          [85.260, 27.690],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { zoneName: "Budhanilkantha" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [85.340, 27.800],
          [85.380, 27.800],
          [85.380, 27.760],
          [85.340, 27.760],
          [85.340, 27.800],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { zoneName: "Tokha Municipality" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [85.290, 27.770],
          [85.330, 27.770],
          [85.330, 27.730],
          [85.290, 27.730],
          [85.290, 27.770],
        ]],
      },
    },
  ],
};
