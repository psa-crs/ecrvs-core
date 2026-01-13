ARG  BRANCH=develop
FROM ghcr.io/psa-crs/ocrvs-base:release-v1.9.1

USER node

WORKDIR /app/packages/workflow
COPY --chown=node:node packages/workflow /app/packages/workflow
RUN yarn install --frozen-lockfile && yarn build

CMD [ "yarn", "start:prod" ]
