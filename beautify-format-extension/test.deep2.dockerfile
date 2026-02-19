# Comment for FROM
FROM node:18

# Comment for RUN
RUN echo "Hello"
# Comment detached (should have empty line before)
# Another detached comment
FROM nginx

# Comment with empty line

FROM python
# Comment attached to python

# String checks
CMD ['npm', 'start']
CMD ['echo', "It's me"]
