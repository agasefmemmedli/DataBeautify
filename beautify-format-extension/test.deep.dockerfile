# This is a complex Dockerfile for testing deep formatting
arg  NODE_VERSION=16
from node:${NODE_VERSION}-alpine as builder

# maintainer is deprecated but should still be handled
maintainer John Doe <john@example.com>

run apk add --no-cache \
    python3 \
make \
    g++

workdir /app

copy package*.json ./

# Multiple commands on one line with &&
run npm install && npm run build && echo "Build complete"

copy . .

env NODE_ENV=production PORT=8080

# JSON array with single quotes (should become double quotes)
cmd ['npm', 'start']

# Another stage
from nginx:alpine
copy --from=builder /app/build /usr/share/nginx/html

expose 80

# Exec form with bad spacing
entrypoint [ "nginx", "-g", "daemon off;" ]

# Shell form
shell ["/bin/bash", "-c"]

# Healthcheck
healthcheck --interval=5m --timeout=3s \
  CMD curl -f http://localhost/ || exit 1
