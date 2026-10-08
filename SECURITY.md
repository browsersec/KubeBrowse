# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately to **[sanjay@nullvijayawada.org](mailto:sanjay@nullvijayawada.org)**. Sai Sanjay ([@sanjay7178](https://github.com/sanjay7178)), the lead maintainer, receives and reviews these reports.

Please do not disclose vulnerabilities, exploit details, credentials, or sensitive user data in public issues or pull requests before coordinated disclosure.

Include:

- The affected component, version or commit, and deployment configuration.
- A description of the issue, its potential impact, and steps to reproduce it.
- A minimal proof of concept or relevant logs with secrets and personal information removed.
- Any suggested mitigation and your preferred contact details.

Use an environment you control when reproducing issues. Do not access other users' sessions or data, disrupt shared services, or test deployments without their operator's permission.

## Response and disclosure

The maintainer will acknowledge reports as soon as reasonably possible, investigate them, and coordinate next steps with the reporter. Response and fix timing depend on maintainer availability and the severity of the issue; no fixed response deadline is guaranteed.

Confirmed issues will be addressed through fixes, mitigation guidance, or documentation of affected configurations. Please coordinate public disclosure with the maintainer so users have an opportunity to apply mitigations. Reporter credit will be included when requested and agreed.

## Supported versions and limitations

KubeBrowse is under active development and does not currently define a stable release support schedule. Please report issues against any version and identify the affected commit or container image. Fixes are prioritized for the current development code; backports are not guaranteed.

Remote browsing and containerization do not guarantee protection from every threat. Deployment operators remain responsible for cluster security, network policies, access controls, configuration, updates, and data handling. A clean antivirus scan does not establish that a file is safe.
