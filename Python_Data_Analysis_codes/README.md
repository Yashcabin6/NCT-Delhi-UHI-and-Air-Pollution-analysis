# Python Analysis

This folder contains the Python codes used for analysis in the UHI and air pollution study.

## list

### 1. `UHI_Study7.ipynb`

- CPCB pollutant data for 13 selected monitoring stations.
- Yearly and monthly pollutant summary tables.
- MODIS daytime/nighttime SUHI with pollutant averages.
- SUHI--pollution plots, correlation tables, and pollutant correlation matrices.

**Required files:**

- CPCB hourly pollutant CSV files for selected stations.
- GEE-exported MODIS day/night LST and SUHI CSV files.
- GEE-exported Landsat LST/NDVI CSV files.

### 2. `UHI_study6.ipynb`

- Monthly SUHI, LST and NDVI analysis notebook using the 1 km reference buffer.
- Monthly average plots comparing LST, SUHI and NDVI.

**Required files:**

- `MODIS_Day_Night_LST_1km_Reference_2020_2024.csv`
- `Classic_UHI_LST_NDVI_1km_Reference_2020_2024.csv`
