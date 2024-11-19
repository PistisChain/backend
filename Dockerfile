FROM node:6

VOLUME /pistischain

WORKDIR /pistischain

ENTRYPOINT node bin/pistischain.js

EXPOSE 3001