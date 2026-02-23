# Test for improved Dockerfile deep formatting

# Yum install sorting
RUN yum install -y \
    zlib-devel \
    openssl-devel \
    # Comment in the middle
    libffi-devel \
    bzip2-devel

# DNF install sorting
RUN dnf install -y \
    nginx \
    httpd \
    php

# JSON array spacing
CMD ["npm", "start", "with spaces"]

# Complex arguments
RUN apt-get update && apt-get install -y \
    # Build tools
    build-essential \
    # Python stuff
    python3-dev \
    python3-pip
