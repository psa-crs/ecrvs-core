ARG  BRANCH=develop
FROM ghcr.io/psa-crs/ocrvs-base:release-v1.9.12

USER node

WORKDIR /app/packages/events
COPY --chown=node:node packages/events/*.json /app/packages/events/
RUN NODE_ENV=production yarn install --frozen-lockfile
COPY --chown=node:node packages/events /app/packages/events
RUN yarn build

CMD [ "yarn", "start:prod" ]
