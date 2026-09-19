# --- Build stage ---
FROM golang:1.27-alpine AS build
WORKDIR /src

# Cache module downloads separately from source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/careflow-backend .

# --- Runtime stage ---
FROM alpine:3.20
RUN apk add --no-cache ca-certificates && \
    addgroup -S careflow && adduser -S careflow -G careflow
WORKDIR /app
COPY --from=build /out/careflow-backend ./careflow-backend

USER careflow
EXPOSE 8080
ENTRYPOINT ["./careflow-backend"]
