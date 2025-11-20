ARG  BRANCH=develop
FROM ghcr.io/oni-on1003/ocrvs-base:release-v1.9.1

USER node

WORKDIR /app/packages/search
COPY --chown=node:node packages/search /app/packages/search
RUN yarn install --frozen-lockfile && yarn build


CMD [ "yarn", "start:prod" ]

