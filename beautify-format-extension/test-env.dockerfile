FROM alpine
ENV KEY1=value1 \
    LONG_KEY2=value2 \
    K3=v3
LABEL maintainer="me@example.com" \
      version="1.0" \
      description="Test"
