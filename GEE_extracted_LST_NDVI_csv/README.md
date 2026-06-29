# Dataset Notes

## `Classic_UHI_LST_NDVI_1km_Reference_2020_2024.csv`

- Source: Landsat 8/9 imagery  
- Spatial resolution: 30 m  
- Temporal frequency: Lower revisit frequency; monthly values are based on available clear-sky Landsat scenes  
- Period: 2020–2024  
- Regions: Urban built-up region and 1 km reference region  
- Main use: High-resolution daytime LST, daytime SUHI and NDVI seasonality  
- SUHI formula: `SUHI = Urban LST - Reference_1km LST`
- Note: Landsat LST may show stronger month-to-month fluctuation because fewer clear-sky images are available each month, but it captures local surface variation more sharply.

## `MODIS_Day_Night_LST_1km_Reference_2020_2024.csv`

- Source: MODIS LST product  
- Spatial resolution: 1 km  
- Temporal frequency: Daily observations, aggregated into monthly values  
- Period: 2020–2024  
- Regions: Urban built-up region and 1 km reference region  
- Main use: Daytime LST, nighttime LST, daytime SUHI and nighttime SUHI analysis  
- SUHI formula: `SUHI = Urban LST - Reference_1km LST`
- Note: MODIS LST is spatially coarser and usually smoother than Landsat LST because it averages over larger 1 km pixels and more frequent observations.
