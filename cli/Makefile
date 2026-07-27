BINARY := cc
BUILD_DIR := dist
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
GO := /home/runner/goroot/go/bin/go

.PHONY: build build-all install test clean fmt lint

build:
	$(GO) build -ldflags "-s -w -X main.version=$(VERSION)" -o $(BUILD_DIR)/$(BINARY) .

build-all:
	mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 $(GO) build -ldflags "-s -w" -o $(BUILD_DIR)/$(BINARY)-linux-amd64 .
	GOOS=linux GOARCH=arm64 $(GO) build -ldflags "-s -w" -o $(BUILD_DIR)/$(BINARY)-linux-arm64 .
	GOOS=darwin GOARCH=amd64 $(GO) build -ldflags "-s -w" -o $(BUILD_DIR)/$(BINARY)-darwin-amd64 .
	GOOS=darwin GOARCH=arm64 $(GO) build -ldflags "-s -w" -o $(BUILD_DIR)/$(BINARY)-darwin-arm64 .
	GOOS=windows GOARCH=amd64 $(GO) build -ldflags "-s -w" -o $(BUILD_DIR)/$(BINARY)-windows-amd64.exe .

install:
	$(GO) install .

test:
	$(GO) test ./...

clean:
	rm -rf $(BUILD_DIR)

fmt:
	$(GO) fmt ./...

lint:
	$(GO) vet ./...
