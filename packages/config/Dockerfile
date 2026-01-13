ARG  BRANCH=develop
FROM ghcr.io/psa-crs/ocrvs-base:release-v1.9.1

USER node

WORKDIR /app/packages/config
COPY --chown=node:node packages/config/*.json /app/packages/config/
RUN yarn install --frozen-lockfile
COPY --chown=node:node packages/config /app/packages/config
RUN yarn build

CMD [ "yarn", "start" ]
