// ============================================================================
// 04_GEE_MODIS_SUHI_2020_2024_1km.js
//
// Purpose:
// Export monthly MODIS daytime and nighttime LST for classic SUHI analysis.
// Period: 2020-2024
// Regions: Urban and Reference_1km
// Output: CSV tables in Google Drive folder "Classic UHI".
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

var urbanEnvelope_2km = urbanBuiltBinary
  .focal_max({
    radius: 2000,
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

var referenceMode_1km = urbanEnvelope_2km
  .and(urbanEnvelope_1km.not())
  .and(nonBuiltBinary)
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
  false
);

Map.addLayer(
  urbanBuiltBinary.selfMask(),
  {palette: ["0000ff"]},
  "Urban built-up mask",
  true
);

Map.addLayer(
  urbanOutline_1km,
  {palette: ["ffff00"]},
  "Urban 1 km outline",
  true
);

Map.addLayer(
  referenceMode_1km,
  {palette: ["00ffff"]},
  "Reference 1 km ring outside outline",
  true
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

var startYear = 2020;
var endYear = 2024;
var analysisScale = 1000;
var exportFolder = "Classic UHI";

var modisTerra = ee.ImageCollection("MODIS/061/MOD11A2");
var modisAqua = ee.ImageCollection("MODIS/061/MYD11A2");

var modisRaw = modisTerra
  .merge(modisAqua)
  .filterBounds(studyRegion)
  .filterDate(
    ee.Date.fromYMD(startYear, 1, 1),
    ee.Date.fromYMD(endYear + 1, 1, 1)
  );

print("Raw MODIS image count 2020-2024:", modisRaw.size());

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

var years = ee.List.sequence(startYear, endYear);
var months = ee.List.sequence(1, 12);

var monthlyRegionStats = ee.FeatureCollection(
  years.map(function(yearNumber) {
    yearNumber = ee.Number(yearNumber);

    var yearlyStats = months.map(function(monthNumber) {
      monthNumber = ee.Number(monthNumber);

      var startDate = ee.Date.fromYMD(yearNumber, monthNumber, 1);
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
        yearNumber,
        monthNumber,
        monthlyImageCount
      );

      var ref1Feature = extractRegionMean(
        monthlyComposite,
        referenceMode_1km,
        "Reference_1km",
        yearNumber,
        monthNumber,
        monthlyImageCount
      );

      return ee.FeatureCollection([
        urbanFeature,
        ref1Feature
      ]);
    });

    return ee.FeatureCollection(yearlyStats).flatten();
  })
).flatten();

print("Monthly MODIS day/night LST for Urban and Reference_1km 2020-2024:", monthlyRegionStats);

var monthlyImageCountTable = ee.FeatureCollection(
  years.map(function(yearNumber) {
    yearNumber = ee.Number(yearNumber);

    var yearlyCounts = months.map(function(monthNumber) {
      monthNumber = ee.Number(monthNumber);

      var startDate = ee.Date.fromYMD(yearNumber, monthNumber, 1);
      var endDate = startDate.advance(1, "month");

      var count = modisRaw
        .filterDate(startDate, endDate)
        .size();

      return ee.Feature(null, {
        year: yearNumber,
        month: monthNumber,
        modis_image_count: count
      });
    });

    return ee.FeatureCollection(yearlyCounts);
  })
).flatten();

print("Monthly MODIS image count table 2020-2024:", monthlyImageCountTable);

Export.table.toDrive({
  collection: monthlyRegionStats,
  description: "MODIS_Day_Night_LST_1km_Reference_2020_2024",
  folder: exportFolder,
  fileNamePrefix: "MODIS_Day_Night_LST_1km_Reference_2020_2024",
  fileFormat: "CSV"
});

Export.table.toDrive({
  collection: monthlyImageCountTable,
  description: "MODIS_Day_Night_Image_Count_1km_Reference_2020_2024",
  folder: exportFolder,
  fileNamePrefix: "MODIS_Day_Night_Image_Count_1km_Reference_2020_2024",
  fileFormat: "CSV"
});
