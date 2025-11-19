ARG  BRANCH=develop
FROM ghcr.io/oni-on1003/ocrvs-base:release-v1.9.0

USER node

WORKDIR /app/packages/config
COPY --chown=node:node packages/config/*.json /app/packages/config/
RUN yarn install --frozen-lockfile
COPY --chown=node:node packages/config /app/packages/config
RUN yarn build

CMD [ "yarn", "start" ]
