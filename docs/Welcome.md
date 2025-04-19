---
label: Welcome
icon:  home
order: 1000
---

# Welcome to KubeBrowse

Thank you for your interest in KubeBrowse! This project aims to create a secure browser-in-browser isolation platform powered by Kubernetes, providing ephemeral sandboxed browsing environments with no additional software requirements.

## What is KubeBrowse?

KubeBrowse is an open-source solution that offers containerized browser sessions for complete isolation from your local environment. Each session runs in an isolated container with:

- Real-time threat analysis for uploaded files
- Automatic cleanup after session timeout
- Strict per-pod network isolation
- Support for Chrome Extensions

## Getting Started

### Prerequisites

- Kubernetes cluster
- Docker
- Go 1.13+

### Quick Installation

```bash
# Clone the repository
git clone https://github.com/browsersec/KubeBrowse.git
cd KubeBrowse

# Build the application
go build -v .

# Run the application
./guac
```

For more detailed installation instructions, please refer to our [installation guide](https://github.com/browsersec/KubeBrowse/tree/main/docs/).

## How to Contribute

We welcome contributions from everyone! Here's how you can help:

1. **Code Contributions**: Submit bug fixes or new features via pull requests
2. **Documentation**: Help improve our documentation
3. **Bug Reports**: Submit detailed bug reports
4. **Feature Requests**: Share your ideas for new features

Please check out our [CONTRIBUTING.md](https://github.com/browsersec/KubeBrowse/blob/main/docs/CONTRIBUTING.md) for more information on how to contribute.

## Community

- **GitHub Issues**: For bug reports and feature requests
- **Discussions**: For questions and community support

## License

KubeBrowse is licensed under the license included in the repository. See the LICENSE file for details.

---

We're excited to have you join our community and look forward to your contributions!
