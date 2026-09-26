# @pricepulse/shared

Small, dependency-free contract constants shared by the apps (scrape outcomes, allowed scrape
intervals, CSV column order).

`apps/server` intentionally does **not** depend on this package so it can be built and deployed
from `apps/server` alone (Render Docker context). Only add something here if the frontend
genuinely needs the same value.
