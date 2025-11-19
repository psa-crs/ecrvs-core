ARG  BRANCH=develop
FROM ghcr.io/oni-on1003/ocrvs-base:release-v1.9.0

USER node

COPY --chown=node:node packages/events /app/packages/events

WORKDIR /app/packages/gateway
COPY --chown=node:node packages/gateway/*.json /app/packages/gateway/

RUN yarn install --frozen-lockfile
COPY --chown=node:node packages/gateway /app/packages/gateway
RUN yarn build

CMD [ "yarn", "start:prod" ]
