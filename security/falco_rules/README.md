# Custom Falco Rules for KubeBrowse

This directory contains `kubebrowse_rules.yaml`, a set of custom Falco rules specifically designed to enhance the runtime security monitoring of KubeBrowse session pods.

## Purpose

These rules help detect potentially malicious or anomalous behaviors within the KubeBrowse browser and office environments, such as:
- Unexpected network connections.
- Spawning of shells or unauthorized processes.
- Access to sensitive files.
- Attempts to modify system binaries.

## IMPORTANT: Customization Required!

The provided rules include placeholder **macros** for whitelisting network destinations (`whitelisted_kubebrowse_network`) and processes (`whitelisted_kubebrowse_processes`).

**You MUST customize these whitelists** based on:
- Your specific network environment and the services KubeBrowse pods need to access (e.g., Guacamole, internal applications).
- The exact processes running within your chosen `rdp-chromium` and `rdp-onlyoffice-lxde` (or other) container images.
- Legitimate user activities and web application behaviors.

Failure to properly tune these whitelists will result in a high volume of false positive alerts. Start with the provided rules and iteratively refine them based on observed behavior in your deployment.

## Pod Labels

The rules use a macro `kubebrowse_pod` that assumes KubeBrowse session pods are labeled with `app: browser-sandbox-test`. If your KubeBrowse deployment uses different labels for these pods, you **must** update the `condition` in the `kubebrowse_pod` macro definition within `kubebrowse_rules.yaml`.

## Loading These Rules

Refer to the main KubeBrowse Falco integration guide at `docs/FALCO_INTEGRATION.md` (link to be updated once PR is merged) for instructions on how to load these custom rules into your Falco deployment.

Consult the [official Falco documentation](https://falco.org/docs/rules/managing/) for more details on rule management.
