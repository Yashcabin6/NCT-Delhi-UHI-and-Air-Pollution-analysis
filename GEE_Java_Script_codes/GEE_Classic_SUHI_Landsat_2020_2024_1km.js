// ============================================================================
// 02_GEE_Classic_SUHI_Landsat_2020_2024_1km.js
//
// Purpose:
// Export monthly Landsat LST and NDVI for Delhi-NCR classic SUHI analysis.
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
  builtUpRaw,
  {palette: ["red"]},
  "Raw ESA built-up pixels",
  false
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

var envelopePlus2km = urbanBuiltBinary
  .focal_max({
    radius: 2000,
    units: "meters"
  })
  .gt(0)
  .clip(studyRegion);

var referenceMode_1km = envelopePlus2km
  .and(urbanEnvelope_1km.not())
  .and(nonBuiltBinary)
  .selfMask()
  .clip(studyRegion);

Map.addLayer(
  referenceMode_1km,
  {palette: ["ff9900"]},
  "Reference mode 1 km",
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
var analysisScale = 300;
var exportFolder = "Classic UHI";

var landsat8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");
var landsat9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2");

var landsatRaw = landsat8
  .merge(landsat9)
  .filterBounds(studyRegion)
  .filterDate(
    ee.Date.fromYMD(startYear, 1, 1),
    ee.Date.fromYMD(endYear + 1, 1, 1)
  );

print("Raw Landsat image count 2020-2024:", landsatRaw.size());

function prepareLandsat(image) {
  var qa = image.select("QA_PIXEL");

  var qaMask = qa.bitwiseAnd(1 << 0).eq(0)
    .and(qa.bitwiseAnd(1 << 1).eq(0))
    .and(qa.bitwiseAnd(1 << 2).eq(0))
    .and(qa.bitwiseAnd(1 << 3).eq(0))
    .and(qa.bitwiseAnd(1 << 4).eq(0))
    .and(qa.bitwiseAnd(1 << 5).eq(0));

  var saturationMask = image.select("QA_RADSAT").eq(0);

  var red = image.select("SR_B4")
    .multiply(0.0000275)
    .add(-0.2);

  var nir = image.select("SR_B5")
    .multiply(0.0000275)
    .add(-0.2);

  var ndvi = nir
    .subtract(red)
    .divide(nir.add(red))
    .rename("NDVI");

  var lstC = image.select("ST_B10")
    .multiply(0.00341802)
    .add(149.0)
    .subtract(273.15)
    .rename("LST_C");

  var validDataMask = image.select("SR_B4").gt(0)
    .and(image.select("SR_B5").gt(0))
    .and(image.select("ST_B10").gt(0));

  return ee.Image.cat([lstC, ndvi])
    .updateMask(qaMask)
    .updateMask(saturationMask)
    .updateMask(validDataMask)
    .copyProperties(image, ["system:time_start"]);
}

var landsatPrepared = landsatRaw.map(prepareLandsat);

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
    mean_LST_C: stats.get("LST_C"),
    mean_NDVI: stats.get("NDVI"),
    landsat_image_count: imageCountValue
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

      var monthlyCollection = landsatPrepared.filterDate(startDate, endDate);
      var monthlyImageCount = monthlyCollection.size();

      var monthlyComposite = monthlyCollection
        .median()
        .select(["LST_C", "NDVI"]);

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

print("Monthly Landsat LST and NDVI by region 2020-2024:", monthlyRegionStats);

var monthlyImageCountTable = ee.FeatureCollection(
  years.map(function(yearNumber) {
    yearNumber = ee.Number(yearNumber);

    var yearlyCounts = months.map(function(monthNumber) {
      monthNumber = ee.Number(monthNumber);

      var startDate = ee.Date.fromYMD(yearNumber, monthNumber, 1);
      var endDate = startDate.advance(1, "month");

      var count = landsatRaw
        .filterDate(startDate, endDate)
        .size();

      return ee.Feature(null, {
        year: yearNumber,
        month: monthNumber,
        landsat_image_count: count
      });
    });

    return ee.FeatureCollection(yearlyCounts);
  })
).flatten();

print("Monthly Landsat image count table 2020-2024:", monthlyImageCountTable);

Export.table.toDrive({
  collection: monthlyRegionStats,
  description: "Classic_UHI_LST_NDVI_1km_Reference_2020_2024",
  folder: exportFolder,
  fileNamePrefix: "Classic_UHI_LST_NDVI_1km_Reference_2020_2024",
  fileFormat: "CSV"
});

Export.table.toDrive({
  collection: monthlyImageCountTable,
  description: "Classic_UHI_Landsat_Image_Count_2020_2024",
  folder: exportFolder,
  fileNamePrefix: "Classic_UHI_Landsat_Image_Count_2020_2024",
  fileFormat: "CSV"
});
