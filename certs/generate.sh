#!/bin/bash
# This script generates a self-signed SSL certificate and private key
# Check if OpenSSL is installed
if ! command -v openssl &> /dev/null
then
    echo "OpenSSL could not be found. Please install OpenSSL."
    exit
fi
# Generate a self-signed SSL certificate and private key



openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ${PWD}/certs/private.key \
  -out ${PWD}/certs/certificate.crt \
  -subj "/C=US/ST=California/L=San Francisco/O=My Company/CN=mydomain.com"