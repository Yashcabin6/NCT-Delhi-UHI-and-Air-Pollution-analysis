# Dataset Notes

## `Classic_UHI_LST_NDVI_1km_Reference_2020_2024.csv`

- Source: Landsat 8/9
- Spatial resolution: 30 m
- Temporal frequency: about 8-day coverage from combined Landsat 8 and 9, depending on clear-sky availability
- Period: 2020–2024
- Regions: Urban and Reference_1km
- Used for: daytime LST, daytime SUHI, and NDVI seasonality
- SUHI formula: `SUHI = Urban LST - Reference_1km LST`
- Note: Landsat gives sharper local surface detail, but monthly values can fluctuate more because fewer clear-sky scenes are available.

## `MODIS_Day_Night_LST_1km_Reference_2020_2024.csv`

- Source: MODIS LST
- Spatial resolution: 1 km
- Temporal frequency: daily observations aggregated into monthly values
- Period: 2020–2024
- Regions: Urban and Reference_1km
- Used for: daytime LST, nighttime LST, daytime SUHI, and nighttime SUHI
- SUHI formula: `SUHI = Urban LST - Reference_1km LST`
- Note: MODIS is smoother than Landsat because of coarser 1 km pixels, but it provides both daytime and nighttime LST.
