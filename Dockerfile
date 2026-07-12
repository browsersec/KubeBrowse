FROM golang:1.24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git make bash curl

COPY go.mod go.sum ./
RUN sed -i '/^tool github.com\/evilmartians\/lefthook/d' go.mod
RUN go mod download

COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY api/ ./api/
COPY docs/ ./docs/
COPY templates/ ./templates/
COPY go.mod go.sum ./

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o guac cmd/guac/main.go

FROM gcr.io/distroless/static:nonroot
WORKDIR /app
COPY --from=builder --chown=nonroot:nonroot /app/guac /app/guac
COPY --from=builder --chown=nonroot:nonroot /app/templates /app/templates
ENV GUACD_ADDRESS=guacd:4822
EXPOSE 4567
USER nonroot:nonroot
CMD ["/app/guac"]
