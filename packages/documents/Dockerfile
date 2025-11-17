ARG  BRANCH=develop
FROM ghcr.io/oni1003/ocrvs-base:release-v1.9.0

USER node

WORKDIR /app/packages/documents
COPY --chown=node:node packages/documents/*.json /app/packages/documents/
RUN yarn install --frozen-lockfile
COPY --chown=node:node packages/documents /app/packages/documents
RUN yarn build

CMD [ "yarn", "start:prod" ]