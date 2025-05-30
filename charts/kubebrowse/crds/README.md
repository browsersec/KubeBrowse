# Custom Resource Definitions
This directory is for Custom Resource Definitions (CRDs) that are part of the kubebrowse chart.
CRDs should be placed here if they need to be installed before the rest of the chart resources.

Note: As of Helm 3, CRDs are typically managed outside of the chart's release lifecycle for better control,
often applied with `kubectl apply -f <crd-file>.yaml` or via a separate CRD-only chart.
However, placing them here is still a valid approach for simpler cases or when CRDs are tightly coupled with the chart.
