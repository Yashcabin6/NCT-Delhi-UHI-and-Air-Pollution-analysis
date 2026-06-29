// ============================================================================
// 00_GEE_Classic_SUHI_Mask_Creation.js
//
// Purpose:
// Create and display Delhi-NCR classic SUHI masks using ESA WorldCover.
// The script shows cleaned built-up area, 1 km outline, wider reference zones,
// and Delhi boundary. Optional raster exports are kept commented.
// ============================================================================

var delhiCenter = ee.Geometry.Point([77.2090, 28.6139]);
var studyRegion = delhiCenter.buffer(80000);

Map.centerObject(studyRegion, 8);

Map.addLayer(
  studyRegion,
  {color: "black"},
  "Study region 80 km",
  false
);

var admin1 = ee.FeatureCollection("FAO/GAUL/2015/level1");

var delhi = admin1
  .filter(ee.Filter.eq("ADM0_NAME", "India"))
  .filter(ee.Filter.stringContains("ADM1_NAME", "Delhi"));

print("Delhi boundary:", delhi);

var esa = ee.ImageCollection("ESA/WorldCover/v200")
  .first()
  .select("Map");

var builtUpRaw = esa
  .eq(50)
  .selfMask()
  .clip(studyRegion);

Map.addLayer(
  esa.clip(studyRegion),
  {
    min: 10,
    max: 100,
    palette: [
      "006400",
      "ffbb22",
      "ffff4c",
      "f096ff",
      "fa0000",
      "b4b4b4",
      "0064c8",
      "0096a0",
      "00cf75",
      "fae6a0"
    ]
  },
  "ESA WorldCover",
  true
);

Map.addLayer(
  builtUpRaw,
  {palette: ["red"]},
  "Raw ESA built-up pixels",
  true
);

var builtUpBinary = builtUpRaw
  .unmask(0)
  .gt(0)
  .clip(studyRegion);

var builtUpMerged = builtUpBinary
  .focal_max({
    radius: 300,
    units: "meters"
  })
  .focal_min({
    radius: 300,
    units: "meters"
  })
  .selfMask()
  .clip(studyRegion);

var connectedPixelsStrong = builtUpMerged.connectedPixelCount({
  maxSize: 1024,
  eightConnected: true
});

var builtUpCleanStrong = builtUpMerged
  .updateMask(connectedPixelsStrong.gte(1000))
  .selfMask()
  .clip(studyRegion);

var urbanBuiltBinary = builtUpCleanStrong
  .unmask(0)
  .gt(0)
  .clip(studyRegion);

Map.addLayer(
  urbanBuiltBinary.selfMask(),
  {palette: ["0000ff"]},
  "Blue cleaned built-up pixels",
  true
);

var urbanEnvelope_1km = urbanBuiltBinary
  .focal_max({
    radius: 1000,
    units: "meters"
  })
  .gt(0)
  .clip(studyRegion);

var urbanOutline_1km = urbanEnvelope_1km
  .and(urbanBuiltBinary.not())
  .selfMask()
  .clip(studyRegion);

Map.addLayer(
  urbanOutline_1km,
  {palette: ["ffff00"]},
  "Yellow 1 km outline",
  true
);

var nonBuiltBinary = esa
  .neq(50)
  .unmask(0)
  .clip(studyRegion);

var envelopePlus6km = urbanBuiltBinary
  .focal_max({
    radius: 6000,
    units: "meters"
  })
  .gt(0)
  .clip(studyRegion);

var envelopePlus11km = urbanBuiltBinary
  .focal_max({
    radius: 11000,
    units: "meters"
  })
  .gt(0)
  .clip(studyRegion);

var envelopePlus21km = urbanBuiltBinary
  .focal_max({
    radius: 21000,
    units: "meters"
  })
  .gt(0)
  .clip(studyRegion);

var referenceMode_5km = envelopePlus6km
  .and(urbanEnvelope_1km.not())
  .and(nonBuiltBinary)
  .selfMask()
  .clip(studyRegion);

var referenceMode_10km = envelopePlus11km
  .and(urbanEnvelope_1km.not())
  .and(nonBuiltBinary)
  .selfMask()
  .clip(studyRegion);

var referenceMode_10to20km = envelopePlus21km
  .and(envelopePlus11km.not())
  .and(nonBuiltBinary)
  .selfMask()
  .clip(studyRegion);

Map.addLayer(
  referenceMode_5km,
  {palette: ["ff9900"]},
  "Reference mode 5 km",
  false
);

Map.addLayer(
  referenceMode_10km,
  {palette: ["00ff00"]},
  "Reference mode 10 km",
  true
);

Map.addLayer(
  referenceMode_10to20km,
  {palette: ["800080"]},
  "Reference mode 10-20 km",
  false
);

Map.addLayer(
  delhi.style({
    color: "000000",
    fillColor: "00000000",
    width: 3
  }),
  {},
  "Delhi boundary on top",
  true
);

var urbanBuilt_export = urbanBuiltBinary
  .unmask(0)
  .rename("urban_built_clean")
  .clip(studyRegion)
  .toByte();

var urbanOutline1km_export = urbanOutline_1km
  .unmask(0)
  .rename("urban_outline_1km")
  .clip(studyRegion)
  .toByte();

var reference5km_export = referenceMode_5km
  .unmask(0)
  .rename("reference_5km_mode")
  .clip(studyRegion)
  .toByte();

var reference10km_export = referenceMode_10km
  .unmask(0)
  .rename("reference_10km_mode")
  .clip(studyRegion)
  .toByte();

var reference10to20km_export = referenceMode_10to20km
  .unmask(0)
  .rename("reference_10to20km_mode")
  .clip(studyRegion)
  .toByte();

/*
Export.image.toDrive({
  image: urbanBuilt_export,
  description: "Delhi_NCR_Urban_Built_Clean_toDrive",
  folder: "Classic UHI",
  fileNamePrefix: "Delhi_NCR_Urban_Built_Clean",
  region: studyRegion,
  scale: 10,
  maxPixels: 1e13,
  fileFormat: "GeoTIFF"
});

Export.image.toDrive({
  image: urbanOutline1km_export,
  description: "Delhi_NCR_Urban_Outline_1km_toDrive",
  folder: "Classic UHI",
  fileNamePrefix: "Delhi_NCR_Urban_Outline_1km",
  region: studyRegion,
  scale: 10,
  maxPixels: 1e13,
  fileFormat: "GeoTIFF"
});

Export.image.toDrive({
  image: reference5km_export,
  description: "Delhi_NCR_Reference_5km_Mode_toDrive",
  folder: "Classic UHI",
  fileNamePrefix: "Delhi_NCR_Reference_5km_Mode",
  region: studyRegion,
  scale: 10,
  maxPixels: 1e13,
  fileFormat: "GeoTIFF"
});

Export.image.toDrive({
  image: reference10km_export,
  description: "Delhi_NCR_Reference_10km_Mode_toDrive",
  folder: "Classic UHI",
  fileNamePrefix: "Delhi_NCR_Reference_10km_Mode",
  region: studyRegion,
  scale: 10,
  maxPixels: 1e13,
  fileFormat: "GeoTIFF"
});

Export.image.toDrive({
  image: reference10to20km_export,
  description: "Delhi_NCR_Reference_10to20km_Mode_toDrive",
  folder: "Classic UHI",
  fileNamePrefix: "Delhi_NCR_Reference_10to20km_Mode",
  region: studyRegion,
  scale: 10,
  maxPixels: 1e13,
  fileFormat: "GeoTIFF"
});
*/
