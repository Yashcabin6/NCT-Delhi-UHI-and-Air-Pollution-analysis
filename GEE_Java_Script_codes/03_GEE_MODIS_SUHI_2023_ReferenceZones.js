// ============================================================================
// 03_GEE_MODIS_SUHI_2023_ReferenceZones.js
//
// Purpose:
// Export monthly MODIS daytime and nighttime LST for classic SUHI analysis.
// Year: 2023
// Regions: Urban, Reference_5km, Reference_10km, Reference_10to20km
// Output: CSV tables in Google Drive folder "Classic UHI".
// ============================================================================

var delhiCenter = ee.Geometry.Point([77.2090, 28.6139]);
var studyRegion = delhiCenter.buffer(80000);

Map.centerObject(studyRegion, 8);

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
  urbanBuiltBinary.selfMask(),
  {palette: ["0000ff"]},
  "Urban built-up mask",
  false
);

Map.addLayer(
  urbanOutline_1km,
  {palette: ["ffff00"]},
  "Urban 1 km outline",
  false
);

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
  false
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
  "Delhi boundary",
  true
);

var analysisYear = 2023;
var analysisScale = 1000;
var exportFolder = "Classic UHI";

var modisTerra = ee.ImageCollection("MODIS/061/MOD11A2");
var modisAqua = ee.ImageCollection("MODIS/061/MYD11A2");

var modisRaw = modisTerra
  .merge(modisAqua)
  .filterBounds(studyRegion)
  .filterDate(
    ee.Date.fromYMD(analysisYear, 1, 1),
    ee.Date.fromYMD(analysisYear + 1, 1, 1)
  );

print("Raw MODIS image count 2023:", modisRaw.size());

function prepareModisLST(image) {
  var qcDay = image.select("QC_Day");
  var qcNight = image.select("QC_Night");

  var dayQAMask = qcDay.bitwiseAnd(3).lte(1);
  var nightQAMask = qcNight.bitwiseAnd(3).lte(1);

  var lstDayC = image.select("LST_Day_1km")
    .multiply(0.02)
    .subtract(273.15)
    .updateMask(dayQAMask)
    .rename("LST_Day_C");

  var lstNightC = image.select("LST_Night_1km")
    .multiply(0.02)
    .subtract(273.15)
    .updateMask(nightQAMask)
    .rename("LST_Night_C");

  return ee.Image.cat([lstDayC, lstNightC])
    .copyProperties(image, ["system:time_start"]);
}

var modisPrepared = modisRaw.map(prepareModisLST);

function extractRegionMean(monthlyImage, regionMask, regionName, yearValue, monthValue, imageCountValue) {
  var regionImage = monthlyImage.updateMask(regionMask);

  var stats = regionImage.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: studyRegion,
    scale: analysisScale,
    maxPixels: 1e13,
    tileScale: 8
  });

  return ee.Feature(null, {
    year: yearValue,
    month: monthValue,
    region: regionName,
    mean_LST_Day_C: stats.get("LST_Day_C"),
    mean_LST_Night_C: stats.get("LST_Night_C"),
    modis_image_count: imageCountValue
  });
}

var months = ee.List.sequence(1, 12);

var monthlyRegionStats = ee.FeatureCollection(
  months.map(function(monthNumber) {
    monthNumber = ee.Number(monthNumber);

    var startDate = ee.Date.fromYMD(analysisYear, monthNumber, 1);
    var endDate = startDate.advance(1, "month");

    var monthlyCollection = modisPrepared.filterDate(startDate, endDate);
    var monthlyImageCount = monthlyCollection.size();

    var monthlyComposite = monthlyCollection
      .mean()
      .select(["LST_Day_C", "LST_Night_C"]);

    var urbanFeature = extractRegionMean(
      monthlyComposite,
      urbanBuiltBinary,
      "Urban",
      analysisYear,
      monthNumber,
      monthlyImageCount
    );

    var ref5Feature = extractRegionMean(
      monthlyComposite,
      referenceMode_5km,
      "Reference_5km",
      analysisYear,
      monthNumber,
      monthlyImageCount
    );

    var ref10Feature = extractRegionMean(
      monthlyComposite,
      referenceMode_10km,
      "Reference_10km",
      analysisYear,
      monthNumber,
      monthlyImageCount
    );

    var ref10to20Feature = extractRegionMean(
      monthlyComposite,
      referenceMode_10to20km,
      "Reference_10to20km",
      analysisYear,
      monthNumber,
      monthlyImageCount
    );

    return ee.FeatureCollection([
      urbanFeature,
      ref5Feature,
      ref10Feature,
      ref10to20Feature
    ]);
  })
).flatten();

print("Monthly MODIS day/night LST by region:", monthlyRegionStats);

var monthlyImageCountTable = ee.FeatureCollection(
  months.map(function(monthNumber) {
    monthNumber = ee.Number(monthNumber);

    var startDate = ee.Date.fromYMD(analysisYear, monthNumber, 1);
    var endDate = startDate.advance(1, "month");

    var count = modisRaw
      .filterDate(startDate, endDate)
      .size();

    return ee.Feature(null, {
      year: analysisYear,
      month: monthNumber,
      modis_image_count: count
    });
  })
);

print("Monthly MODIS image count table:", monthlyImageCountTable);

Export.table.toDrive({
  collection: monthlyRegionStats,
  description: "MODIS_Day_Night_LST_Regions_2023",
  folder: exportFolder,
  fileNamePrefix: "MODIS_Day_Night_LST_Regions_2023",
  fileFormat: "CSV"
});

Export.table.toDrive({
  collection: monthlyImageCountTable,
  description: "MODIS_Day_Night_Image_Count_2023",
  folder: exportFolder,
  fileNamePrefix: "MODIS_Day_Night_Image_Count_2023",
  fileFormat: "CSV"
});
