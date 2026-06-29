// ============================================================================
// 01_GEE_Landsat_Station_Monthly_NDVI_LST.js
//
// Purpose:
// Extract monthly Landsat NDVI and daytime LST for 13 station buffers.
// Dataset: Landsat 8/9 Collection 2 Level-2
// Year: 2023
// Buffer: 2 km around each station
// Export folder: Classic UHI
// ============================================================================

var stations = ee.FeatureCollection(
  'projects/lst-and-ndvi-analysis/assets/final_stations'
);

print('Final stations:', stations);
print('Number of stations:', stations.size());

Map.centerObject(stations, 9);
Map.addLayer(stations, {color: 'red'}, 'Final Stations');

var bufferRadius = 2000;

var stationBuffers = stations.map(function(feature) {
  return feature.buffer(bufferRadius).copyProperties(feature);
});

print('Station buffers:', stationBuffers);

Map.addLayer(
  stationBuffers,
  {color: 'blue'},
  '2 km Station Buffers'
);

var targetYear = 2023;
var studyArea = stationBuffers.geometry();

function maskLandsatL2(image) {
  var qa = image.select('QA_PIXEL');

  var cloudShadowBitMask = 1 << 4;
  var cloudsBitMask = 1 << 3;

  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
    .and(qa.bitwiseAnd(cloudsBitMask).eq(0));

  return image.updateMask(mask);
}

function addNDVI_LST(image) {
  var red = image.select('SR_B4')
    .multiply(0.0000275)
    .add(-0.2);

  var nir = image.select('SR_B5')
    .multiply(0.0000275)
    .add(-0.2);

  var ndvi = nir.subtract(red)
    .divide(nir.add(red))
    .rename('NDVI');

  var lstC = image.select('ST_B10')
    .multiply(0.00341802)
    .add(149.0)
    .subtract(273.15)
    .rename('LST_C');

  return image.addBands(ndvi).addBands(lstC);
}

var landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(studyArea)
  .filterDate(targetYear + '-01-01', (targetYear + 1) + '-01-01');

var landsat9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
  .filterBounds(studyArea)
  .filterDate(targetYear + '-01-01', (targetYear + 1) + '-01-01');

var landsat = landsat8.merge(landsat9)
  .map(maskLandsatL2)
  .map(addNDVI_LST);

print('Total Landsat images in year:', landsat.size());

var months = ee.List.sequence(1, 12);

var yearlyResults = ee.FeatureCollection(
  months.map(function(month) {
    month = ee.Number(month);

    var startDate = ee.Date.fromYMD(targetYear, month, 1);
    var endDate = startDate.advance(1, 'month');

    var monthlyCollection = landsat
      .filterDate(startDate, endDate)
      .select(['NDVI', 'LST_C']);

    var monthlyComposite = monthlyCollection.median();

    var imageCount = monthlyCollection.size();

    var extracted = monthlyComposite.reduceRegions({
      collection: stationBuffers,
      reducer: ee.Reducer.mean(),
      scale: 30
    });

    extracted = extracted.map(function(feature) {
      return feature.set({
        year: targetYear,
        month: month,
        landsat_image_count: imageCount,
        buffer_radius_m: bufferRadius,
        source: 'LANDSAT/LC08_LC09/C02/T1_L2'
      });
    });

    return extracted;
  })
).flatten();

print('Monthly Landsat NDVI + LST station-buffer results:', yearlyResults);

Export.table.toDrive({
  collection: yearlyResults,
  description: 'Landsat_NDVI_LST_2023_station_buffers_monthly',
  folder: 'Classic UHI',
  fileNamePrefix: 'Landsat_NDVI_LST_2023_station_buffers_monthly',
  fileFormat: 'CSV'
});
