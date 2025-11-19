ARG  BRANCH=develop
FROM ghcr.io/oni-on1003/ocrvs-base:release-v1.9.0

USER node

WORKDIR /app/packages/metrics
COPY --chown=node:node packages/metrics /app/packages/metrics
RUN yarn install --frozen-lockfile && yarn build

CMD ["yarn", "start:prod"]