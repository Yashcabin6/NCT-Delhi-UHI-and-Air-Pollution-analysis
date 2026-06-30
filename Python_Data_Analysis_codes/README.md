# Python Analysis Notebooks

This folder contains the Python/Colab notebooks used for processing, analysis, plotting, and table generation in the UHI and air pollution study.

## Notebook list

### 1. `UHI_Study7.ipynb`

- Main SUHI and air pollution analysis notebook.
- Processes CPCB pollutant data for selected monitoring stations.
- Creates yearly and monthly pollutant summary tables.
- Combines MODIS daytime/nighttime SUHI with pollutant averages.
- Uses Landsat NDVI and station-buffer LST where higher spatial detail is needed.
- Produces SUHI--pollution plots, correlation tables, and pollutant correlation matrices.

**Required files:**

- CPCB hourly pollutant CSV files for selected stations.
- GEE-exported MODIS day/night LST and SUHI CSV files.
- GEE-exported Landsat LST/NDVI CSV files.

**Note:** MODIS is used for monthly daytime and nighttime SUHI analysis. Landsat is used for NDVI and higher-resolution station-scale LST analysis.
