# Safe sorting test
# Should NOT sort because of &&
RUN apt-get update \
    && apt-get install -y \
    python3 \
    make \
    g++

# JSON test
CMD [ 'npm', 'start' ]

# Comments between instructions
# Should preserve order
RUN echo "hello"
# This is a comment
RUN echo "world"
