all: run

# check if the certs directory exists and .key and .crt files exist
ifneq ("$(wildcard certs)","")
	ifneq ("$(wildcard certs/private.key)","")
		ifneq ("$(wildcard certs/certificate.crt)","")
			CERTS_EXIST := true
		endif
	endif
endif
# if certs exist, set the cert path and key path
ifeq ($(CERTS_EXIST), true)
	CERT_PATH := "$(shell pwd)/certs/certificate.crt"
	CERT_KEY_PATH := "$(shell pwd)/certs/private.key"
else
	CERT_PATH := "$(shell pwd)/certs/certificate.crt"
	CERT_KEY_PATH := "$(shell pwd)/certs/private.key"
	bash ./certs/generate.sh
endif
# if certs do not exist, create them

# run the server 
run:
	@echo "Running server..."
	@echo "Using certs from $(CERT_PATH) and $(CERT_KEY_PATH)"
	@echo "Starting server..."
	CERT_PATH=./certs/certificate.crt CERT_KEY_PATH=./certs/private.key go run cmd/guac/guac.go

generate:
	bash ./certs/generate.sh

# generate lets encrypt
generate_prod:
	sudo certbot certonly --standalone -d $(DOMAIN) --email $(EMAIL) --agree-tos --non-interactive
	@echo "Certs generated in /etc/letsencrypt/live/$(DOMAIN)/"
	@echo "Copying certs to certs directory..."
	sudo cp /etc/letsencrypt/live/$(DOMAIN)/fullchain.pem certs/prod/certificate.crt
	sudo cp /etc/letsencrypt/live/$(DOMAIN)/privkey.pem certs/prod/private.key