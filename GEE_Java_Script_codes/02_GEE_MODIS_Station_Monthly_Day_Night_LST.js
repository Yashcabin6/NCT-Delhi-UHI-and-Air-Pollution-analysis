// ============================================================================
// 02_GEE_MODIS_Station_Monthly_Day_Night_LST.js
//
// Purpose:
// Extract monthly MODIS daytime and nighttime LST for 13 station buffers.
// Dataset: MODIS/061/MOD11A1
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

var modis = ee.ImageCollection('MODIS/061/MOD11A1')
  .filterBounds(studyArea)
  .filterDate(targetYear + '-01-01', (targetYear + 1) + '-01-01');

print('Total MODIS images in year:', modis.size());

function addMODIS_LST_C(image) {
  var lstDayC = image.select('LST_Day_1km')
    .multiply(0.02)
    .subtract(273.15)
    .rename('mean_LST_Day_C');

  var lstNightC = image.select('LST_Night_1km')
    .multiply(0.02)
    .subtract(273.15)
    .rename('mean_LST_Night_C');

  return image.addBands(lstDayC).addBands(lstNightC);
}

var modisLST = modis.map(addMODIS_LST_C);

var months = ee.List.sequence(1, 12);

var yearlyResults = ee.FeatureCollection(
  months.map(function(month) {
    month = ee.Number(month);

    var startDate = ee.Date.fromYMD(targetYear, month, 1);
    var endDate = startDate.advance(1, 'month');

    var monthlyCollection = modisLST
      .filterDate(startDate, endDate)
      .select(['mean_LST_Day_C', 'mean_LST_Night_C']);

    var monthlyMean = monthlyCollection.mean();

    var imageCount = monthlyCollection.size();

    var extracted = monthlyMean.reduceRegions({
      collection: stationBuffers,
      reducer: ee.Reducer.mean(),
      scale: 1000
    });

    extracted = extracted.map(function(feature) {
      return feature.set({
        year: targetYear,
        month: month,
        modis_image_count: imageCount,
        buffer_radius_m: bufferRadius,
        source: 'MODIS/061/MOD11A1'
      });
    });

    return extracted;
  })
).flatten();

print('Monthly MODIS Day/Night LST station-buffer results:', yearlyResults);

Export.table.toDrive({
  collection: yearlyResults,
  description: 'MODIS_Day_Night_LST_2023_station_buffers_monthly',
  folder: 'Classic UHI',
  fileNamePrefix: 'MODIS_Day_Night_LST_2023_station_buffers_monthly',
  fileFormat: 'CSV'
});
