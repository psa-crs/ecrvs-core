ARG  BRANCH=develop
FROM ghcr.io/psa-crs/ocrvs-base:release-v1.9.1

USER node

WORKDIR /app/packages/webhooks
COPY --chown=node:node packages/webhooks /app/packages/webhooks
RUN yarn install --frozen-lockfile && yarn build

CMD [ "yarn", "start:prod" ]
