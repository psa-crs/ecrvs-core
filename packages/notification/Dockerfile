ARG  BRANCH=develop
FROM ghcr.io/psa-crs/ocrvs-base:release-v1.9.1

USER node

WORKDIR /app/packages/notification
COPY --chown=node:node packages/notification /app/packages/notification
RUN yarn install --frozen-lockfile && yarn build

CMD [ "yarn", "start:prod" ]
