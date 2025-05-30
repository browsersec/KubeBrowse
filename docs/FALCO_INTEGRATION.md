# Integrating KubeBrowse with Falco for Runtime Security

[Falco](https://falco.org/) is a CNCF graduated open-source runtime security tool that detects anomalous activity in your applications and infrastructure. By monitoring kernel system calls and Kubernetes events, Falco can identify security threats within your KubeBrowse session pods in real-time.

This guide provides recommendations on how to use Falco to enhance the security of your KubeBrowse deployment.

## Prerequisites

*   A running Kubernetes cluster where KubeBrowse is deployed.
*   Falco installed and running in your Kubernetes cluster. If you don't have Falco installed, please refer to the [official Falco installation guide](https://falco.org/docs/getting-started/installation/). The recommended method for Kubernetes is using the [official Helm chart](https://github.com/falcosecurity/charts/tree/master/falco).

## Using KubeBrowse-Specific Falco Rules

KubeBrowse provides a set of custom Falco rules tailored to the expected behavior of its browser and office session pods. These rules help in identifying activities that might indicate a security risk.

**1. Obtain the Custom Rules:**

The recommended custom rules for KubeBrowse are located in the repository at:
`security/falco_rules/kubebrowse_rules.yaml`

(Once this PR is merged, this can be a direct link to the raw file on GitHub, e.g., `https://github.com/browsersec/KubeBrowse/blob/main/security/falco_rules/kubebrowse_rules.yaml`)

A `README.md` is also available in the `security/falco_rules/` directory, explaining these rules in more detail.

**2. Loading Custom Rules into Falco:**

How you load custom rules depends on your Falco deployment method.

*   **If using the Falco Helm Chart:**
    You can include the KubeBrowse custom rules by adding them to your Helm chart `values.yaml` file or by providing them as a separate file during Helm upgrade/install.

    Example `values.yaml` snippet:
    ```yaml
    customRules:
      kubebrowse_rules.yaml: |
        # Paste the content of kubebrowse_rules.yaml here
        # Alternatively, use --set-file to point to the local file path:
        # For example, if you cloned the KubeBrowse repo:
        # helm install falco falcosecurity/falco --namespace falco --create-namespace         #   --set-file customRules.kubebrowse_rules\.yaml=./KubeBrowse/security/falco_rules/kubebrowse_rules.yaml
    ```
    Then apply with `helm upgrade falco falcosecurity/falco -f values.yaml -n falco-namespace` (or `helm install` if it's a new Falco deployment).

*   **Manual Falco Deployments:**
    If you manage Falco configuration files directly, you'll typically append the contents of `kubebrowse_rules.yaml` to Falco's primary rule file or include it as a separate file in Falco's configured rule directories (often `/etc/falco/rules.d/`). You may need to update Falco's ConfigMap and restart Falco pods.

**Please refer to the [Falco documentation on managing rules](https://falco.org/docs/rules/managing/) for detailed instructions.**

**3. Important Considerations for KubeBrowse Rules:**

*   **Whitelisting (Crucial!):** The provided `kubebrowse_rules.yaml` contains placeholder macros for whitelisting network destinations (`whitelisted_kubebrowse_network`) and processes (`whitelisted_kubebrowse_processes`). **You MUST customize these whitelists** based on your specific environment, the browser/office images used, and legitimate user activity. Failure to do so will result in a high number of false positive alerts. Review the `security/falco_rules/README.md` for more details.
*   **Pod Labels:** The rules assume KubeBrowse pods have the label `app: browser-sandbox-test`. If your deployment uses different labels for these session pods, you must update the `kubebrowse_pod` macro in the `kubebrowse_rules.yaml` file.
*   **Tuning:** After applying the rules, monitor Falco alerts closely. You will likely need to tune the rules and whitelists further to match the normal behavior of your KubeBrowse deployment and reduce false positives.

## Best Practices for Falco with KubeBrowse

*   **Keep Falco Updated:** Regularly update the Falco engine and its default rule sets.
*   **Centralize Alerts:** Forward Falco alerts to a SIEM or a centralized logging/alerting platform for better analysis, correlation, and retention. Consider using [Falcosidekick](https://github.com/falcosecurity/falcosidekick) for flexible alert forwarding.
*   **Review and Tune:** Periodically review Falco alerts and tune your custom rules.
*   **Incident Response:** Have a plan for how to respond to Falco alerts related to KubeBrowse pods.

## Further Reading

*   [Falco Official Documentation](https://falco.org/docs/)
*   [Falco Rules](https://falco.org/docs/rules/)
*   [KubeBrowse Falco Rules README](../security/falco_rules/README.md) (Link to the local README)

By integrating Falco with KubeBrowse and utilizing the provided custom rules, you can significantly improve the runtime security monitoring of your browser isolation platform.
